//! `RemoteCatalog` end to end against a tiny local HTTP/1.1 server: signed official files and
//! channel manifests, tampering, unknown keys, conditional requests, outages and the allowlist.
//! Everything runs on loopback with temp databases; nothing needs real Windows state.

// Test code: helpers outside `#[test]` fns are not covered by clippy's allow-unwrap-in-tests.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use ed25519_dalek::SigningKey;
use paparats_catalog::{
    CatalogError, CatalogManifest, CatalogSource, ChannelDirectory, ChannelEntry, ChannelManifest,
    EmbeddedCatalog, Freshness, KeyRing, ManifestEnvelope, PlatformManifest, PublishedKey,
    RemoteCatalog, RemoteConfig, TrustWarning, down_days, sign_envelope,
};
use paparats_core::{InstallStrategy, Package, SyncOutcome, TrustLevel};
use paparats_storage::Storage;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

// ---------------------------------------------------------------------------------------------
// Test server
// ---------------------------------------------------------------------------------------------

#[derive(Clone, Default)]
struct Reply {
    status: u16,
    body: Vec<u8>,
    etag: Option<String>,
    location: Option<String>,
    delay: Duration,
}

impl Reply {
    fn ok(body: Vec<u8>, etag: &str) -> Self {
        Self {
            status: 200,
            body,
            etag: Some(etag.to_owned()),
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Hit {
    path: String,
    if_none_match: Option<String>,
}

struct Server {
    addr: SocketAddr,
    routes: Arc<Mutex<HashMap<String, Reply>>>,
    hits: Arc<Mutex<Vec<Hit>>>,
    down: Arc<AtomicBool>,
}

impl Server {
    async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let routes = Arc::new(Mutex::new(HashMap::new()));
        let hits = Arc::new(Mutex::new(Vec::new()));
        let down = Arc::new(AtomicBool::new(false));
        let (r, h, d) = (Arc::clone(&routes), Arc::clone(&hits), Arc::clone(&down));
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    return;
                };
                if d.load(Ordering::SeqCst) {
                    // "Down": hang up without answering.
                    drop(stream);
                    continue;
                }
                let (r, h) = (Arc::clone(&r), Arc::clone(&h));
                tokio::spawn(async move {
                    let _ = serve(stream, &r, &h).await;
                });
            }
        });
        Self {
            addr,
            routes,
            hits,
            down,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("http://{}{path}", self.addr)
    }

    fn set(&self, path: &str, reply: Reply) {
        self.routes.lock().unwrap().insert(path.to_owned(), reply);
    }

    fn hits(&self) -> Vec<Hit> {
        self.hits.lock().unwrap().clone()
    }

    fn clear_hits(&self) {
        self.hits.lock().unwrap().clear();
    }

    fn set_down(&self, down: bool) {
        self.down.store(down, Ordering::SeqCst);
    }
}

async fn serve(
    stream: TcpStream,
    routes: &Mutex<HashMap<String, Reply>>,
    hits: &Mutex<Vec<Hit>>,
) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).await?;
    let path = request_line
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .to_owned();
    let mut if_none_match = None;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).await? == 0 || line.trim().is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':')
            && name.trim().eq_ignore_ascii_case("if-none-match")
        {
            if_none_match = Some(value.trim().to_owned());
        }
    }
    hits.lock().unwrap().push(Hit {
        path: path.clone(),
        if_none_match: if_none_match.clone(),
    });
    let reply = routes.lock().unwrap().get(&path).cloned();
    let reply = reply.unwrap_or(Reply {
        status: 404,
        ..Reply::default()
    });
    tokio::time::sleep(reply.delay).await;
    let not_modified = reply.status == 200
        && reply.etag.is_some()
        && if_none_match.is_some()
        && reply.etag == if_none_match;
    let (status, body) = if not_modified {
        (304, Vec::new())
    } else {
        (reply.status, reply.body)
    };
    let mut head = format!(
        "HTTP/1.1 {status} X\r\nContent-Length: {}\r\nConnection: close\r\n",
        body.len()
    );
    if let Some(etag) = &reply.etag {
        head.push_str(&format!("ETag: {etag}\r\n"));
    }
    if let Some(location) = &reply.location {
        head.push_str(&format!("Location: {location}\r\n"));
    }
    head.push_str("\r\n");
    let mut stream = reader.into_inner();
    stream.write_all(head.as_bytes()).await?;
    stream.write_all(&body).await?;
    stream.shutdown().await
}

