//! What is installed on this PC, behind one [`Inventory`] trait:
//! - [`StoredInventory`] — the mock world kept in `paparats-storage` (seeded from
//!   `fixtures/library.json`, updated when downloads finish). The default.
//! - [`RegistryInventory`] — the real scan (M7): Uninstall keys of HKCU, HKLM and WOW6432Node plus
//!   the user's MSIX packages, mapped to catalog apps by their detection rules. Switched on by the
//!   `inventory` flag of `PAPARATS_REAL` through [`from_flags`].
//!
//! Plus [`version`]: comparison of the dotted versions publishers use.

pub mod detect;
pub mod launch;
mod registry;
pub mod source;
pub mod uninstall;
pub mod usage;
pub mod version;
#[cfg(windows)]
mod windows;

use std::sync::Arc;

use paparats_core::{ActivityKind, App, InstalledApp, IsoDate};
use paparats_storage::{Storage, StorageError};

pub use detect::{DetectionRules, MatchKind, RuleError};
pub use registry::{
    DEFAULT_SCAN_TTL, Detected, LaunchTarget, Origin, RegistryInventory, ScanReport, Sources,
    Today, default_portable_root,
};
pub use source::{
    DiskProbe, EmptyRegistry, FolderProbe, KnownFolders, MemoryRegistry, MsixPackage, NoFolders,
    PackageSource, RegData, RegKeyData, RegRoot, RegistryReader, SourceError,
};
pub use uninstall::UninstallEntry;
pub use version::{compare, is_newer};
#[cfg(windows)]
pub use windows::{MsixPackages, WinRegistry};

#[derive(Debug, thiserror::Error)]
pub enum InventoryError {
    #[error(transparent)]
    Storage(#[from] StorageError),
}

/// The inventory of this PC.
pub trait Inventory: Send + Sync {
    /// Installed apps, in list order.
    fn installed(&self) -> Result<Vec<InstalledApp>, InventoryError>;
    fn find(&self, app_id: &str) -> Result<Option<InstalledApp>, InventoryError>;
    /// Records a finished install or update (inventory, activity dated `date`, update counter).
    fn record(
        &self,
        app: &InstalledApp,
        kind: ActivityKind,
        date: &IsoDate,
    ) -> Result<(), InventoryError>;
    /// Forgets an uninstalled app; `false` when it was not installed.
    fn remove(&self, app_id: &str) -> Result<bool, InventoryError>;

    /// The catalog changed: look for these apps (their detection rules) from now on. The stored
    /// inventory has nothing to look for and ignores it.
    fn set_catalog(&self, _apps: &[App]) {}

    /// Drops any cached scan, so the next read looks at the PC again (e.g. after the user
    /// installed something outside Paparats). A no-op for the stored inventory.
    fn refresh(&self) {}

    /// Where the app was found on this PC — Uninstall entries (with the uninstall commands
    /// Windows keeps), MSIX packages, Paparats' portable folder. Empty for the stored inventory,
    /// which only knows what it recorded.
    fn locate(&self, _app_id: &str) -> Result<Vec<Detected>, InventoryError> {
        Ok(Vec::new())
    }
}

/// Shared inventories (`Arc<dyn Inventory>` from [`from_flags`]) are inventories too.
impl<T: Inventory + ?Sized> Inventory for Arc<T> {
    fn installed(&self) -> Result<Vec<InstalledApp>, InventoryError> {
        (**self).installed()
    }

    fn find(&self, app_id: &str) -> Result<Option<InstalledApp>, InventoryError> {
        (**self).find(app_id)
    }

    fn record(
        &self,
        app: &InstalledApp,
        kind: ActivityKind,
        date: &IsoDate,
    ) -> Result<(), InventoryError> {
        (**self).record(app, kind, date)
    }

    fn remove(&self, app_id: &str) -> Result<bool, InventoryError> {
        (**self).remove(app_id)
    }

