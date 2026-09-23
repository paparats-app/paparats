//! The real catalog (M7, behind the `catalog` flag of `PAPARATS_REAL`): signed static JSON
//! manifests fetched over HTTPS, verified, cached in `paparats-storage` and served through
//! [`CatalogSource`] exactly like the embedded mock data set.
//!
//! - **Verify before trusting.** Every manifest is an [`crate::ManifestEnvelope`]. The official
//!   files (`channels.json`, `catalog.json`, `platform.json`, see [`wire`]) must be signed by a
//!   pinned official key. A channel's release manifest must be signed by an official key or — for
//!   a verified channel — by a key the signed directory pins for it. Community manifests may be
//!   unsigned or self-signed: they are kept on the typed community path with
//!   [`TrustWarning`]s and their download hosts are not allowlisted until the app says so
//!   ([`RemoteCatalog::trust_community_downloads`]). Package hashes are only ever read from a
//!   payload whose envelope has been opened.
//! - **Network allowlist.** Only first-party hosts ([`paparats_core::hosts`]), hosts the config
//!   allows explicitly, and channel manifest hosts from the verified directory are contacted;
//!   redirects are checked hop by hop. Download hosts from verified channel manifests join the
//!   same allowlist, which [`RemoteCatalog::allowlist`] shares with the download engine.
//! - **Caching.** The last verified copy of every manifest is stored with its `ETag`; requests
//!   revalidate with `If-None-Match`, and a `304` reuses the copy. A copy is verified again when
//!   it is loaded, so one that no longer verifies (a revoked key) is dropped.
//! - **Offline.** The catalog is loaded from the cache at start; a failed refresh keeps it. A
//!   channel that fails to sync is `Unreachable` for the days since its first failure, and after
//!   [`OUTAGE_AFTER_FAILURES`] failures in a row its `outage` is that first failure date.
//! - **No rollback.** A newer `generated` date is never replaced by an older one.
//!
//! [`CatalogSource`] is synchronous: it serves the verified in-memory snapshot. Network work
//! happens in [`RemoteCatalog::refresh`] and [`RemoteCatalog::sync_channel`].

mod http;
pub mod wire;

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, PoisonError, RwLock, RwLockReadGuard, RwLockWriteGuard};
use std::time::Duration;

use paparats_core::hosts::Allowlist;
use paparats_core::{
    Catalog, ChannelId, ChannelInfo, Package, PlatformInfo, SyncOutcome, TrustLevel, dates,
};
use paparats_storage::{CachedManifest, Storage};
use reqwest::Url;
use serde::de::DeserializeOwned;

use self::http::{Fetched, Fetcher, FetcherConfig, parse_url};
use self::wire::{CatalogManifest, ChannelDirectory, ChannelEntry, PlatformManifest};
use crate::envelope::{KeyRing, ManifestEnvelope, TrustWarning, open_community, parse_public_key};
use crate::{CatalogError, CatalogSource, ChannelManifest, hex};

/// Where the official manifests live.
pub const PRODUCTION_BASE_URL: &str = "https://cdn.paparats.app/v1/";

/// Official manifest signing keys as `(key id, public key)`. Empty until the release signing key
/// exists: production builds must pin it here; development builds pass keys through
/// [`RemoteConfig::with_official_keys`].
pub const OFFICIAL_KEYS: &[(&str, &str)] = &[];

/// Failed syncs in a row after which a channel counts as down (`outage` = first failure).
pub const OUTAGE_AFTER_FAILURES: u32 = 2;

/// Upper bound for one manifest (the full catalog is well under 1 MiB today).
pub const DEFAULT_MAX_MANIFEST_BYTES: u64 = 16 * 1024 * 1024;

/// The official files, relative to the base URL. The directory comes first: it pins the
/// channel keys and hosts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OfficialFile {
    Directory,
    Catalog,
    Platform,
}

impl OfficialFile {
    const ALL: [Self; 3] = [Self::Directory, Self::Catalog, Self::Platform];

    fn name(self) -> &'static str {
        match self {
            Self::Directory => "channels.json",
            Self::Catalog => "catalog.json",
            Self::Platform => "platform.json",
        }
    }
}