// ---------------------------------------------------------------------------------------------
// Signed fixtures (the embedded mock data set, published over HTTP)
// ---------------------------------------------------------------------------------------------

const OFFICIAL_ID: &str = "paparats-test";
const TODAY: &str = "2026-09-15";

fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

fn official() -> SigningKey {
    key(1)
}

/// Each verified channel signs with its own key, pinned in the directory as `<id>-1`.
fn channel_key(id: &str) -> SigningKey {
    match id {
        "kvetka" => key(2),
        "fossfriends" => key(3),
        _ => key(4),
    }
}

fn stranger() -> SigningKey {
    key(9)
}

fn signed<T: serde::Serialize>(key: &SigningKey, key_id: &str, value: &T) -> Vec<u8> {
    let payload = serde_json::to_vec(value).unwrap();
    serde_json::to_vec(&sign_envelope(key, key_id, &payload)).unwrap()
}

fn official_signed<T: serde::Serialize>(value: &T) -> Vec<u8> {
    signed(&official(), OFFICIAL_ID, value)
}

fn catalog_manifest(generated: &str) -> CatalogManifest {
    CatalogManifest {
        generated: generated.into(),
        catalog: EmbeddedCatalog::load().unwrap().catalog_ref().clone(),
    }
}

fn platform_manifest() -> PlatformManifest {
    PlatformManifest {
        generated: TODAY.into(),
        platform: EmbeddedCatalog::load().unwrap().platform_ref().clone(),
    }
}

fn channel_path(id: &str) -> String {
    format!("/channels/{id}.json")
}

fn directory(server: &Server) -> ChannelDirectory {
    let world = EmbeddedCatalog::load().unwrap();
    ChannelDirectory {
        generated: TODAY.into(),
        channels: world
            .channels_ref()
            .iter()
            .map(|info| ChannelEntry {
                info: info.clone(),
                manifest_url: server.url(&channel_path(&info.id)),
                keys: if info.trust == TrustLevel::Verified {
                    vec![PublishedKey {
                        id: format!("{}-1", info.id),
                        public_key: BASE64.encode(channel_key(&info.id).verifying_key().as_bytes()),
                    }]
                } else {
                    // Listed for a community channel too: must never be pinned.
                    vec![PublishedKey {
                        id: format!("{}-1", info.id),
                        public_key: BASE64.encode(key(4).verifying_key().as_bytes()),
                    }]
                },
            })
            .collect(),
    }
}

fn releases(channel_id: &str, generated: &str) -> ChannelManifest {
    let (app, host) = match channel_id {
        "kvetka" => ("shell", "downloads.kvetka.example"),
        "vitrazh" => ("vitrazhtweaker", "vitrazh.example"),
        "fossfriends" => ("rufus", "files.fossfriends.org"),
        _ => ("obsidian", "paparats-app.github.io"),
    };
    ChannelManifest {
        channel_id: channel_id.into(),
        generated: generated.into(),
        packages: vec![Package {
            app_id: app.into(),
            version: "1.0.0".into(),
            url: Some(format!("https://{host}/{app}-1.0.0.msi")),
            sha256: Some("ab".repeat(32)),
            size_bytes: 1_048_576,
            strategy: InstallStrategy::Msi,
            signer: None,
            unsigned: false,
            machine_wide: false,
            launch: None,
        }],
    }
}

