//! The service layer behind the Tauri commands: one method per method of the TypeScript
//! service contracts (`apps/desktop/src/services/contracts.ts`), with the same semantics as the
//! in-memory mocks (`services/mock/*`). Plain Rust — no Tauri types — so it is unit-tested here.
//!
//! Each service runs on the strategy [`wiring::Strategies`] picked at startup: the simulated mock
//! world by default, real ones per `PAPARATS_REAL` flag (M7, [`crate::flags`]).

mod account;
mod catalog;
mod channels;
mod downloads;
mod ideas;
mod install;
mod system;
pub mod wiring;

use std::future::Future;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use paparats_account::{AccountStore, Auth};
use paparats_catalog::{CatalogBackend, CatalogSource, rules};
use paparats_core::{Account, ChannelInfo, IsoDate, TrustLevel, dates};
use paparats_download::{Clock, DownloadEngine, EngineConfig};
use paparats_install::Installer;
use paparats_inventory::{Inventory, InventoryError};
use paparats_storage::Storage;
use tokio::runtime::Handle;
use tokio::sync::{broadcast, watch};

use crate::error::{AppError, AppResult};
use crate::events::{EngineBridge, UiEvents};
use crate::flags::RealFlags;

#[cfg(test)]
pub use wiring::NoBrowser;
pub use wiring::{Browser, RealPaths, Strategies};

/// How long a catalog read waits for the remote catalog's first refresh when nothing is cached.
const CATALOG_WAIT: Duration = Duration::from_secs(45);

/// Today's local calendar date.
pub fn system_clock() -> Clock {
    Arc::new(|| dates::format(chrono::Local::now().date_naive()))
}

/// How a browser sign-in ended, handed from the `paparats://auth/callback` link to the
/// `account_sign_in` call waiting for it.
type SignInResult = Result<Account, AppError>;

/// Everything the commands need, managed by Tauri.
pub struct AppState {
    storage: Arc<Storage>,
    flags: RealFlags,
    catalog: CatalogBackend,
    /// `true` once catalog reads can answer: at once for the embedded catalog or a cached remote
    /// one, after the first refresh otherwise.
    catalog_ready: Arc<watch::Sender<bool>>,
    inventory: Arc<dyn Inventory>,
    account: AccountStore,
    auth: Auth,
    browser: Arc<dyn Browser>,
    sign_ins: broadcast::Sender<SignInResult>,
    installer: Arc<dyn Installer>,
    engine: DownloadEngine,
    clock: Clock,
}

impl std::fmt::Debug for AppState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppState")
            .field("flags", &self.flags)
            .finish_non_exhaustive()
    }
}

impl AppState {
    /// Opens (or creates and seeds) the database at `db_path` and wires the strategies `build`
    /// picks over it ([`Strategies::from_flags`] in the app).
    pub fn open(
        db_path: &Path,
        ui: Arc<dyn UiEvents>,
        runtime: Handle,
        clock: Clock,
        build: impl FnOnce(&Arc<Storage>) -> AppResult<Strategies>,
    ) -> AppResult<Self> {
        let storage = Arc::new(Storage::open(db_path)?);
        let strategies = build(&storage)?;
        Self::new(storage, ui, runtime, clock, strategies)
    }

    /// Wires the state over an open database, seeding the mock world on first run (also under
    /// real strategies: subscriptions, ideas and the account snapshot stay local).
    pub fn new(
        storage: Arc<Storage>,
        ui: Arc<dyn UiEvents>,
        runtime: Handle,
        clock: Clock,
        strategies: Strategies,
    ) -> AppResult<Self> {
        if storage.seed_from_fixtures()? {
            tracing::info!("seeded the local database from the mock data set");
        }
        let Strategies {
            flags,
            catalog,
            inventory,
            installer,
            transfer,
            auth,
            browser,
        } = strategies;
        let bridge = EngineBridge {
            inventory: Arc::clone(&inventory),
            clock: Arc::clone(&clock),
            ui,
        };
        let engine = DownloadEngine::new(
            transfer,
            Arc::clone(&installer),
            Arc::new(bridge),
            EngineConfig::new(Arc::clone(&clock)),
            runtime,
        )?;
        let ready = !catalog.is_remote() || Self::remote_loaded(&catalog);
        let (catalog_ready, _) = watch::channel(ready);
        let (sign_ins, _) = broadcast::channel(4);
        if !flags.is_simulated() {
            tracing::info!(real = ?flags.names(), "real strategies (PAPARATS_REAL)");
        }
        // Real sign-in: the seeded (or stale) snapshot must not claim a session without tokens.
        if let Some(oauth) = auth.real()
            && let Err(e) = oauth.reconcile()
        {
            tracing::warn!(error = %e, "could not check the stored session");
        }
        Ok(Self {
            account: AccountStore::new(Arc::clone(&storage)),
            storage,
            flags,
            catalog,
            catalog_ready: Arc::new(catalog_ready),
            inventory,
            auth,
            browser,
            sign_ins,
            installer,
            engine,
            clock,
        })
    }