/// How the remote catalog is set up.
#[derive(Debug, Clone)]
pub struct RemoteConfig {
    /// Directory of the official manifests; must end with `/` (added when missing).
    pub base_url: String,
    /// Pinned official keys. Must not be empty.
    pub official_keys: KeyRing,
    /// Hosts that may be contacted, shared with the download engine. First-party hosts are
    /// always allowed; the verified directory and channel manifests add theirs at runtime.
    pub allowlist: Arc<RwLock<Allowlist>>,
    /// Honour `HTTP(S)_PROXY` from the environment.
    pub use_env_proxy: bool,
    pub connect_timeout: Duration,
    /// Whole request, body included.
    pub request_timeout: Duration,
    pub max_manifest_bytes: u64,
    pub outage_after_failures: u32,
}

impl RemoteConfig {
    /// `base_url` and `official_keys` with the default limits: 10 s to connect, 30 s per
    /// request, 16 MiB per manifest, environment proxy honoured.
    pub fn new(base_url: impl Into<String>, official_keys: KeyRing) -> Self {
        Self {
            base_url: base_url.into(),
            official_keys,
            allowlist: Arc::new(RwLock::new(Allowlist::new())),
            use_env_proxy: true,
            connect_timeout: Duration::from_secs(10),
            request_timeout: Duration::from_secs(30),
            max_manifest_bytes: DEFAULT_MAX_MANIFEST_BYTES,
            outage_after_failures: OUTAGE_AFTER_FAILURES,
        }
    }

    /// The production CDN and the keys in [`OFFICIAL_KEYS`].
    pub fn production() -> Result<Self, CatalogError> {
        let mut keys = KeyRing::new();
        for (id, key) in OFFICIAL_KEYS {
            keys.insert(id, parse_public_key(key)?)?;
        }
        Ok(Self::new(PRODUCTION_BASE_URL, keys))
    }

    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    pub fn with_official_keys(mut self, keys: KeyRing) -> Self {
        self.official_keys = keys;
        self
    }

    /// Shares `allowlist` (e.g. with the download engine's `HttpTransferConfig`).
    pub fn with_allowlist(mut self, allowlist: Arc<RwLock<Allowlist>>) -> Self {
        self.allowlist = allowlist;
        self
    }

    /// Allows one more host explicitly (a development base URL on loopback, a staging CDN).
    pub fn allow_host(self, host: &str) -> Self {
        write(&self.allowlist).allow(host);
        self
    }
}

/// Whether a fetch brought something new.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Freshness {
    /// A new verified copy was stored (200).
    Updated,
    /// The cached copy is current (304).
    NotModified,
}

/// Outcome of [`RemoteCatalog::refresh`], per official file. On an error the previous verified
/// copy (if any) stays in use.
#[derive(Debug)]
pub struct RefreshReport {
    pub directory: Result<Freshness, CatalogError>,
    pub catalog: Result<Freshness, CatalogError>,
    pub platform: Result<Freshness, CatalogError>,
}

impl RefreshReport {
    pub fn is_ok(&self) -> bool {
        self.directory.is_ok() && self.catalog.is_ok() && self.platform.is_ok()
    }
}

/// A channel's opened release manifest and what vouches for it.
#[derive(Debug, Clone, PartialEq)]
pub struct ChannelReleases {
    pub manifest: ChannelManifest,
    /// The channel's trust level in the directory.
    pub trust: TrustLevel,
    /// Empty when a pinned key verified the manifest; otherwise why it is not verified.
    pub warnings: Vec<TrustWarning>,
    self_signed_key: Option<String>,
}

impl ChannelReleases {
    /// Signed by a pinned key (official, or the verified channel's own).
    pub fn is_verified(&self) -> bool {
        self.warnings.is_empty()
    }

    pub fn package(&self, app_id: &str) -> Option<&Package> {
        self.manifest.packages.iter().find(|p| p.app_id == app_id)
    }

    /// Hosts of the download URLs.
    pub fn download_hosts(&self) -> BTreeSet<String> {
        self.manifest
            .packages
            .iter()
            .filter_map(|p| p.url.as_deref())
            .filter_map(|u| Url::parse(u).ok())
            .filter_map(|u| u.host_str().map(str::to_owned))
            .collect()
    }
}

