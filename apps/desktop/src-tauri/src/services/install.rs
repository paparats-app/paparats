//! InstallService: the library (inventory + favorites + collections), and opening an installed
//! app or its folder.

use std::path::{Path, PathBuf};
use std::time::Duration;

use paparats_core::Library;
use paparats_install::{InstallError, RegisteredUninstall};
use paparats_inventory::{Detected, Origin, RegRoot};

use super::AppState;
use crate::error::{AppError, AppResult};

impl AppState {
    /// Favorites and collections from the local database; installed apps from the inventory
    /// (the stored mock world, or this PC with `PAPARATS_REAL=inventory`).
    pub async fn get_library(&self) -> AppResult<Library> {
        let library = self.storage.library()?;
        self.with_installed(library).await
    }

    pub async fn set_favorite(&self, app_id: &str, favorite: bool) -> AppResult<Library> {
        let library = self.storage.set_favorite(app_id, favorite)?;
        self.with_installed(library).await
    }

    async fn with_installed(&self, library: Library) -> AppResult<Library> {
        let installed = self
            .read_inventory(|inventory| inventory.installed())
            .await?;
        Ok(Library {
            installed,
            ..library
        })
    }

    /// Removes the app from this PC and from the inventory. Favorites survive (the prototype
    /// only hides the app). Not installed → the library unchanged. With the real inventory, an
    /// app the receipt did not remove — an EXE installer's, or one installed outside Paparats —
    /// is uninstalled through the entry Windows keeps for it; an app that is still found after
    /// that (or has no such entry) is `invalid` and nothing is forgotten.
    pub async fn uninstall(&self, app_id: &str) -> AppResult<Library> {
        let id = app_id.to_owned();
        let Some(app) = self.read_inventory(move |i| i.find(&id)).await? else {
            return self.get_library().await;
        };
        let by_receipt = self.installer.uninstall(&app).await;
        if self.flags.inventory {
            match by_receipt {
                // An EXE install's receipt: its own uninstaller runs below.
                Ok(()) | Err(InstallError::Unsupported(_)) => {}
                Err(e) => return Err(e.into()),
            }
            if self.still_installed(app_id, Duration::ZERO).await? {
                self.uninstall_registered(app_id).await?;
            }
        } else {
            by_receipt?;
        }
        // The real inventory rescans after forgetting: off the async workers too.
        let id = app_id.to_owned();
        self.read_inventory(move |i| i.remove(&id)).await?;
        tracing::info!(app = %app_id, "uninstalled");
        self.get_library().await
    }

    /// Runs the uninstaller Windows lists for the app and waits for its entry to go: NSIS
    /// uninstallers return at once and finish in the background.
    async fn uninstall_registered(&self, app_id: &str) -> AppResult<()> {
        let id = app_id.to_owned();
        let entry = self
            .read_inventory(move |i| i.locate(&id))
            .await?
            .into_iter()
            .find_map(|d| registered_entry(&d));
        let Some(entry) = entry else {
            tracing::info!(app = %app_id, "not uninstalled: Windows lists no uninstaller for it");
            return Err(AppError::invalid(format!(
                "{app_id} has no uninstaller Paparats can run; remove it in Windows Settings"
            )));
        };
        self.installer.uninstall_registered(app_id, &entry).await?;
        if self.still_installed(app_id, UNINSTALL_WAIT).await? {
            tracing::info!(app = %app_id, "still installed after its uninstaller ran");
            return Err(AppError::invalid(format!(
                "{app_id} is still installed; finish removing it in Windows Settings"
            )));
        }
        Ok(())
    }

    /// Whether the inventory still finds the app, looking again for up to `wait`.
    async fn still_installed(&self, app_id: &str, wait: Duration) -> AppResult<bool> {
        let deadline = tokio::time::Instant::now() + wait;
        loop {
            let id = app_id.to_owned();
            let found = self
                .read_inventory(move |i| {
                    i.refresh();
                    i.find(&id)
                })
                .await?
                .is_some();
            if !found || tokio::time::Instant::now() >= deadline {
                return Ok(found);
            }
            tokio::time::sleep(UNINSTALL_POLL).await;
        }
    }

