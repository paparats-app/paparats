//! Where the real strategies put things.

use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::InstallError;
use crate::archive::Limits;
use crate::sys::{self, KnownFolder};

/// Folder names under `%LOCALAPPDATA%\Paparats`.
const DATA_DIR: &str = "Paparats";
const APPS_DIR: &str = "apps";
const RECEIPTS_DIR: &str = "receipts";
/// Start-menu folder that holds the portable apps' shortcuts.
const SHORTCUTS_DIR: &str = "Paparats";

/// The longest an MSI/EXE installer may run before it is stopped.
pub const DEFAULT_PROCESS_TIMEOUT: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallerConfig {
    /// Portable apps go to `<apps_dir>\<app-id>\<version>\` (`%LOCALAPPDATA%\Paparats\apps`).
    pub apps_dir: PathBuf,
    /// Install receipts (`%LOCALAPPDATA%\Paparats\receipts`).
    pub receipts_dir: PathBuf,
    /// Start-menu shortcuts of portable apps (`…\Start Menu\Programs\Paparats`).
    pub shortcuts_dir: PathBuf,
    /// `%SystemRoot%\System32\msiexec.exe` — an absolute path, never a PATH lookup.
    pub msiexec: PathBuf,
    pub process_timeout: Duration,
    pub archive_limits: Limits,
}

impl InstallerConfig {
    /// The current user's folders (known folders, so redirected profiles work).
    pub fn for_current_user() -> Result<Self, InstallError> {
        let data = sys::known_folder(KnownFolder::LocalAppData)?.join(DATA_DIR);
        let programs = sys::known_folder(KnownFolder::Programs)?;
        let system = sys::known_folder(KnownFolder::System)?;
        Ok(Self {
            apps_dir: data.join(APPS_DIR),
            receipts_dir: data.join(RECEIPTS_DIR),
            shortcuts_dir: programs.join(SHORTCUTS_DIR),
            msiexec: system.join("msiexec.exe"),
            process_timeout: DEFAULT_PROCESS_TIMEOUT,
            archive_limits: Limits::default(),
        })
    }

    /// Everything under `root` (tests, sandboxes); `msiexec` is still the system one.
    pub fn in_dir(root: &Path) -> Self {
        let msiexec = sys::known_folder(KnownFolder::System)
            .map(|s| s.join("msiexec.exe"))
            .unwrap_or_else(|_| PathBuf::from("msiexec.exe"));
        Self {
            apps_dir: root.join(APPS_DIR),
            receipts_dir: root.join(RECEIPTS_DIR),
            shortcuts_dir: root.join("Start Menu").join(SHORTCUTS_DIR),
            msiexec,
            process_timeout: DEFAULT_PROCESS_TIMEOUT,
            archive_limits: Limits::default(),
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn current_user_layout() {
        let c = InstallerConfig::for_current_user().unwrap();
        assert!(c.apps_dir.ends_with(r"Paparats\apps"), "{:?}", c.apps_dir);
        assert!(c.receipts_dir.ends_with(r"Paparats\receipts"));
        assert!(c.shortcuts_dir.ends_with(r"Programs\Paparats"));
        assert!(c.msiexec.is_absolute() && c.msiexec.is_file());
    }
}
