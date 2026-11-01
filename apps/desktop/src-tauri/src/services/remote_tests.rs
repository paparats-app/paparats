//! `PAPARATS_REAL=catalog` through the app state, end to end, against a small local CDN: the
//! flags' development overrides (`PAPARATS_CATALOG_URL`, `PAPARATS_CATALOG_KEYS`), catalog reads
//! waiting for the first refresh, the startup sync of the followed channels, "Sync now" going to
//! the CDN, and a download of a package from a signed channel manifest (fetched over HTTP,
//! checked against its SHA-256, then installed by the simulated installer).

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use ed25519_dalek::SigningKey;
use paparats_catalog::{
    CatalogManifest, ChannelDirectory, ChannelEntry, ChannelManifest, EmbeddedCatalog,
    PlatformManifest, sign_envelope,
};
use paparats_core::{
    DownloadKind, DownloadPhase, DownloadRequest, InstallStrategy, Package, SyncOutcome,
};
use paparats_install::SimulatedInstaller;
use paparats_storage::Storage;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

use super::testing::{Recorder, TODAY, state_with};
use super::{AppState, NoBrowser, RealPaths, Strategies};
use crate::error::AppError;
use crate::flags::{CatalogEnv, RealFlags};

type Routes = Arc<Mutex<HashMap<String, Vec<u8>>>>;

/// Answers `GET <path>` with the body set for it, 404 otherwise.
struct Cdn {
    addr: SocketAddr,
    routes: Routes,
}

impl Cdn {
    async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let routes: Routes = Arc::default();
        let served = Arc::clone(&routes);
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let routes = Arc::clone(&served);
                tokio::spawn(async move {
                    let _ = serve(stream, &routes).await;
                });
            }
        });
        Self { addr, routes }
    }

    fn url(&self, path: &str) -> String {
        format!("http://{}{path}", self.addr)
    }

    fn set(&self, path: &str, body: Vec<u8>) {
        self.routes.lock().unwrap().insert(path.to_owned(), body);
    }

    fn remove(&self, path: &str) {
        self.routes.lock().unwrap().remove(path);
    }
}

async fn serve(stream: TcpStream, routes: &Routes) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream);
    let mut request = String::new();
    reader.read_line(&mut request).await?;
    let path = request.split_whitespace().nth(1).unwrap_or("/").to_owned();
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header).await? == 0 || header.trim().is_empty() {
            break;
        }
    }
    let body = routes.lock().unwrap().get(&path).cloned();
    let (status, body) = match body {
        Some(body) => (200, body),
        None => (404, Vec::new()),
    };
    let head = format!(
        "HTTP/1.1 {status} X\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let mut stream = reader.into_inner();
    stream.write_all(head.as_bytes()).await?;
    stream.write_all(&body).await?;
    stream.shutdown().await
}

fn official() -> SigningKey {
    SigningKey::from_bytes(&[1; 32])
}

fn signed<T: serde::Serialize>(value: &T) -> Vec<u8> {
    let payload = serde_json::to_vec(value).unwrap();
    serde_json::to_vec(&sign_envelope(&official(), "test", &payload)).unwrap()
}

/// The bytes of the one real package (`obs`, portable ZIP, from the official channel).
const OBS_FILE: &[u8] = b"PK\x05\x06 not really an archive; the simulated installer never opens it";
const OBS_VERSION: &str = "31.1.3";

/// Publishes the mock data set as signed official files, and a signed manifest per channel. The
/// official channel's lists `obs` with a download on this CDN.
fn publish(cdn: &Cdn) {
    let world = EmbeddedCatalog::load().unwrap();
    let directory = ChannelDirectory {
        generated: TODAY.into(),
        channels: world
            .channels_ref()
            .iter()
            .map(|info| ChannelEntry {
                info: info.clone(),
                manifest_url: cdn.url(&format!("/channels/{}.json", info.id)),
                keys: Vec::new(),
            })
            .collect(),
    };
    cdn.set("/v1/channels.json", signed(&directory));
    cdn.set(
        "/v1/catalog.json",
        signed(&CatalogManifest {
            generated: TODAY.into(),
            catalog: world.catalog_ref().clone(),
        }),
    );
    cdn.set(
        "/v1/platform.json",
        signed(&PlatformManifest {
            generated: TODAY.into(),
            platform: world.platform_ref().clone(),
        }),
    );
    let sha256: String = Sha256::digest(OBS_FILE)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    for info in world.channels_ref() {
        let packages = if info.id == "paparats" {
            vec![Package {
                app_id: "obs".into(),
                version: OBS_VERSION.into(),
                url: Some(cdn.url("/files/obs-31.1.3.zip")),
                sha256: Some(sha256.clone()),
                size_bytes: OBS_FILE.len() as u64,
                strategy: InstallStrategy::PortableZip,
                signer: None,
                unsigned: false,
                machine_wide: false,
                launch: None,
            }]
        } else {
            Vec::new()
        };
        let manifest = ChannelManifest {
            channel_id: info.id.clone(),
            generated: TODAY.into(),
            packages,
        };
        cdn.set(&format!("/channels/{}.json", info.id), signed(&manifest));
    }
    cdn.set("/files/obs-31.1.3.zip", OBS_FILE.to_vec());
}