/// One release as the download queue should take it, with its provenance.
#[derive(Debug, Clone, PartialEq)]
pub struct ChannelPackage {
    pub channel_id: ChannelId,
    pub package: Package,
    pub trust: TrustLevel,
    /// Non-empty = the hash and URL come from an unverified (community) manifest: show the
    /// community warning, never present it as verified.
    pub warnings: Vec<TrustWarning>,
}

#[derive(Debug, Default)]
struct Snapshot {
    directory: Option<ChannelDirectory>,
    catalog: Option<CatalogManifest>,
    platform: Option<PlatformManifest>,
    channels: BTreeMap<ChannelId, ChannelReleases>,
}

/// A verified official file.
enum Official {
    Directory(ChannelDirectory),
    Catalog(Box<CatalogManifest>),
    Platform(PlatformManifest),
}

impl Official {
    fn generated(&self) -> &str {
        match self {
            Official::Directory(m) => &m.generated,
            Official::Catalog(m) => &m.generated,
            Official::Platform(m) => &m.generated,
        }
    }
}

impl Snapshot {
    /// `generated` of the verified copy of `file` in use.
    fn generated(&self, file: OfficialFile) -> Option<&str> {
        match file {
            OfficialFile::Directory => self.directory.as_ref().map(|m| m.generated.as_str()),
            OfficialFile::Catalog => self.catalog.as_ref().map(|m| m.generated.as_str()),
            OfficialFile::Platform => self.platform.as_ref().map(|m| m.generated.as_str()),
        }
    }
}

fn read<T>(lock: &RwLock<T>) -> RwLockReadGuard<'_, T> {
    // Every write replaces whole values, so a panic elsewhere cannot leave a torn snapshot.
    lock.read().unwrap_or_else(PoisonError::into_inner)
}

fn write<T>(lock: &RwLock<T>) -> RwLockWriteGuard<'_, T> {
    lock.write().unwrap_or_else(PoisonError::into_inner)
}

fn parse_payload<T: DeserializeOwned>(payload: &[u8]) -> Result<T, CatalogError> {
    serde_json::from_slice(payload).map_err(CatalogError::MalformedManifest)
}

/// Rejects an older `generated` date than the verified copy's.
fn check_rollback(cached: Option<&str>, received: &str) -> Result<(), CatalogError> {
    dates::parse(received)?;
    match cached {
        Some(cached) if received < cached => Err(CatalogError::Rollback {
            cached: cached.to_owned(),
            received: received.to_owned(),
        }),
        _ => Ok(()),
    }
}

/// Every package with a URL must name an allowed-scheme URL and a SHA-256.
fn validate_packages(manifest: &ChannelManifest) -> Result<(), CatalogError> {
    for p in &manifest.packages {
        let invalid = |reason: &str| CatalogError::InvalidPackage {
            app_id: p.app_id.clone(),
            reason: reason.to_owned(),
        };
        let Some(url) = p.url.as_deref() else {
            continue;
        };
        parse_url(url).map_err(|e| invalid(&e.to_string()))?;
        let hash_ok = p
            .sha256
            .as_deref()
            .is_some_and(|h| h.len() == 64 && hex::decode(h).is_some());
        if !hash_ok {
            return Err(invalid("missing or malformed SHA-256"));
        }
    }
    Ok(())
}

/// Days since the first failure, at least 1 (like [`crate::down_days`]).
fn days_since(first_failure: &str, today: &str) -> u32 {
    let days = dates::days_between(first_failure, today)
        .unwrap_or(1)
        .max(1);
    u32::try_from(days).unwrap_or(u32::MAX)
}

/// The keys a verified channel's manifest may be signed with, from its directory entry.
fn channel_keys(entry: &ChannelEntry) -> KeyRing {
    let mut ring = KeyRing::new();
    if entry.info.trust != TrustLevel::Verified {
        return ring;
    }
    for key in &entry.keys {
        match parse_public_key(&key.public_key) {
            Ok(parsed) => {
                if let Err(e) = ring.insert(&key.id, parsed) {
                    tracing::warn!(channel = %entry.info.id, error = %e, "skipping a channel key");
                }
            }
            Err(e) => {
                tracing::warn!(channel = %entry.info.id, error = %e, "skipping a channel key");
            }
        }
    }
    ring
}

