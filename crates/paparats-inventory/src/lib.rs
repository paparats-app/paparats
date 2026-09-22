//! What is installed on this PC. Today: [`StoredInventory`], the mock world kept in
//! `paparats-storage` (seeded from `fixtures/library.json`, updated when downloads finish). M7
//! adds a registry (Uninstall keys: HKCU, HKLM, WOW6432Node) and MSIX scan behind the same trait.

pub mod version;

use std::sync::Arc;

use paparats_core::{ActivityKind, InstalledApp, IsoDate};
use paparats_storage::{Storage, StorageError};

pub use version::{compare, is_newer};

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
}
