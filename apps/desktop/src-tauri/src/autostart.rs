//! Start on Windows login (tauri-plugin-autostart). The login entry is the value `Paparats` under
//! `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`: `<exe> --minimized` (the NSIS uninstaller
//! removes the same value). Settings › General switches it through the JS plugin
//! (`SystemService.setAutostart`).
//!
//! At startup the core brings the entry in line with the stored setting, so the default ("on")
//! is real after an install and a moved installation is re-registered. An entry the user turned
//! off in Task Manager (the entry stays, `StartupApproved` marks it disabled) is left alone.
//! Development builds never register themselves.

use paparats_core::PRODUCT_NAME;
use tauri::{AppHandle, Runtime};
use tauri_plugin_autostart::ManagerExt;

/// The value name of the login entry.
pub const ENTRY_NAME: &str = PRODUCT_NAME;

#[cfg(windows)]
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reconcile {
    Enable,
    Disable,
    Keep,
}

/// What to do with the login entry (`entry`: its command line, if present) for the stored setting.
pub fn decide(startup: bool, entry: Option<&str>, exe: &str) -> Reconcile {
    match (startup, entry) {
        (true, None) => Reconcile::Enable,
        (true, Some(command)) if !launches(command, exe) => Reconcile::Enable,
        (false, Some(_)) => Reconcile::Disable,
        _ => Reconcile::Keep,
    }
}

/// Whether a Run command line starts `exe` (quoted or not, any case — Windows paths).
fn launches(command: &str, exe: &str) -> bool {
    let command = command.trim().trim_start_matches('"').to_lowercase();
    !exe.is_empty() && command.starts_with(&exe.to_lowercase())
}

/// The login entry's command line.
#[cfg(windows)]
fn read_entry() -> Option<String> {
    windows_registry::CURRENT_USER
        .open(RUN_KEY)
        .and_then(|key| key.get_string(ENTRY_NAME))
        .ok()
}

#[cfg(not(windows))]
fn read_entry() -> Option<String> {
    None
}

/// Startup reconciliation (release builds only).
pub fn reconcile<R: Runtime>(app: &AppHandle<R>, startup: bool) {
    if cfg!(debug_assertions) {
        return;
    }
    let exe = std::env::current_exe()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let result = match decide(startup, read_entry().as_deref(), &exe) {
        Reconcile::Enable => app.autolaunch().enable(),
        Reconcile::Disable => app.autolaunch().disable(),
        Reconcile::Keep => return,
    };
    match result {
        Ok(()) => tracing::info!(startup, "login entry updated"),
        Err(e) => tracing::warn!(error = %e, "could not update the login entry"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXE: &str = r"C:\Users\Ann Lee\AppData\Local\Paparats\Paparats.exe";

    #[test]
    fn a_fresh_install_registers_the_default() {
        assert_eq!(decide(true, None, EXE), Reconcile::Enable);
        assert_eq!(decide(false, None, EXE), Reconcile::Keep);
    }

    #[test]
    fn an_existing_entry_for_this_executable_is_kept() {
        let plain = format!("{EXE} --minimized");
        let quoted = format!("\"{EXE}\" --minimized");
        let other_case = plain.to_uppercase();
        for entry in [&plain, &quoted, &other_case] {
            assert_eq!(decide(true, Some(entry), EXE), Reconcile::Keep, "{entry}");
        }
    }

    #[test]
    fn a_moved_installation_is_registered_again() {
        let old = r"D:\Old\Paparats.exe --minimized";
        assert_eq!(decide(true, Some(old), EXE), Reconcile::Enable);
        assert_eq!(decide(true, Some(old), ""), Reconcile::Enable);
    }

    #[test]
    fn switched_off_removes_the_entry() {
        assert_eq!(
            decide(false, Some(&format!("{EXE} --minimized")), EXE),
            Reconcile::Disable
        );
    }
}