/// Signed manifests from the CDN, verified and cached. Share it behind an `Arc`.
pub struct RemoteCatalog {
    base: Url,
    official: KeyRing,
    allowlist: Arc<RwLock<Allowlist>>,
    fetcher: Fetcher,
    storage: Arc<Storage>,
    outage_after_failures: u32,
    snapshot: RwLock<Snapshot>,
}

impl std::fmt::Debug for RemoteCatalog {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RemoteCatalog")
            .field("base", &self.base.as_str())
            .finish_non_exhaustive()
    }
}

impl RemoteCatalog {
    /// Sets up the client and loads the last verified copies from `storage` (no network).
    pub fn new(config: RemoteConfig, storage: Arc<Storage>) -> Result<Self, CatalogError> {
        if config.official_keys.is_empty() {
            return Err(CatalogError::NoTrustedKeys);
        }
        let mut base_text = config.base_url.trim().to_owned();
        if !base_text.ends_with('/') {
            base_text.push('/');
        }
        let base = parse_url(&base_text)?;
        let fetcher = Fetcher::new(FetcherConfig {
            allowlist: Arc::clone(&config.allowlist),
            use_env_proxy: config.use_env_proxy,
            connect_timeout: config.connect_timeout,
            request_timeout: config.request_timeout,
            max_bytes: config.max_manifest_bytes,
        })?;
        let catalog = Self {
            base,
            official: config.official_keys,
            allowlist: config.allowlist,
            fetcher,
            storage,
            outage_after_failures: config.outage_after_failures.max(1),
            snapshot: RwLock::new(Snapshot::default()),
        };
        catalog.load_cache()?;
        Ok(catalog)
    }

    /// The allowlist this catalog extends; hand it to the download engine.
    pub fn allowlist(&self) -> Arc<RwLock<Allowlist>> {
        Arc::clone(&self.allowlist)
    }

    /// Whether a verified catalog is available (fetched or cached).
    pub fn has_catalog(&self) -> bool {
        read(&self.snapshot).catalog.is_some()
    }

    fn official_url(&self, file: OfficialFile) -> Result<Url, CatalogError> {
        self.base
            .join(file.name())
            .map_err(|e| CatalogError::InvalidUrl(e.to_string()))
    }

    // -- Official files ------------------------------------------------------------------------

    /// Opens an official file's envelope and parses it; with `fresh`, also refuses a rollback.
    fn open_official(
        &self,
        file: OfficialFile,
        body: &[u8],
        fresh: bool,
    ) -> Result<Official, CatalogError> {
        let payload = self.official.open(&ManifestEnvelope::from_slice(body)?)?;
        let official = match file {
            OfficialFile::Directory => Official::Directory(parse_payload(&payload)?),
            OfficialFile::Catalog => Official::Catalog(Box::new(parse_payload(&payload)?)),
            OfficialFile::Platform => Official::Platform(parse_payload(&payload)?),
        };
        if fresh {
            let cached = read(&self.snapshot).generated(file).map(str::to_owned);
            check_rollback(cached.as_deref(), official.generated())?;
        } else {
            dates::parse(official.generated())?;
        }
        Ok(official)
    }

    fn install_official(&self, official: Official) {
        match official {
            Official::Directory(directory) => self.install_directory(directory),
            Official::Catalog(m) => write(&self.snapshot).catalog = Some(*m),
            Official::Platform(m) => write(&self.snapshot).platform = Some(m),
        }
    }

    /// Allows the channel manifest hosts of a verified directory, then re-opens the cached
    /// channel manifests against it (a channel whose keys or trust changed is re-checked).
    fn install_directory(&self, directory: ChannelDirectory) {
        {
            let mut allow = write(&self.allowlist);
            for entry in &directory.channels {
                match parse_url(&entry.manifest_url) {
                    Ok(url) => {
                        if let Some(host) = url.host_str() {
                            allow.allow(host);
                        }
                    }
                    Err(e) => {
                        tracing::warn!(channel = %entry.info.id, error = %e, "channel manifest URL rejected");
                    }
                }
            }
        }
        let entries = directory.channels.clone();
        {
            let mut snap = write(&self.snapshot);
            snap.directory = Some(directory);
            snap.channels.clear();
        }
        for entry in &entries {
            if let Err(e) = self.load_cached_channel(entry) {
                tracing::warn!(channel = %entry.info.id, error = %e, "cached channel manifest not loaded");
            }
        }
    }