/// Publishes the official files and a correctly signed manifest for every channel (verified
/// channels with their own key, the official catalog with the official key, community channels
/// unsigned).
fn publish(server: &Server) {
    server.set(
        "/v1/channels.json",
        Reply::ok(official_signed(&directory(server)), "\"d1\""),
    );
    server.set(
        "/v1/catalog.json",
        Reply::ok(official_signed(&catalog_manifest(TODAY)), "\"c1\""),
    );
    server.set(
        "/v1/platform.json",
        Reply::ok(official_signed(&platform_manifest()), "\"p1\""),
    );
    for info in EmbeddedCatalog::load().unwrap().channels_ref() {
        let manifest = releases(&info.id, TODAY);
        let body = match info.trust {
            TrustLevel::Official => official_signed(&manifest),
            TrustLevel::Verified => {
                signed(&channel_key(&info.id), &format!("{}-1", info.id), &manifest)
            }
            TrustLevel::Community => unsigned(&manifest),
        };
        server.set(&channel_path(&info.id), Reply::ok(body, "\"m1\""));
    }
}

fn unsigned<T: serde::Serialize>(value: &T) -> Vec<u8> {
    let envelope = ManifestEnvelope {
        payload: BASE64.encode(serde_json::to_vec(value).unwrap()),
        signature: None,
        key_id: None,
        public_key: None,
    };
    serde_json::to_vec(&envelope).unwrap()
}

fn official_keys() -> KeyRing {
    KeyRing::new()
        .with(OFFICIAL_ID, official().verifying_key())
        .unwrap()
}

fn config(server: &Server) -> RemoteConfig {
    let mut config = RemoteConfig::new(server.url("/v1"), official_keys()).allow_host("127.0.0.1");
    config.use_env_proxy = false;
    config.request_timeout = Duration::from_secs(5);
    config
}

fn remote(server: &Server, storage: &Arc<Storage>) -> RemoteCatalog {
    RemoteCatalog::new(config(server), Arc::clone(storage)).unwrap()
}

fn memory() -> Arc<Storage> {
    Arc::new(Storage::open_in_memory().unwrap())
}

async fn ready(server: &Server, storage: &Arc<Storage>) -> RemoteCatalog {
    publish(server);
    let catalog = remote(server, storage);
    let report = catalog.refresh(TODAY).await;
    assert!(report.is_ok(), "{report:?}");
    catalog
}

// ---------------------------------------------------------------------------------------------
// Official files
// ---------------------------------------------------------------------------------------------

#[tokio::test]
async fn a_valid_signed_catalog_is_served_cached_and_used_offline() {
    let server = Server::start().await;
    publish(&server);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("paparats.db");
    let storage = Arc::new(Storage::open(&path).unwrap());
    let world = EmbeddedCatalog::load().unwrap();

    let remote = remote(&server, &storage);
    assert!(!remote.has_catalog());
    assert!(matches!(
        remote.catalog(),
        Err(CatalogError::Unavailable(_))
    ));

    let report = remote.refresh(TODAY).await;
    assert!(matches!(report.directory, Ok(Freshness::Updated)));
    assert!(matches!(report.catalog, Ok(Freshness::Updated)));
    assert!(matches!(report.platform, Ok(Freshness::Updated)));
    assert!(remote.has_catalog());
    assert_eq!(&remote.catalog().unwrap(), world.catalog_ref());
    assert_eq!(&remote.platform().unwrap(), world.platform_ref());
    assert_eq!(remote.channels().unwrap(), world.channels_ref());

    let cached = storage
        .cached_manifest(&server.url("/v1/catalog.json"))
        .unwrap()
        .unwrap();
    assert_eq!(cached.etag.as_deref(), Some("\"c1\""));
    assert_eq!(cached.fetched, TODAY);

    // Next start, server gone: the last verified copies are served from the cache.
    drop(remote);
    drop(storage);
    server.set_down(true);
    let storage = Arc::new(Storage::open(&path).unwrap());
    let offline = RemoteCatalog::new(config(&server), Arc::clone(&storage)).unwrap();
    assert!(offline.has_catalog());
    assert_eq!(&offline.catalog().unwrap(), world.catalog_ref());
    assert_eq!(offline.channels().unwrap().len(), 6);
    let report = offline.refresh("2026-09-16").await;
    assert!(matches!(report.catalog, Err(CatalogError::Network(_))));
    assert!(matches!(report.directory, Err(CatalogError::Network(_))));
    assert_eq!(
        &offline.catalog().unwrap(),
        world.catalog_ref(),
        "a failed refresh keeps the cached copy"
    );
}