    /// Starts an installed app: the Start-menu shortcut of a portable app Paparats installed,
    /// else the program Windows lists for it (`DisplayIcon`). The demo world has nothing to start
    /// (D24); an app whose program is unknown is `not_found` (the UI says so).
    pub async fn open_app(&self, app_id: &str) -> AppResult<()> {
        if !self.flags.inventory {
            tracing::debug!(app = %app_id, "open: nothing to start in the demo world");
            return Ok(());
        }
        let target = match self.installer.shortcut(app_id) {
            Some(shortcut) => Some(shortcut),
            None => {
                let id = app_id.to_owned();
                self.read_inventory(move |i| i.locate(&id))
                    .await?
                    .into_iter()
                    .find_map(|d| d.program.filter(|p| p.is_file()))
            }
        };
        let target =
            target.ok_or_else(|| AppError::not_found(format!("the program of {app_id}")))?;
        shell_open(&target)
    }

    /// Opens the app's folder in Explorer: where Windows says it is installed, or its version
    /// folder for a portable app.
    pub async fn open_install_folder(&self, app_id: &str) -> AppResult<()> {
        if !self.flags.inventory {
            tracing::debug!(app = %app_id, "open folder: nothing to show in the demo world");
            return Ok(());
        }
        let id = app_id.to_owned();
        let dir: Option<PathBuf> = self
            .read_inventory(move |i| i.locate(&id))
            .await?
            .into_iter()
            .find_map(|d| d.install_dir.filter(|dir| dir.is_dir()));
        let dir = dir.ok_or_else(|| AppError::not_found(format!("the folder of {app_id}")))?;
        shell_open(&dir)
    }
}

/// How long an uninstaller may take to remove the app's entry after it returned.
const UNINSTALL_WAIT: Duration = Duration::from_secs(90);
const UNINSTALL_POLL: Duration = Duration::from_millis(750);

/// The uninstall commands of an Uninstall entry the inventory found.
fn registered_entry(found: &Detected) -> Option<RegisteredUninstall> {
    let Origin::Uninstall {
        root,
        key,
        windows_installer,
        uninstall_string,
        quiet_uninstall_string,
    } = &found.origin
    else {
        return None;
    };
    Some(RegisteredUninstall {
        key: key.clone(),
        windows_installer: *windows_installer,
        uninstall_string: uninstall_string.clone(),
        quiet_uninstall_string: quiet_uninstall_string.clone(),
        machine_wide: *root != RegRoot::CurrentUser,
    })
}