    /// Loads one official file from the cache; a copy that no longer verifies is dropped.
    fn load_cached_official(&self, file: OfficialFile) -> Result<(), CatalogError> {
        let url = self.official_url(file)?;
        let Some(cached) = self.storage.cached_manifest(url.as_str())? else {
            return Ok(());
        };
        match self.open_official(file, &cached.body, false) {
            Ok(official) => self.install_official(official),
            Err(e) => {
                tracing::warn!(file = file.name(), error = %e, "dropping a cached manifest that no longer verifies");
                self.storage.remove_cached_manifest(url.as_str())?;
            }
        }
        Ok(())
    }

    fn load_cache(&self) -> Result<(), CatalogError> {
        for file in OfficialFile::ALL {
            self.load_cached_official(file)?;
        }
        Ok(())
    }

    async fn refresh_official(
        &self,
        file: OfficialFile,
        today: &str,
    ) -> Result<Freshness, CatalogError> {
        let url = self.official_url(file)?;
        let cached = self.storage.cached_manifest(url.as_str())?;
        let etag = cached.as_ref().and_then(|c| c.etag.as_deref());
        match self.fetcher.get(&url, etag).await? {
            Fetched::NotModified => {
                let Some(cached) = cached else {
                    return Err(CatalogError::Http(304));
                };
                // The copy in use was verified when it was loaded or fetched.
                let loaded = read(&self.snapshot).generated(file).is_some();
                if !loaded {
                    match self.open_official(file, &cached.body, false) {
                        Ok(official) => self.install_official(official),
                        Err(e) => {
                            self.storage.remove_cached_manifest(url.as_str())?;
                            return Err(e);
                        }
                    }
                }
                self.storage.touch_cached_manifest(url.as_str(), today)?;
                Ok(Freshness::NotModified)
            }
            Fetched::Fresh { body, etag } => {
                let official = self.open_official(file, &body, true)?;
                self.storage.put_cached_manifest(&CachedManifest {
                    url: url.to_string(),
                    etag,
                    body,
                    fetched: today.to_owned(),
                })?;
                self.install_official(official);
                Ok(Freshness::Updated)
            }
        }
    }

    async fn refresh_logged(
        &self,
        file: OfficialFile,
        today: &str,
    ) -> Result<Freshness, CatalogError> {
        let result = self.refresh_official(file, today).await;
        match &result {
            Ok(freshness) => tracing::info!(file = file.name(), ?freshness, "manifest refreshed"),
            Err(e) => tracing::warn!(
                file = file.name(),
                error = %e,
                "manifest refresh failed; keeping the cached copy"
            ),
        }
        result
    }

    /// Fetches the directory, the catalog and the platform file (conditionally). Whatever fails
    /// keeps its last verified copy; nothing unverified is ever installed.
    pub async fn refresh(&self, today: &str) -> RefreshReport {
        RefreshReport {
            directory: self.refresh_logged(OfficialFile::Directory, today).await,
            catalog: self.refresh_logged(OfficialFile::Catalog, today).await,
            platform: self.refresh_logged(OfficialFile::Platform, today).await,
        }
    }

    // -- Channels ------------------------------------------------------------------------------

    /// The directory entry of `channel_id`.
    pub fn directory_entry(&self, channel_id: &str) -> Option<ChannelEntry> {
        read(&self.snapshot)
            .directory
            .as_ref()
            .and_then(|d| d.channels.iter().find(|c| c.info.id == channel_id))
            .cloned()
    }