    fn set_catalog(&self, apps: &[App]) {
        (**self).set_catalog(apps);
    }

    fn refresh(&self) {
        (**self).refresh();
    }

    fn locate(&self, app_id: &str) -> Result<Vec<Detected>, InventoryError> {
        (**self).locate(app_id)
    }
}

/// The inventory for this run. `real` = the `inventory` flag of `PAPARATS_REAL` (parsed by the
/// app): the registry/MSIX scan of this PC for `apps`, journaling installs and removals to
/// `storage`. Otherwise the stored mock world.
pub fn from_flags(real: bool, storage: Arc<Storage>, apps: &[App]) -> Arc<dyn Inventory> {
    let stored = StoredInventory::new(storage);
    if real {
        tracing::info!("inventory: registry and MSIX scan");
        Arc::new(RegistryInventory::system(apps, Arc::new(stored)))
    } else {
        Arc::new(stored)
    }
}

/// The inventory kept in the local database.
#[derive(Debug, Clone)]
pub struct StoredInventory {
    storage: Arc<Storage>,
}

impl StoredInventory {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self { storage }
    }
}

impl Inventory for StoredInventory {
    fn installed(&self) -> Result<Vec<InstalledApp>, InventoryError> {
        Ok(self.storage.installed_apps()?)
    }

    fn find(&self, app_id: &str) -> Result<Option<InstalledApp>, InventoryError> {
        Ok(self.storage.installed_app(app_id)?)
    }

    fn record(
        &self,
        app: &InstalledApp,
        kind: ActivityKind,
        date: &IsoDate,
    ) -> Result<(), InventoryError> {
        Ok(self.storage.record_install(app, kind, date)?)
    }

    fn remove(&self, app_id: &str) -> Result<bool, InventoryError> {
        Ok(self.storage.remove_installed(app_id)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_inventory_round_trip() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        storage.seed_from_fixtures().unwrap();
        let inv = StoredInventory::new(Arc::clone(&storage));
        assert_eq!(inv.installed().unwrap().len(), 14);
        let obsidian = inv.find("obsidian").unwrap().unwrap();
        assert_eq!(obsidian.version, "1.8.9");
        assert!(is_newer("1.8.10", &obsidian.version));

        let updated = InstalledApp {
            version: "1.8.10".into(),
            last_used: "2026-09-16".into(),
            ..obsidian
        };
        inv.record(&updated, ActivityKind::Updated, &"2026-09-16".into())
            .unwrap();
        assert_eq!(inv.find("obsidian").unwrap(), Some(updated));
        assert_eq!(storage.account().unwrap().usage.updates_installed, 249);

        assert!(inv.remove("obsidian").unwrap());
        assert!(!inv.remove("obsidian").unwrap());
        assert_eq!(inv.find("obsidian").unwrap(), None);
    }

    #[test]
    fn flags_pick_the_inventory() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        storage.seed_from_fixtures().unwrap();
        let mock = from_flags(false, Arc::clone(&storage), &[]);
        assert_eq!(mock.installed().unwrap().len(), 14, "the stored mock world");
        mock.refresh();
        mock.set_catalog(&[]);
        assert_eq!(mock.installed().unwrap().len(), 14);
        assert!(mock.locate("obsidian").unwrap().is_empty());

        // Real, but with no apps to look for: nothing is detected (no registry needed).
        let real = from_flags(true, storage, &[]);
        assert!(real.installed().unwrap().is_empty());
        assert!(real.find("obsidian").unwrap().is_none());
    }

    #[test]
    fn shared_inventory_is_an_inventory() {
        fn takes<I: Inventory>(inv: &I) -> usize {
            inv.installed().map(|v| v.len()).unwrap_or_default()
        }
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        storage.seed_from_fixtures().unwrap();
        let shared: Arc<dyn Inventory> = Arc::new(StoredInventory::new(storage));
        assert_eq!(takes(&shared), 14);
    }
}