#[tokio::test]
async fn not_modified_reuses_the_cache_and_new_versions_replace_it() {
    let server = Server::start().await;
    let storage = memory();
    let remote = ready(&server, &storage).await;
    assert!(
        server.hits().iter().all(|h| h.if_none_match.is_none()),
        "nothing to revalidate on the first fetch"
    );

    server.clear_hits();
    let report = remote.refresh("2026-09-16").await;
    assert!(matches!(report.directory, Ok(Freshness::NotModified)));
    assert!(matches!(report.catalog, Ok(Freshness::NotModified)));
    assert!(matches!(report.platform, Ok(Freshness::NotModified)));
    let sent: Vec<_> = server.hits().into_iter().map(|h| h.if_none_match).collect();
    assert_eq!(
        sent,
        [
            Some("\"d1\"".to_owned()),
            Some("\"c1\"".to_owned()),
            Some("\"p1\"".to_owned())
        ]
    );
    let catalog_url = server.url("/v1/catalog.json");
    assert_eq!(
        storage
            .cached_manifest(&catalog_url)
            .unwrap()
            .unwrap()
            .fetched,
        "2026-09-16"
    );
    assert_eq!(remote.catalog().unwrap().apps.len(), 32);

    // A new version (new ETag, later date) replaces the copy.
    let mut next = catalog_manifest("2026-09-16");
    next.catalog.apps.retain(|a| a.id != "vlc");
    server.set(
        "/v1/catalog.json",
        Reply::ok(official_signed(&next), "\"c2\""),
    );
    let report = remote.refresh("2026-09-16").await;
    assert!(matches!(report.catalog, Ok(Freshness::Updated)));
    assert_eq!(remote.catalog().unwrap().apps.len(), 31);
    assert_eq!(
        storage
            .cached_manifest(&catalog_url)
            .unwrap()
            .unwrap()
            .etag
            .as_deref(),
        Some("\"c2\"")
    );
}

#[tokio::test]
async fn a_tampered_payload_is_rejected() {
    let server = Server::start().await;
    publish(&server);
    let mut envelope: ManifestEnvelope =
        serde_json::from_slice(&official_signed(&catalog_manifest(TODAY))).unwrap();
    let mut evil = catalog_manifest(TODAY);
    evil.catalog.apps[0].name = "Obsidian (totally legit)".into();
    envelope.payload = BASE64.encode(serde_json::to_vec(&evil).unwrap());
    server.set(
        "/v1/catalog.json",
        Reply::ok(serde_json::to_vec(&envelope).unwrap(), "\"evil\""),
    );

    let storage = memory();
    let remote = remote(&server, &storage);
    let report = remote.refresh(TODAY).await;
    assert!(matches!(report.catalog, Err(CatalogError::BadSignature)));
    assert!(report.directory.is_ok() && report.platform.is_ok());
    assert!(matches!(
        remote.catalog(),
        Err(CatalogError::Unavailable(_))
    ));
    assert!(
        storage
            .cached_manifest(&server.url("/v1/catalog.json"))
            .unwrap()
            .is_none(),
        "nothing unverified is cached"
    );

    // With a verified copy in place, a tampered update leaves it untouched.
    server.set(
        "/v1/catalog.json",
        Reply::ok(official_signed(&catalog_manifest(TODAY)), "\"c1\""),
    );
    assert!(remote.refresh(TODAY).await.catalog.is_ok());
    server.set(
        "/v1/catalog.json",
        Reply::ok(serde_json::to_vec(&envelope).unwrap(), "\"evil\""),
    );
    assert!(matches!(
        remote.refresh(TODAY).await.catalog,
        Err(CatalogError::BadSignature)
    ));
    assert_eq!(remote.catalog().unwrap().apps[0].name, "Obsidian");
    assert_eq!(
        storage
            .cached_manifest(&server.url("/v1/catalog.json"))
            .unwrap()
            .unwrap()
            .etag
            .as_deref(),
        Some("\"c1\"")
    );
}

