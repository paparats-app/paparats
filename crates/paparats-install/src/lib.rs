//! Installing downloaded packages. One trait ([`Installer`]) with one strategy today:
//! [`SimulatedInstaller`] (no file-system side effects, the prototype's 8-tick "Installing…"
//! hold). MSI, EXE-silent, MSIX and portable-ZIP strategies with Authenticode checks arrive in M7
//! behind the same trait (see [`paparats_core::InstallStrategy`]).
//!
//! Real strategies must spawn installers with explicit argument vectors — never through a shell
//! or a command line built from strings.

mod gate;
mod simulated;

use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;

use paparats_core::{InstalledApp, Package};

pub use gate::{Cancelled, Gate, GateController, GateState, gate};
pub use simulated::{HOLD_TICKS, SimulatedInstaller, TICK};

/// A boxed `Send` future, so the traits stay object-safe without extra crates.
pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Where and for whom apps are installed (Settings › Downloads / Apps).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallTarget {
    /// Install location for portable apps and installers that accept a target directory.
    pub location: PathBuf,
    /// "Install for current user only" (no elevation).
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

#[derive(Debug, thiserror::Error)]
pub enum InstallError {
    #[error("installation was cancelled")]
    Cancelled,
    #[error("the {0} install strategy is not available yet")]
    Unsupported(&'static str),
    #[error("the downloaded package file is missing")]
    MissingFile,
    #[error("installer failed: {0}")]
    Failed(String),
}

impl From<Cancelled> for InstallError {
    fn from(_: Cancelled) -> Self {
        Self::Cancelled
    }
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
}
