//! The service layer behind the Tauri commands: one method per method of the TypeScript
//! service contracts (`apps/desktop/src/services/contracts.ts`), with the same semantics as the
//! in-memory mocks (`services/mock/*`). Plain Rust — no Tauri types — so it is unit-tested here.

mod account;
mod catalog;
mod channels;
mod downloads;
mod ideas;
mod install;
mod system;

use std::path::Path;
use std::sync::Arc;

use paparats_account::AccountStore;
use paparats_catalog::EmbeddedCatalog;
use paparats_core::{ChannelInfo, IsoDate, dates};
use paparats_download::{Clock, DownloadEngine, EngineConfig, SimulatedTransfer, Transfer};
use paparats_install::{Installer, SimulatedInstaller};
use paparats_inventory::StoredInventory;
use paparats_storage::Storage;
use tokio::runtime::Handle;

use crate::error::{AppError, AppResult};
use crate::events::{EngineBridge, UiEvents};

/// Today's local calendar date.
pub fn system_clock() -> Clock {
    Arc::new(|| dates::format(chrono::Local::now().date_naive()))
}

/// Everything the commands need, managed by Tauri.
pub struct AppState {
    storage: Arc<Storage>,
    catalog: EmbeddedCatalog,
    inventory: StoredInventory,
    account: AccountStore,
    installer: Arc<dyn Installer>,
    engine: DownloadEngine,
    clock: Clock,
}

impl std::fmt::Debug for AppState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppState").finish_non_exhaustive()
    }
}

impl AppState {
    /// Opens (or creates and seeds) the database at `db_path` and wires the simulated download
    /// world: simulated transfer and installer with the prototype's timings.
    pub fn open(
        db_path: &Path,
        ui: Arc<dyn UiEvents>,
        runtime: Handle,
        clock: Clock,
    ) -> AppResult<Self> {
        let storage = Arc::new(Storage::open(db_path)?);
        Self::new(
            storage,
            ui,
            runtime,
            clock,
            Arc::new(SimulatedTransfer::new()),
            Arc::new(SimulatedInstaller::new()),
        )
    }

    /// Wires the state over an open database, seeding the mock world on first run.
    pub fn new(
        storage: Arc<Storage>,
        ui: Arc<dyn UiEvents>,
        runtime: Handle,
        clock: Clock,
        transfer: Arc<dyn Transfer>,
        installer: Arc<dyn Installer>,
    ) -> AppResult<Self> {
        if storage.seed_from_fixtures()? {
            tracing::info!("seeded the local database from the mock data set");
        }
        let catalog = EmbeddedCatalog::load()?;
        let inventory = StoredInventory::new(Arc::clone(&storage));
        let bridge = EngineBridge {
            inventory: inventory.clone(),
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
        Ok(Self {
            account: AccountStore::new(Arc::clone(&storage)),
            storage,
            catalog,
            inventory,
            installer,
            engine,
            clock,
        })
    }

    /// Today's date (`YYYY-MM-DD`, local).
    pub fn today(&self) -> IsoDate {
        (self.clock)()
    }

    /// A channel as the client knows it now (published data + the last local sync).
    fn channel(&self, id: &str) -> AppResult<ChannelInfo> {
        let mut channel = self
            .catalog
            .channel(id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("channel {id}")))?;
        if let Some(synced) = self.storage.channel_sync_dates()?.remove(id) {
            channel.synced = Some(synced);
        }
        Ok(channel)
    }
}

#[cfg(test)]
pub(crate) mod testing {
    //! A state over an in-memory database, a fixed clock and the simulated world at +10 % per
    //! tick; download events are recorded.

    use std::sync::Mutex;

    use paparats_core::{DownloadProgress, DownloadStateChange};

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
        let recorder = Arc::new(Recorder::default());
        let state = AppState::new(
            Arc::new(Storage::open_in_memory().unwrap()),
            Arc::clone(&recorder) as Arc<dyn UiEvents>,
            Handle::current(),
            fixed_clock(TODAY),
            Arc::new(SimulatedTransfer::with_random(move || random)),
            Arc::new(SimulatedInstaller::new()),
        )
        .unwrap();
        (state, recorder)
    }
}