#[tokio::test]
async fn unknown_keys_and_unsigned_official_files_are_rejected() {
    let server = Server::start().await;
    publish(&server);
    let storage = memory();
    let remote = remote(&server, &storage);

    let manifest = catalog_manifest(TODAY);
    server.set(
        "/v1/catalog.json",
        Reply::ok(signed(&stranger(), "stranger", &manifest), "\"x\""),
    );
    assert!(matches!(
        remote.refresh(TODAY).await.catalog,
        Err(CatalogError::UnknownKey(id)) if id == "stranger"
    ));
    // A stranger claiming the official key id.
    server.set(
        "/v1/catalog.json",
        Reply::ok(signed(&stranger(), OFFICIAL_ID, &manifest), "\"y\""),
    );
    assert!(matches!(
        remote.refresh(TODAY).await.catalog,
        Err(CatalogError::BadSignature)
    ));
    // A verified channel's (pinned) key cannot sign official files.
    server.set(
        "/v1/catalog.json",
        Reply::ok(
            signed(&channel_key("kvetka"), "kvetka-1", &manifest),
            "\"z\"",
        ),
    );
    assert!(matches!(
        remote.refresh(TODAY).await.catalog,
        Err(CatalogError::UnknownKey(_))
    ));
    // Official files are never accepted unsigned.
    server.set("/v1/catalog.json", Reply::ok(unsigned(&manifest), "\"u\""));
    assert!(matches!(
        remote.refresh(TODAY).await.catalog,
        Err(CatalogError::Unsigned)
    ));
    assert!(!remote.has_catalog());
}

#[tokio::test]
async fn an_older_manifest_never_replaces_a_newer_one() {
    let server = Server::start().await;
    let storage = memory();
    let remote = ready(&server, &storage).await;
    let mut old = catalog_manifest("2026-09-01");
    old.catalog.apps.truncate(3);
    server.set(
        "/v1/catalog.json",
        Reply::ok(official_signed(&old), "\"old\""),
    );
    assert!(matches!(
        remote.refresh(TODAY).await.catalog,
        Err(CatalogError::Rollback { .. })
    ));
    assert_eq!(remote.catalog().unwrap().apps.len(), 32);
}

#[tokio::test]
async fn limits_size_and_time() {
    let server = Server::start().await;
    publish(&server);
    let mut small = config(&server);
    small.max_manifest_bytes = 4 * 1024;
    let remote = RemoteCatalog::new(small, memory()).unwrap();
    assert!(matches!(
        remote.refresh(TODAY).await.catalog,
        Err(CatalogError::TooLarge { limit: 4096 })
    ));

    let mut slow_reply = Reply::ok(official_signed(&platform_manifest()), "\"p1\"");
    slow_reply.delay = Duration::from_secs(3);
    server.set("/v1/platform.json", slow_reply);
    let mut impatient = config(&server);
    impatient.request_timeout = Duration::from_millis(300);
    let remote = RemoteCatalog::new(impatient, memory()).unwrap();
    assert!(matches!(
        remote.refresh(TODAY).await.platform,
        Err(CatalogError::Network(_))
    ));
}

// ---------------------------------------------------------------------------------------------
// Network allowlist
// ---------------------------------------------------------------------------------------------

