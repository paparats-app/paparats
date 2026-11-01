//! Installing downloaded packages. One trait ([`Installer`]) with two implementations:
//! [`SimulatedInstaller`] (no file-system side effects, the prototype's 8-tick "Installing…"
//! hold) and [`StrategyInstaller`] (M7, behind `PAPARATS_REAL=install`), which installs each
//! package with the strategy of its verified manifest ([`paparats_core::InstallStrategy`]):
//!
//! - `Msi` — `msiexec /i <file> /qn /norestart`, per user (`MSIINSTALLPERUSER=1 ALLUSERS=2`) when
//!   the package supports it; an explicit machine-wide install elevates through UAC.
//! - `ExeSilent` — the manifest's silent arguments, verbatim, with a timeout.
//! - `Msix` — `PackageManager.AddPackageAsync` (`ForceTargetApplicationShutdown`).
//! - `PortableZip` — extracted (zip-slip safe) to `%LOCALAPPDATA%\Paparats\apps\<app>\<version>\`
//!   with a Start-menu shortcut.
//!
//! Verify before trusting: the file is checked against the manifest's SHA-256 and held locked
//! against writers until the install ends; EXE/MSI must pass Authenticode
//! ([`verify_authenticode`]) under the [`policy`]. Installers are spawned with explicit argument
//! vectors — never through a shell or a command line built from strings.
//!
//! [`from_flags`] picks the implementation for the app's `PAPARATS_REAL` flags.

mod archive;
mod args;
pub mod authenticode;
mod config;
mod error;
mod exit;
mod gate;
mod msix;
pub mod policy;
mod portable;
mod process;
mod receipt;
mod simulated;
mod strategy;
// The Windows API layer: the crate's only unsafe code, one SAFETY comment per block.
#[allow(unsafe_code)]
mod sys;
mod verify;

use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;

use paparats_core::{InstalledApp, Package};

pub use archive::Limits as ArchiveLimits;
pub use authenticode::{
    AuthenticodeError, SignatureSource, SignerInfo, TrustFailure, verify_authenticode,
};
pub use config::{DEFAULT_PROCESS_TIMEOUT, InstallerConfig};
pub use error::InstallError;
pub use gate::{Cancelled, Gate, GateController, GateState, gate};
pub use policy::{PackageTrust, StrictTrust, TrustSource};
pub use simulated::{HOLD_TICKS, SimulatedInstaller, TICK};
pub use strategy::{StrategyInstaller, from_flags};

/// A boxed `Send` future, so the traits stay object-safe without extra crates.
pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Where and for whom apps are installed (Settings › Downloads / Apps).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallTarget {
    /// Install location for installers that accept a target directory. Portable apps always go
    /// to the per-user apps folder ([`InstallerConfig::apps_dir`]).
    pub location: PathBuf,
    /// "Install for current user only" (no elevation). `false` is an explicit machine-wide
    /// install: MSI/EXE installers then run elevated through UAC.
    pub per_user: bool,
}

impl Default for InstallTarget {
    fn default() -> Self {
        Self {
            location: PathBuf::from(r"C:\Program Files\Paparats"),
            per_user: true,
        }
    }
}

/// One install to perform.
#[derive(Debug, Clone, Copy)]
pub struct InstallRequest<'a> {
    pub package: &'a Package,
    /// The verified download (`None` for simulated packages).
    pub file: Option<&'a Path>,
    pub target: &'a InstallTarget,
    /// Stamped on the result as `last_used` (the day the app was installed).
    pub date: &'a str,
}

/// Installs and removes apps.
pub trait Installer: Send + Sync + 'static {
    /// Installs `request.package`. Long steps wait while `gate` is closed and stop with
    /// [`InstallError::Cancelled`] once it is cancelled.
    fn install<'a>(
        &'a self,
        request: InstallRequest<'a>,
        gate: &'a mut Gate,
    ) -> BoxFuture<'a, Result<InstalledApp, InstallError>>;

    /// Removes an installed app from this PC.
    fn uninstall<'a>(&'a self, app: &'a InstalledApp) -> BoxFuture<'a, Result<(), InstallError>>;

    /// What starts an app Paparats installed itself: the Start-menu shortcut of a portable app.
    /// `None` when there is nothing of its own to start (an installer's app: the inventory knows
    /// its program from Windows).
    fn shortcut(&self, _app_id: &str) -> Option<std::path::PathBuf> {
        None
    }
}