    /// The real strategies running.
    pub fn flags(&self) -> RealFlags {
        self.flags
    }

    /// Today's date (`YYYY-MM-DD`, local).
    pub fn today(&self) -> IsoDate {
        (self.clock)()
    }

    fn remote_loaded(catalog: &CatalogBackend) -> bool {
        catalog.catalog().is_ok() && catalog.platform().is_ok() && catalog.channels().is_ok()
    }

    /// Waits until catalog reads can answer (the remote catalog's first refresh when nothing was
    /// cached; at most [`CATALOG_WAIT`]). Immediate for the embedded catalog.
    pub async fn catalog_ready(&self) {
        let mut ready = self.catalog_ready.subscribe();
        if *ready.borrow() {
            return;
        }
        if tokio::time::timeout(CATALOG_WAIT, ready.wait_for(|r| *r))
            .await
            .is_err()
        {
            tracing::warn!("the remote catalog is still loading; answering without it");
        }
    }

    /// Channels as the client knows them now: published data plus the last local sync.
    fn channels_now(&self) -> AppResult<Vec<ChannelInfo>> {
        let synced = self.storage.channel_sync_dates()?;
        let mut channels = self.catalog.channels()?;
        for c in &mut channels {
            if let Some(date) = synced.get(&c.id) {
                c.synced = Some(date.clone());
            }
        }
        Ok(channels)
    }

    /// A channel as the client knows it now (published data + the last local sync).
    fn channel(&self, id: &str) -> AppResult<ChannelInfo> {
        self.channels_now()?
            .into_iter()
            .find(|c| c.id == id)
            .ok_or_else(|| AppError::not_found(format!("channel {id}")))
    }

    /// Runs `read` against the inventory on the blocking pool: the real inventory scans the
    /// registry and the MSIX packages (≈ 0.2 s whenever its short-lived cache has expired).
    async fn read_inventory<T, F>(&self, read: F) -> AppResult<T>
    where
        T: Send + 'static,
        F: FnOnce(&dyn Inventory) -> Result<T, InventoryError> + Send + 'static,
    {
        let inventory = Arc::clone(&self.inventory);
        Ok(
            tokio::task::spawn_blocking(move || read(inventory.as_ref()))
                .await
                .map_err(|_| AppError::internal_message("the inventory scan stopped"))??,
        )
    }

    /// The inventory's installed apps, read on the calling thread (tests that look at the library
    /// from inside a synchronous event listener).
    #[cfg(test)]
    pub fn installed_now(&self) -> AppResult<Vec<paparats_core::InstalledApp>> {
        Ok(self.inventory.installed()?)
    }

    /// With the remote catalog: allows the download hosts of a followed community channel.
    fn allow_community_downloads(&self, channel_id: &str) {
        allow_community_downloads(&self.catalog, &self.storage, channel_id);
    }