#[tokio::test]
async fn hosts_outside_the_allowlist_are_refused() {
    let server = Server::start().await;
    publish(&server);

    // The base URL's host was never allowed: no request leaves the machine.
    let mut unlisted = RemoteConfig::new(server.url("/v1/"), official_keys());
    unlisted.use_env_proxy = false;
    let remote = RemoteCatalog::new(unlisted, memory()).unwrap();
    let report = remote.refresh(TODAY).await;
    for result in [&report.directory, &report.catalog, &report.platform] {
        assert!(matches!(result, Err(CatalogError::HostNotAllowed(h)) if h == "127.0.0.1"));
    }
    assert!(server.hits().is_empty());

    // A redirect to a host the allowlist does not name is not followed.
    let storage = memory();
    let remote = ready(&server, &storage).await;
    let target = format!("http://localhost:{}/elsewhere.json", server.addr.port());
    server.set(
        &channel_path("kvetka"),
        Reply {
            status: 302,
            location: Some(target),
            ..Reply::default()
        },
    );
    server.set(
        "/elsewhere.json",
        Reply::ok(
            signed(
                &channel_key("kvetka"),
                "kvetka-1",
                &releases("kvetka", TODAY),
            ),
            "\"e\"",
        ),
    );
    server.clear_hits();
    assert_eq!(
        remote.sync_channel("kvetka", TODAY).await.unwrap(),
        SyncOutcome::Unreachable { days: 1 }
    );
    assert!(
        server.hits().iter().all(|h| h.path != "/elsewhere.json"),
        "the redirect target was never contacted"
    );

    // Hosts from the verified directory and from verified channel manifests are allowed;
    // anything else is not.
    let allowlist = remote.allowlist();
    publish(&server);
    assert!(matches!(
        remote.sync_channel("kvetka", TODAY).await.unwrap(),
        SyncOutcome::Synced { .. }
    ));
    let list = allowlist.read().unwrap();
    assert!(list.is_allowed("downloads.kvetka.example"));
    assert!(!list.is_allowed("evil.example"));
    assert!(!list.is_allowed("localhost"));
}

// ---------------------------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------------------------

#[tokio::test]
async fn verified_channels_need_their_pinned_key() {
    let server = Server::start().await;
    let storage = memory();
    let remote = ready(&server, &storage).await;

    // Signed with its own pinned key.
    assert_eq!(
        remote.sync_channel("kvetka", TODAY).await.unwrap(),
        SyncOutcome::Synced { at: TODAY.into() }
    );
    let releases_now = remote.channel_releases("kvetka").unwrap();
    assert!(releases_now.is_verified());
    assert_eq!(releases_now.trust, TrustLevel::Verified);
    let package = remote.package("kvetka", "shell").unwrap();
    assert!(package.warnings.is_empty());
    assert_eq!(
        package.package.sha256.as_deref(),
        Some("ab".repeat(32).as_str())
    );
    assert!(remote.package("kvetka", "vlc").is_none());

    // The official catalog's own manifest, with the official key.
    assert!(matches!(
        remote.sync_channel("paparats", TODAY).await.unwrap(),
        SyncOutcome::Synced { .. }
    ));

    // Another verified channel's key is not this channel's key.
    let foreign = signed(
        &channel_key("fossfriends"),
        "fossfriends-1",
        &releases("kvetka", "2026-09-16"),
    );
    server.set(&channel_path("kvetka"), Reply::ok(foreign, "\"m2\""));
    assert_eq!(
        remote.sync_channel("kvetka", "2026-09-16").await.unwrap(),
        SyncOutcome::Unreachable { days: 1 }
    );
    // The cached, verified copy stays in use.
    assert!(remote.package("kvetka", "shell").is_some());

    // A verified channel's key cannot sign the official catalog's manifest.
    server.set(
        &channel_path("paparats"),
        Reply::ok(
            signed(
                &channel_key("kvetka"),
                "kvetka-1",
                &releases("paparats", TODAY),
            ),
            "\"m3\"",
        ),
    );
    assert!(matches!(
        remote.sync_channel("paparats", TODAY).await.unwrap(),
        SyncOutcome::Unreachable { .. }
    ));

    // A correctly signed manifest of another channel, served at this channel's address.
    server.set(
        &channel_path("fossfriends"),
        Reply::ok(official_signed(&releases("kvetka", TODAY)), "\"m4\""),
    );
    assert!(matches!(
        remote.sync_channel("fossfriends", TODAY).await.unwrap(),
        SyncOutcome::Unreachable { .. }
    ));
    assert!(remote.channel_releases("fossfriends").is_none());

    assert!(matches!(
        remote.sync_channel("ghost", TODAY).await,
        Err(CatalogError::UnknownChannel(_))
    ));
}