    /// Opens a channel manifest with the rules of the channel's trust level.
    fn open_channel(
        &self,
        entry: &ChannelEntry,
        body: &[u8],
        previous_key: Option<&str>,
    ) -> Result<ChannelReleases, CatalogError> {
        let envelope = ManifestEnvelope::from_slice(body)?;
        let (payload, warnings, self_signed_key) = match entry.info.trust {
            TrustLevel::Official => (self.official.open(&envelope)?, Vec::new(), None),
            TrustLevel::Verified => (
                self.official.merged(&channel_keys(entry)).open(&envelope)?,
                Vec::new(),
                None,
            ),
            TrustLevel::Community => {
                let opened = open_community(&self.official, &envelope, previous_key)?;
                (opened.payload, opened.warnings, opened.self_signed_key)
            }
        };
        let manifest: ChannelManifest = parse_payload(&payload)?;
        if manifest.channel_id != entry.info.id {
            return Err(CatalogError::ChannelMismatch {
                expected: entry.info.id.clone(),
                found: manifest.channel_id,
            });
        }
        dates::parse(&manifest.generated)?;
        validate_packages(&manifest)?;
        Ok(ChannelReleases {
            manifest,
            trust: entry.info.trust,
            warnings,
            self_signed_key,
        })
    }

    /// Makes `releases` current; a verified manifest's download hosts join the allowlist.
    fn install_channel(&self, releases: ChannelReleases) {
        if releases.is_verified() {
            let mut allow = write(&self.allowlist);
            for host in releases.download_hosts() {
                allow.allow(&host);
            }
        } else {
            tracing::info!(
                channel = %releases.manifest.channel_id,
                warnings = ?releases.warnings,
                "community manifest kept unverified"
            );
        }
        write(&self.snapshot)
            .channels
            .insert(releases.manifest.channel_id.clone(), releases);
    }

    fn load_cached_channel(&self, entry: &ChannelEntry) -> Result<(), CatalogError> {
        let url = parse_url(&entry.manifest_url)?;
        let Some(cached) = self.storage.cached_manifest(url.as_str())? else {
            return Ok(());
        };
        match self.open_channel(entry, &cached.body, None) {
            Ok(releases) => self.install_channel(releases),
            Err(e) => {
                tracing::warn!(channel = %entry.info.id, error = %e, "dropping a cached channel manifest that no longer verifies");
                self.storage.remove_cached_manifest(url.as_str())?;
            }
        }
        Ok(())
    }

    async fn fetch_channel(
        &self,
        entry: &ChannelEntry,
        today: &str,
    ) -> Result<Freshness, CatalogError> {
        let url = parse_url(&entry.manifest_url)?;
        let cached = self.storage.cached_manifest(url.as_str())?;
        let etag = cached.as_ref().and_then(|c| c.etag.as_deref());
        let previous = read(&self.snapshot).channels.get(&entry.info.id).cloned();
        let previous_key = previous.as_ref().and_then(|r| r.self_signed_key.as_deref());
        match self.fetcher.get(&url, etag).await? {
            Fetched::NotModified => {
                let Some(cached) = cached else {
                    return Err(CatalogError::Http(304));
                };
                let releases = match self.open_channel(entry, &cached.body, previous_key) {
                    Ok(releases) => releases,
                    Err(e) => {
                        self.storage.remove_cached_manifest(url.as_str())?;
                        return Err(e);
                    }
                };
                self.storage.touch_cached_manifest(url.as_str(), today)?;
                self.install_channel(releases);
                Ok(Freshness::NotModified)
            }
            Fetched::Fresh { body, etag } => {
                let releases = self.open_channel(entry, &body, previous_key)?;
                check_rollback(
                    previous.as_ref().map(|r| r.manifest.generated.as_str()),
                    &releases.manifest.generated,
                )?;
                self.storage.put_cached_manifest(&CachedManifest {
                    url: url.to_string(),
                    etag,
                    body,
                    fetched: today.to_owned(),
                })?;
                self.install_channel(releases);
                Ok(Freshness::Updated)
            }
        }
    }