    /// Work that starts with the app and runs in the background: the remote catalog's refresh
    /// (then the inventory learns its apps and the active channels sync), warming the real
    /// inventory's scan, and the signed-in profile from the account API. Nothing in the default
    /// run.
    pub fn startup(&self) -> impl Future<Output = ()> + Send + 'static {
        let remote = self.catalog.remote().cloned();
        let catalog = self.catalog.clone();
        let ready = Arc::clone(&self.catalog_ready);
        let inventory = Arc::clone(&self.inventory);
        let storage = Arc::clone(&self.storage);
        let warm_inventory = self.flags.inventory;
        let oauth = self.auth.real().cloned();
        let today = self.today();
        async move {
            let catalog_work = async {
                let Some(remote) = remote else { return };
                let report = remote.refresh(&today).await;
                if !report.is_ok() {
                    tracing::warn!(
                        "the remote catalog was not fully refreshed; using what is cached"
                    );
                }
                if let Ok(c) = catalog.catalog() {
                    inventory.set_catalog(&c.apps);
                }
                ready.send_replace(true);
                let active: Vec<String> = storage
                    .subscriptions()
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|s| !s.paused)
                    .map(|s| s.channel_id)
                    .filter(|id| remote.directory_entry(id).is_some())
                    .collect();
                for (id, outcome) in remote.sync_channels(&active, &today).await {
                    match outcome {
                        Ok(_) => allow_community_downloads(&catalog, &storage, &id),
                        Err(e) => tracing::warn!(channel = %id, error = %e, "channel sync failed"),
                    }
                }
            };
            let inventory_work = async {
                if warm_inventory {
                    let inventory = Arc::clone(&inventory);
                    let _ = tokio::task::spawn_blocking(move || inventory.installed()).await;
                }
            };
            let account_work = async {
                let Some(oauth) = oauth else { return };
                if oauth.is_signed_in().unwrap_or(false)
                    && let Err(e) = oauth.profile().await
                {
                    tracing::warn!(error = %e, "could not refresh the profile from the account API");
                }
            };
            tokio::join!(catalog_work, inventory_work, account_work);
        }
    }
}

/// With the remote catalog: allows the download hosts of a followed, active community channel's
/// (unverified) manifest once it is loaded. Following it went through the community
/// confirmation ("Add only channels whose author you trust").
fn allow_community_downloads(catalog: &CatalogBackend, storage: &Storage, channel_id: &str) {
    let Some(remote) = catalog.remote() else {
        return;
    };
    let community = catalog.channels().is_ok_and(|channels| {
        channels
            .iter()
            .any(|c| c.id == channel_id && c.trust == TrustLevel::Community)
    });
    let followed = storage
        .subscriptions()
        .is_ok_and(|subs| rules::is_active(&subs, channel_id));
    if !(community && followed && remote.channel_releases(channel_id).is_some()) {
        return;
    }
    match remote.trust_community_downloads(channel_id) {
        Ok(hosts) => {
            tracing::info!(channel = %channel_id, hosts = hosts.len(), "community download hosts allowed");
        }
        Err(e) => {
            tracing::warn!(channel = %channel_id, error = %e, "community downloads not allowed")
        }
    }
}

#[cfg(test)]
mod remote_tests;

#[cfg(test)]
pub(crate) mod testing {
    //! A state over an in-memory database, a fixed clock and the simulated world at +10 % per
    //! tick; download events are recorded.

    use std::sync::Mutex;

    use paparats_core::{DownloadProgress, DownloadStateChange};
    use paparats_download::SimulatedTransfer;
    use paparats_install::SimulatedInstaller;

    use super::*;

    pub const TODAY: &str = "2026-09-15";

    /// A clock stuck on `date`.
    pub fn fixed_clock(date: &str) -> Clock {
        let date = date.to_owned();
        Arc::new(move || date.clone())
    }

    #[derive(Default)]
    pub struct Recorder {
        pub states: Mutex<Vec<DownloadStateChange>>,
        pub progress: Mutex<Vec<DownloadProgress>>,
    }

    impl UiEvents for Recorder {
        fn progress(&self, progress: DownloadProgress) {
            self.progress.lock().unwrap().push(progress);
        }

        fn state(&self, change: DownloadStateChange) {
            self.states.lock().unwrap().push(change);
        }
    }

    pub fn state() -> (AppState, Arc<Recorder>) {
        state_with_random(1.0)
    }

    /// Like [`state`], with a fixed `random` in `[0, 1]` (+`3 + random·7` % per tick).
    pub fn state_with_random(random: f64) -> (AppState, Arc<Recorder>) {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let strategies = Strategies::simulated(
            &storage,
            Arc::new(SimulatedTransfer::with_random(move || random)),
            Arc::new(SimulatedInstaller::new()),
        )
        .unwrap();
        state_with(storage, strategies)
    }

    /// A state over `storage` with the given strategies.
    pub fn state_with(storage: Arc<Storage>, strategies: Strategies) -> (AppState, Arc<Recorder>) {
        let recorder = Arc::new(Recorder::default());
        let state = AppState::new(
            storage,
            Arc::clone(&recorder) as Arc<dyn UiEvents>,
            Handle::current(),
            fixed_clock(TODAY),
            strategies,
        )
        .unwrap();
        (state, recorder)
    }
}