#[tokio::test]
async fn community_channels_stay_unverified_with_warnings() {
    let server = Server::start().await;
    let storage = memory();
    let remote = ready(&server, &storage).await;
    let allowlist = remote.allowlist();

    // Unsigned: accepted on the community path, hosts not allowlisted.
    assert!(matches!(
        remote.sync_channel("vitrazh", TODAY).await.unwrap(),
        SyncOutcome::Synced { .. }
    ));
    let package = remote.package("vitrazh", "vitrazhtweaker").unwrap();
    assert_eq!(package.trust, TrustLevel::Community);
    assert_eq!(package.warnings, [TrustWarning::Unsigned]);
    assert!(!allowlist.read().unwrap().is_allowed("vitrazh.example"));
    assert_eq!(
        remote.trust_community_downloads("vitrazh").unwrap(),
        ["vitrazh.example"]
    );
    assert!(allowlist.read().unwrap().is_allowed("vitrazh.example"));
    assert!(matches!(
        remote.trust_community_downloads("bysoft"),
        Err(CatalogError::UnknownChannel(_))
    ));

    // Self-signed: intact, identity unproven. The key the directory lists for a community
    // channel is not pinned, so signing with it alone is not enough.
    let author = key(4);
    let payload = serde_json::to_vec(&releases("vitrazh", "2026-09-16")).unwrap();
    let pinned_only = sign_envelope(&author, "vitrazh-1", &payload);
    server.set(
        &channel_path("vitrazh"),
        Reply::ok(serde_json::to_vec(&pinned_only).unwrap(), "\"s0\""),
    );
    assert!(matches!(
        remote.sync_channel("vitrazh", "2026-09-16").await.unwrap(),
        SyncOutcome::Unreachable { .. }
    ));
    let mut self_signed = pinned_only.clone();
    self_signed.public_key = Some(BASE64.encode(author.verifying_key().as_bytes()));
    server.set(
        &channel_path("vitrazh"),
        Reply::ok(serde_json::to_vec(&self_signed).unwrap(), "\"s1\""),
    );
    assert!(matches!(
        remote.sync_channel("vitrazh", "2026-09-16").await.unwrap(),
        SyncOutcome::Synced { .. }
    ));
    assert_eq!(
        remote.channel_releases("vitrazh").unwrap().warnings,
        [TrustWarning::SelfSigned {
            key_id: "vitrazh-1".into()
        }]
    );

    // A self-signed manifest altered on the way is rejected, not downgraded to "unsigned".
    let mut tampered = self_signed.clone();
    tampered.payload = BASE64.encode(
        serde_json::to_vec(&releases("vitrazh", "2026-09-17"))
            .unwrap()
            .as_slice(),
    );
    server.set(
        &channel_path("vitrazh"),
        Reply::ok(serde_json::to_vec(&tampered).unwrap(), "\"s2\""),
    );
    assert!(matches!(
        remote.sync_channel("vitrazh", "2026-09-17").await.unwrap(),
        SyncOutcome::Unreachable { .. }
    ));
    assert_eq!(
        remote
            .channel_releases("vitrazh")
            .unwrap()
            .manifest
            .generated,
        "2026-09-16"
    );
}