/// Hands a file or folder to Explorer, which starts a program or shortcut and shows a folder,
/// without elevation and without a shell command line (one argument, never parsed).
fn shell_open(target: &Path) -> AppResult<()> {
    if !target.is_absolute() {
        return Err(AppError::invalid("not an absolute path"));
    }
    std::process::Command::new("explorer.exe")
        .arg(target)
        .spawn()
        .map(drop)
        .map_err(|e| AppError::internal_message(&format!("could not start Explorer: {e}")))
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use paparats_core::{ActivityKind, App, InstalledApp, IsoDate};
    use paparats_download::SimulatedTransfer;
    use paparats_install::{Installer, SimulatedInstaller};
    use paparats_inventory::{Inventory, InventoryError};
    use paparats_storage::Storage;

    use super::super::testing::{state, state_with};
    use super::super::{NoBrowser, RealPaths, Strategies};
    use super::*;
    use crate::flags::{CatalogEnv, RealFlags};

    #[tokio::test]
    async fn favorites_and_uninstall() {
        let (s, _) = state();
        let lib = s.get_library().await.unwrap();
        assert_eq!(lib.installed.len(), 14);
        let lib = s.set_favorite("krita", true).await.unwrap();
        assert!(lib.favorites.contains(&"krita".to_owned()));
        let lib = s.set_favorite("krita", false).await.unwrap();
        assert!(!lib.favorites.contains(&"krita".to_owned()));

        let lib = s.uninstall("obsidian").await.unwrap();
        assert_eq!(lib.installed.len(), 13);
        assert!(
            lib.favorites.contains(&"obsidian".to_owned()),
            "favorite kept"
        );
        let lib = s.uninstall("obsidian").await.unwrap();
        assert_eq!(lib.installed.len(), 13, "idempotent");

        // The demo world starts nothing and opens nothing, without an error.
        s.open_app("vscode").await.unwrap();
        s.open_install_folder("vscode").await.unwrap();
    }

    /// An inventory that sees a fixed set of apps — the real one on a PC where uninstalling did
    /// not remove them — and journals nothing.
    struct OnThisPc(Mutex<Vec<InstalledApp>>);

    impl Inventory for OnThisPc {
        fn installed(&self) -> Result<Vec<InstalledApp>, InventoryError> {
            Ok(self.0.lock().unwrap().clone())
        }

        fn find(&self, app_id: &str) -> Result<Option<InstalledApp>, InventoryError> {
            Ok(self.installed()?.into_iter().find(|a| a.app_id == app_id))
        }

        fn record(
            &self,
            _app: &InstalledApp,
            _kind: ActivityKind,
            _date: &IsoDate,
        ) -> Result<(), InventoryError> {
            Ok(())
        }

        fn remove(&self, _app_id: &str) -> Result<bool, InventoryError> {
            Ok(false)
        }

        fn set_catalog(&self, _apps: &[App]) {}
    }

    /// A PC with one app an EXE installer put there: the inventory lists its Uninstall entry, and
    /// the app is gone once its registered uninstaller ran.
    struct ExeInstalled {
        apps: Arc<Mutex<Vec<InstalledApp>>>,
    }

    impl Inventory for ExeInstalled {
        fn installed(&self) -> Result<Vec<InstalledApp>, InventoryError> {
            Ok(self.apps.lock().unwrap().clone())
        }

        fn find(&self, app_id: &str) -> Result<Option<InstalledApp>, InventoryError> {
            Ok(self.installed()?.into_iter().find(|a| a.app_id == app_id))
        }

        fn record(
            &self,
            _app: &InstalledApp,
            _kind: ActivityKind,
            _date: &IsoDate,
        ) -> Result<(), InventoryError> {
            Ok(())
        }

        fn remove(&self, _app_id: &str) -> Result<bool, InventoryError> {
            Ok(false)
        }

        fn locate(&self, app_id: &str) -> Result<Vec<Detected>, InventoryError> {
            Ok(vec![Detected {
                app_id: app_id.to_owned(),
                origin: Origin::Uninstall {
                    root: RegRoot::CurrentUser,
                    key: "Obsidian".into(),
                    windows_installer: false,
                    uninstall_string: Some(r#""C:\Apps\Obsidian\Uninstall Obsidian.exe""#.into()),
                    quiet_uninstall_string: None,
                },
                kind: paparats_inventory::MatchKind::DisplayName,
                version: Some("1.14.5".into()),
                install_dir: None,
                program: None,
            }])
        }
    }

    /// An installer whose registered uninstall removes the app from [`ExeInstalled`].
    struct RunsUninstallers {
        apps: Arc<Mutex<Vec<InstalledApp>>>,
        ran: Mutex<Vec<RegisteredUninstall>>,
    }

    impl Installer for RunsUninstallers {
        fn install<'a>(
            &'a self,
            _request: paparats_install::InstallRequest<'a>,
            _gate: &'a mut paparats_install::Gate,
        ) -> paparats_install::BoxFuture<'a, Result<InstalledApp, InstallError>> {
            Box::pin(async { Err(InstallError::Unsupported("test")) })
        }

        fn uninstall<'a>(
            &'a self,
            _app: &'a InstalledApp,
        ) -> paparats_install::BoxFuture<'a, Result<(), InstallError>> {
            // An EXE install's receipt: the client has no uninstaller of its own for it.
            Box::pin(async { Err(InstallError::Unsupported("EXE uninstall")) })
        }

        fn uninstall_registered<'a>(
            &'a self,
            app_id: &'a str,
            entry: &'a RegisteredUninstall,
        ) -> paparats_install::BoxFuture<'a, Result<(), InstallError>> {
            Box::pin(async move {
                self.ran.lock().unwrap().push(entry.clone());
                self.apps.lock().unwrap().retain(|a| a.app_id != app_id);
                Ok(())
            })
        }
    }

    #[tokio::test]
    async fn an_exe_install_is_removed_by_its_registered_uninstaller() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let obsidian = InstalledApp {
            app_id: "obsidian".into(),
            version: "1.14.5".into(),
            last_used: "2026-11-01".into(),
        };
        let apps = Arc::new(Mutex::new(vec![obsidian]));
        let installer = Arc::new(RunsUninstallers {
            apps: Arc::clone(&apps),
            ran: Mutex::new(Vec::new()),
        });
        let mut strategies = Strategies::simulated(
            &storage,
            Arc::new(SimulatedTransfer::new()),
            Arc::clone(&installer) as Arc<dyn Installer>,
        )
        .unwrap();
        strategies.inventory = Arc::new(ExeInstalled { apps });
        strategies.flags = RealFlags {
            inventory: true,
            install: true,
            ..RealFlags::default()
        };
        let (s, _) = state_with(storage, strategies);

        let lib = s.uninstall("obsidian").await.unwrap();
        assert!(lib.installed.is_empty());
        let ran = installer.ran.lock().unwrap().clone();
        assert_eq!(ran.len(), 1);
        assert_eq!(ran[0].key, "Obsidian");
        assert!(
            !ran[0].machine_wide,
            "a per-user entry runs without elevation"
        );
    }

    #[tokio::test]
    async fn the_library_lists_what_the_inventory_finds() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        // The demo data set, as if this database came from the demo world.
        storage.seed_from_fixtures().unwrap();
        let vlc = InstalledApp {
            app_id: "vlc".into(),
            version: "3.0.23".into(),
            last_used: "2026-09-01".into(),
        };
        let mut strategies = Strategies::simulated(
            &storage,
            Arc::new(SimulatedTransfer::new()),
            Arc::new(SimulatedInstaller::new()),
        )
        .unwrap();
        strategies.inventory = Arc::new(OnThisPc(Mutex::new(vec![vlc.clone()])));
        strategies.flags = RealFlags {
            inventory: true,
            ..RealFlags::default()
        };
        let (s, _) = state_with(storage, strategies);

        let lib = s.get_library().await.unwrap();
        assert_eq!(
            lib.installed,
            std::slice::from_ref(&vlc),
            "not the 14 seeded apps"
        );
        assert!(!lib.favorites.is_empty(), "favorites stay local");
        let lib = s.set_favorite("vlc", true).await.unwrap();
        assert_eq!(lib.installed, [vlc]);

        // The simulated installer removes nothing: the app is still on this PC.
        let err = s.uninstall("vlc").await.unwrap_err();
        assert!(matches!(err, AppError::Invalid(_)), "{err:?}");
        assert_eq!(s.get_library().await.unwrap().installed.len(), 1);
        // Not installed at all: nothing to do.
        assert_eq!(s.uninstall("krita").await.unwrap().installed.len(), 1);

        // This inventory knows no program or folder: Open and Folder say so instead of guessing.
        assert!(matches!(
            s.open_app("vlc").await,
            Err(AppError::NotFound(_))
        ));
        assert!(matches!(
            s.open_install_folder("vlc").await,
            Err(AppError::NotFound(_))
        ));
    }

    #[tokio::test]
    async fn the_real_inventory_looks_for_catalog_apps() {
        // The inventory flag builds the registry/MSIX scan over the embedded catalog's detection
        // rules; the seeded rows are only its journal. Whatever this PC has, only catalog apps
        // come back.
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let dir = tempfile::tempdir().unwrap();
        let strategies = Strategies::from_flags(
            RealFlags {
                inventory: true,
                ..RealFlags::default()
            },
            &CatalogEnv::default(),
            &storage,
            &RealPaths {
                downloads: dir.path().to_path_buf(),
            },
            Arc::new(NoBrowser),
        )
        .unwrap();
        assert!(strategies.flags.inventory);
        let (s, _) = state_with(storage, strategies);
        let lib = s.get_library().await.unwrap();
        let catalog = s.get_catalog().await.unwrap();
        for app in &lib.installed {
            assert!(
                catalog.apps.iter().any(|a| a.id == app.app_id),
                "{} is a catalog app",
                app.app_id
            );
        }
    }
}