/// The app state as `PAPARATS_REAL=catalog` with the development overrides builds it (fast
/// simulated installs).
fn remote_state(cdn: &Cdn, downloads: &std::path::Path) -> (Arc<AppState>, Arc<Recorder>) {
    let storage = Arc::new(Storage::open_in_memory().unwrap());
    // The followed channels and the account of the demo data set (a real first run follows only
    // the official catalog).
    storage.seed_from_fixtures().unwrap();
    let key = paparats_catalog::hex::encode(official().verifying_key().as_bytes());
    let env = CatalogEnv {
        base_url: Some(cdn.url("/v1/")),
        keys: Some(format!("test:{key}")),
    };
    let mut strategies = Strategies::from_flags(
        RealFlags {
            catalog: true,
            ..RealFlags::default()
        },
        &env,
        &storage,
        &RealPaths {
            downloads: downloads.to_path_buf(),
        },
        Arc::new(NoBrowser),
    )
    .unwrap();
    assert!(strategies.flags.catalog, "the remote catalog is running");
    strategies.installer = Arc::new(SimulatedInstaller::with_timing(Duration::from_millis(1), 1));
    let (state, recorder) = state_with(storage, strategies);
    (Arc::new(state), recorder)
}

async fn eventually(what: &str, mut done: impl FnMut() -> bool) {
    for _ in 0..500 {
        if done() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("timed out waiting for {what}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_remote_catalog_runs_the_app() {
    let cdn = Cdn::start().await;
    publish(&cdn);
    let dir = tempfile::tempdir().unwrap();
    let (s, rec) = remote_state(&cdn, &dir.path().join("downloads"));

    // Nothing cached yet: the UI's first reads wait for the first refresh.
    let reading = tokio::spawn({
        let s = Arc::clone(&s);
        async move { s.get_catalog().await }
    });
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(!reading.is_finished(), "waits for the refresh");
    s.startup().await;
    assert_eq!(reading.await.unwrap().unwrap().apps.len(), 32);
    assert_eq!(s.get_platform().await.unwrap().plans.len(), 3);

    // Startup synced the followed channels (paparats, kvetka, fossfriends) with the CDN.
    let channels = s.get_channels().await.unwrap();
    assert_eq!(channels.len(), 6);
    let synced = |id: &str| {
        channels
            .iter()
            .find(|c| c.id == id)
            .and_then(|c| c.synced.clone())
    };
    assert_eq!(synced("paparats").as_deref(), Some(TODAY));
    assert_eq!(synced("kvetka").as_deref(), Some(TODAY));

    // "Sync now" asks the CDN: a manifest that is gone is unreachable, an unknown channel is
    // not found.
    assert!(matches!(
        s.sync_channel("paparats").await.unwrap(),
        SyncOutcome::Synced { .. }
    ));
    cdn.remove("/channels/vitrazh.json");
    assert_eq!(
        s.sync_channel("vitrazh").await.unwrap(),
        SyncOutcome::Unreachable { days: 1 }
    );
    assert!(matches!(
        s.sync_channel("ghost").await,
        Err(AppError::NotFound(_))
    ));

    // `obs` comes from the official channel's signed manifest: a real, hash-checked download.
    // `inkscape` is in no manifest: simulated, as before.
    let request = |app: &str, version: &str| DownloadRequest {
        app_id: app.into(),
        version: version.into(),
        size_mb: 1.0,
        kind: DownloadKind::Install,
    };
    s.enqueue_downloads(vec![request("obs", "31.1.2"), request("inkscape", "1.4.2")]);
    let installed = |app: &str| {
        rec.states
            .lock()
            .unwrap()
            .iter()
            .any(|c| c.app_id == app && matches!(c.phase, DownloadPhase::Installed { .. }))
    };
    let failed = || {
        rec.states
            .lock()
            .unwrap()
            .iter()
            .find_map(|c| match &c.phase {
                DownloadPhase::Failed { message } => Some(message.clone()),
                _ => None,
            })
    };
    eventually("both installs", || {
        (installed("obs") && installed("inkscape")) || failed().is_some()
    })
    .await;
    assert_eq!(failed(), None);
    let lib = s.get_library().await.unwrap();
    let version = |app: &str| {
        lib.installed
            .iter()
            .find(|a| a.app_id == app)
            .map(|a| a.version.clone())
    };
    assert_eq!(
        version("obs").as_deref(),
        Some(OBS_VERSION),
        "the manifest's release"
    );
    assert_eq!(version("inkscape").as_deref(), Some("1.4.2"), "simulated");
    let left: Vec<_> = std::fs::read_dir(dir.path().join("downloads"))
        .unwrap()
        .collect();
    assert!(left.is_empty(), "installed packages are not kept");
}