#[tokio::test]
async fn a_server_that_is_down_keeps_the_cache_and_starts_an_outage() {
    let server = Server::start().await;
    let storage = memory();
    let remote = ready(&server, &storage).await;
    let kvetka = |remote: &RemoteCatalog| {
        remote
            .channels()
            .unwrap()
            .into_iter()
            .find(|c| c.id == "kvetka")
            .unwrap()
    };

    assert_eq!(
        remote.sync_channel("kvetka", "2026-09-10").await.unwrap(),
        SyncOutcome::Synced {
            at: "2026-09-10".into()
        }
    );
    assert_eq!(kvetka(&remote).synced.as_deref(), Some("2026-09-10"));
    assert_eq!(kvetka(&remote).outage, None);

    server.set_down(true);
    // One failure: unreachable, but not an outage yet.
    assert_eq!(
        remote.sync_channel("kvetka", "2026-09-12").await.unwrap(),
        SyncOutcome::Unreachable { days: 1 }
    );
    assert_eq!(kvetka(&remote).outage, None);
    // Repeated failures: an outage since the first failure.
    assert_eq!(
        remote.sync_channel("kvetka", "2026-09-15").await.unwrap(),
        SyncOutcome::Unreachable { days: 3 }
    );
    let down = kvetka(&remote);
    assert_eq!(down.outage.as_deref(), Some("2026-09-12"));
    assert_eq!(down.synced.as_deref(), Some("2026-09-10"));
    assert_eq!(
        down_days(&down, "2026-09-15"),
        3,
        "the same count the UI shows"
    );
    let health = storage.channel_health().unwrap();
    assert_eq!(health.get("kvetka").map(|h| h.failures), Some(2));

    // The cached copies keep serving.
    assert!(remote.package("kvetka", "shell").is_some());
    assert!(!remote.refresh("2026-09-15").await.is_ok());
    assert_eq!(remote.catalog().unwrap().apps.len(), 32);

    // Back up: synced today, the outage is over.
    server.set_down(false);
    assert_eq!(
        remote.sync_channel("kvetka", "2026-09-16").await.unwrap(),
        SyncOutcome::Synced {
            at: "2026-09-16".into()
        }
    );
    let up = kvetka(&remote);
    assert_eq!(up.outage, None);
    assert_eq!(up.synced.as_deref(), Some("2026-09-16"));
    assert!(storage.channel_health().unwrap().is_empty());

    // Channels never synced here keep the published values (fossfriends' published outage).
    let foss = remote
        .channels()
        .unwrap()
        .into_iter()
        .find(|c| c.id == "fossfriends")
        .unwrap();
    assert_eq!(foss.outage.as_deref(), Some("2026-08-30"));

    // Sync of several channels at once (start-up).
    let results = remote
        .sync_channels(&["paparats".into(), "vitrazh".into()], "2026-09-16")
        .await;
    assert!(
        results
            .iter()
            .all(|(_, r)| matches!(r, Ok(SyncOutcome::Synced { .. })))
    );
}

#[tokio::test]
async fn a_new_directory_rechecks_cached_channel_manifests() {
    let server = Server::start().await;
    let storage = memory();
    let remote = ready(&server, &storage).await;
    assert!(matches!(
        remote.sync_channel("kvetka", TODAY).await.unwrap(),
        SyncOutcome::Synced { .. }
    ));
    assert!(remote.channel_releases("kvetka").is_some());

    // Paparats rotates kvetka's pinned key: the cached manifest (old key) no longer verifies.
    let mut next = directory(&server);
    next.generated = "2026-09-16".into();
    for entry in &mut next.channels {
        if entry.info.id == "kvetka" {
            entry.keys = vec![PublishedKey {
                id: "kvetka-2".into(),
                public_key: BASE64.encode(key(8).verifying_key().as_bytes()),
            }];
        }
    }
    server.set(
        "/v1/channels.json",
        Reply::ok(official_signed(&next), "\"d2\""),
    );
    assert!(matches!(
        remote.refresh("2026-09-16").await.directory,
        Ok(Freshness::Updated)
    ));
    assert!(remote.channel_releases("kvetka").is_none());
    assert!(
        storage
            .cached_manifest(&server.url(&channel_path("kvetka")))
            .unwrap()
            .is_none(),
        "the copy that no longer verifies is dropped"
    );
}