    /// "Sync now" (and background sync) for one channel: fetch, verify and cache its release
    /// manifest. Success stamps `synced = today` and ends any failure streak. Any failure —
    /// network, HTTP, signature, a malformed or rolled-back manifest — keeps the cached copy,
    /// extends the streak and answers `Unreachable` with the days since its first failure.
    /// Only local problems (the database) are errors.
    pub async fn sync_channel(
        &self,
        channel_id: &str,
        today: &str,
    ) -> Result<SyncOutcome, CatalogError> {
        let entry = self
            .directory_entry(channel_id)
            .ok_or_else(|| CatalogError::UnknownChannel(channel_id.to_owned()))?;
        match self.fetch_channel(&entry, today).await {
            Ok(freshness) => {
                tracing::info!(channel = channel_id, ?freshness, "channel synced");
                self.storage.record_channel_success(channel_id, today)?;
                Ok(SyncOutcome::Synced {
                    at: today.to_owned(),
                })
            }
            Err(CatalogError::Storage(e)) => Err(CatalogError::Storage(e)),
            Err(e) => {
                let health = self.storage.record_channel_failure(channel_id, today)?;
                tracing::warn!(
                    channel = channel_id,
                    failures = health.failures,
                    error = %e,
                    "channel sync failed; keeping the cached copy"
                );
                Ok(SyncOutcome::Unreachable {
                    days: days_since(&health.first_failure, today),
                })
            }
        }
    }

    /// Syncs several channels one after another (e.g. the active subscriptions at start).
    pub async fn sync_channels(
        &self,
        channel_ids: &[ChannelId],
        today: &str,
    ) -> Vec<(ChannelId, Result<SyncOutcome, CatalogError>)> {
        let mut out = Vec::with_capacity(channel_ids.len());
        for id in channel_ids {
            out.push((id.clone(), self.sync_channel(id, today).await));
        }
        out
    }

    /// The last opened release manifest of a channel (fetched or cached).
    pub fn channel_releases(&self, channel_id: &str) -> Option<ChannelReleases> {
        read(&self.snapshot).channels.get(channel_id).cloned()
    }

    /// The release of `app_id` that `channel_id` publishes, with its provenance.
    pub fn package(&self, channel_id: &str, app_id: &str) -> Option<ChannelPackage> {
        let snap = read(&self.snapshot);
        let releases = snap.channels.get(channel_id)?;
        Some(ChannelPackage {
            channel_id: channel_id.to_owned(),
            package: releases.package(app_id)?.clone(),
            trust: releases.trust,
            warnings: releases.warnings.clone(),
        })
    }

    /// Allows the download hosts of a community channel's (unverified) manifest. Call only
    /// after the user explicitly accepted the channel (the community confirmation on follow);
    /// returns the hosts allowed.
    pub fn trust_community_downloads(&self, channel_id: &str) -> Result<Vec<String>, CatalogError> {
        let hosts = read(&self.snapshot)
            .channels
            .get(channel_id)
            .map(ChannelReleases::download_hosts)
            .ok_or_else(|| CatalogError::UnknownChannel(channel_id.to_owned()))?;
        let mut allow = write(&self.allowlist);
        for host in &hosts {
            allow.allow(host);
        }
        Ok(hosts.into_iter().collect())
    }
}

impl CatalogSource for RemoteCatalog {
    fn catalog(&self) -> Result<Catalog, CatalogError> {
        read(&self.snapshot)
            .catalog
            .as_ref()
            .map(|m| m.catalog.clone())
            .ok_or(CatalogError::Unavailable("catalog"))
    }

    fn platform(&self) -> Result<PlatformInfo, CatalogError> {
        read(&self.snapshot)
            .platform
            .as_ref()
            .map(|m| m.platform.clone())
            .ok_or(CatalogError::Unavailable("platform"))
    }

