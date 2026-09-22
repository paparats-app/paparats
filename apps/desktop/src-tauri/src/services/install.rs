//! InstallService: the library (inventory + favorites + collections).

use paparats_core::Library;
use paparats_inventory::Inventory;

use super::AppState;
use crate::error::AppResult;

impl AppState {
    pub fn get_library(&self) -> AppResult<Library> {
        Ok(self.storage.library()?)
    }

    pub fn set_favorite(&self, app_id: &str, favorite: bool) -> AppResult<Library> {
        Ok(self.storage.set_favorite(app_id, favorite)?)
    }

    /// Removes the app from this PC and from the inventory. Favorites survive (the prototype
    /// only hides the app). Not installed → the library unchanged.
    pub async fn uninstall(&self, app_id: &str) -> AppResult<Library> {
        if let Some(app) = self.inventory.find(app_id)? {
            self.installer.uninstall(&app).await?;
            self.inventory.remove(app_id)?;
            tracing::info!(app = %app_id, "uninstalled");
        }
        self.get_library()
    }

    /// Launches an installed app. The simulated world has nothing to launch (M7: the app's
    /// registered executable, spawned with an argument vector).
    pub fn open_app(&self, app_id: &str) -> AppResult<()> {
        tracing::debug!(app = %app_id, "open (simulated)");
        Ok(())
    }

    /// Opens the app's install folder in Explorer (simulated until M7).
    pub fn open_install_folder(&self, app_id: &str) -> AppResult<()> {
        tracing::debug!(app = %app_id, "open install folder (simulated)");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::testing::state;

    #[tokio::test]
    async fn favorites_and_uninstall() {
        let (s, _) = state();
        let lib = s.get_library().unwrap();
        assert_eq!(lib.installed.len(), 14);
        let lib = s.set_favorite("krita", true).unwrap();
        assert!(lib.favorites.contains(&"krita".to_owned()));
        let lib = s.set_favorite("krita", false).unwrap();
        assert!(!lib.favorites.contains(&"krita".to_owned()));

        let lib = s.uninstall("obsidian").await.unwrap();
        assert_eq!(lib.installed.len(), 13);
        assert!(
            lib.favorites.contains(&"obsidian".to_owned()),
            "favorite kept"
        );
        let lib = s.uninstall("obsidian").await.unwrap();
        assert_eq!(lib.installed.len(), 13, "idempotent");

        s.open_app("vscode").unwrap();
        s.open_install_folder("vscode").unwrap();
    }
}