    /// The directory's channels with what this machine knows: the last successful sync, and an
    /// outage from the local failure streak (the CDN cannot know whether *this* client reaches a
    /// channel). Channels never synced here keep the published values.
    fn channels(&self) -> Result<Vec<ChannelInfo>, CatalogError> {
        let entries: Vec<ChannelInfo> = read(&self.snapshot)
            .directory
            .as_ref()
            .map(|d| d.channels.iter().map(|e| e.info.clone()).collect())
            .ok_or(CatalogError::Unavailable("channel directory"))?;
        let synced = self.storage.channel_sync_dates()?;
        let health = self.storage.channel_health()?;
        Ok(entries
            .into_iter()
            .map(|mut info| {
                let known_here = synced.contains_key(&info.id) || health.contains_key(&info.id);
                if let Some(date) = synced.get(&info.id) {
                    info.synced = Some(date.clone());
                }
                if known_here {
                    info.outage = health
                        .get(&info.id)
                        .filter(|h| h.failures >= self.outage_after_failures)
                        .map(|h| h.first_failure.clone());
                }
                info
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rollback_rule() {
        assert!(check_rollback(None, "2026-09-15").is_ok());
        assert!(check_rollback(Some("2026-09-15"), "2026-09-15").is_ok());
        assert!(check_rollback(Some("2026-09-15"), "2026-09-16").is_ok());
        assert!(matches!(
            check_rollback(Some("2026-09-15"), "2026-09-14"),
            Err(CatalogError::Rollback { .. })
        ));
        assert!(matches!(
            check_rollback(None, "yesterday"),
            Err(CatalogError::Date(_))
        ));
    }

    #[test]
    fn days_since_the_first_failure() {
        assert_eq!(days_since("2026-09-15", "2026-09-15"), 1);
        assert_eq!(days_since("2026-08-30", "2026-09-15"), 16);
        assert_eq!(days_since("2026-09-20", "2026-09-15"), 1);
        assert_eq!(days_since("garbage", "2026-09-15"), 1);
    }

    fn manifest(url: Option<&str>, sha: Option<&str>) -> ChannelManifest {
        ChannelManifest {
            channel_id: "nilesoft".into(),
            generated: "2026-09-15".into(),
            packages: vec![Package {
                app_id: "shell".into(),
                version: "1.9.15".into(),
                url: url.map(str::to_owned),
                sha256: sha.map(str::to_owned),
                size_bytes: 1,
                strategy: paparats_core::InstallStrategy::Msi,
                signer: None,
            }],
        }
    }

    #[test]
    fn packages_need_safe_urls_and_hashes() {
        let hash = "ab".repeat(32);
        let url = "https://downloads.nilesoft.org/shell.msi";
        assert!(validate_packages(&manifest(Some(url), Some(&hash))).is_ok());
        assert!(validate_packages(&manifest(None, None)).is_ok(), "no file");
        for bad in [
            manifest(Some(url), None),
            manifest(Some(url), Some("abc")),
            manifest(Some(url), Some(&"zz".repeat(32))),
            manifest(Some("http://downloads.nilesoft.org/shell.msi"), Some(&hash)),
            manifest(Some("file:///C:/Windows/notepad.exe"), Some(&hash)),
        ] {
            assert!(matches!(
                validate_packages(&bad),
                Err(CatalogError::InvalidPackage { .. })
            ));
        }
        let releases = ChannelReleases {
            manifest: manifest(Some(url), Some(&hash)),
            trust: TrustLevel::Verified,
            warnings: vec![],
            self_signed_key: None,
        };
        assert!(releases.is_verified());
        assert_eq!(
            releases.download_hosts().into_iter().collect::<Vec<_>>(),
            ["downloads.nilesoft.org"]
        );
        assert!(releases.package("shell").is_some());
        assert!(releases.package("vlc").is_none());
    }

    #[test]
    fn configs() {
        let config = RemoteConfig::production().unwrap();
        assert_eq!(config.base_url, PRODUCTION_BASE_URL);
        assert_eq!(config.official_keys.len(), OFFICIAL_KEYS.len());
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        if OFFICIAL_KEYS.is_empty() {
            assert!(matches!(
                RemoteCatalog::new(config.clone(), Arc::clone(&storage)),
                Err(CatalogError::NoTrustedKeys)
            ));
        }
        let config = config.allow_host("127.0.0.1");
        assert!(read(&config.allowlist).is_allowed("127.0.0.1"));
    }

    #[test]
    fn can_be_shared_and_driven_from_spawned_tasks() {
        fn send_sync<T: Send + Sync>(_: &T) {}
        fn send<T: Send>(_: &T) {}
        let key = ed25519_dalek::SigningKey::from_bytes(&[3; 32]).verifying_key();
        let config = RemoteConfig::new(PRODUCTION_BASE_URL, KeyRing::new().with("k", key).unwrap());
        let remote =
            RemoteCatalog::new(config, Arc::new(Storage::open_in_memory().unwrap())).unwrap();
        send_sync(&remote);
        // Futures are built, never polled: no network.
        send(&remote.refresh("2026-09-15"));
        send(&remote.sync_channel("nilesoft", "2026-09-15"));
        send(&remote.sync_channels(&[], "2026-09-15"));
    }
}
