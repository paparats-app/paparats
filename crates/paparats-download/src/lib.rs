//! The download engine: a FIFO queue with a live-adjustable concurrency limit, per-item
//! pause/resume/cancel, an online flag, progress events, and the installer step.
//!
//! Lifecycle of an item: `queued → downloading ⇄ paused → installing → installed | cancelled |
//! failed`. At most `concurrency` items are started (downloading, paused or installing); the rest
//! wait in `queued`. Offline, started items stop advancing and nothing new starts; back online they
//! continue and queued items start. Lowering the limit lets started items finish; raising it
//! starts queued items immediately.
//!
//! A [`Transfer`] moves the bytes ([`SimulatedTransfer`]: the prototype's 110 ms ticks;
//! [`HttpTransfer`]: reqwest with Range resume and SHA-256 verification), then the
//! [`paparats_install::Installer`] installs, then the [`DownloadObserver`] records the app before
//! `installed` is emitted.

mod engine;
mod error;
mod http;
mod simulated;

use std::path::PathBuf;

use paparats_core::{DownloadRequest, Package};
use paparats_install::{BoxFuture, Gate};

pub use engine::{Clock, DEFAULT_CONCURRENCY, DownloadEngine, DownloadObserver, EngineConfig};
pub use error::DownloadError;
pub use http::{HttpTransfer, HttpTransferConfig, PROGRESS_INTERVAL};
pub use paparats_install::{Cancelled, GateState, InstallTarget};
pub use simulated::{Random, SimulatedTransfer, TICK};

/// One queue entry's work: what the UI asked for and the package that satisfies it.
#[derive(Debug, Clone, PartialEq)]
pub struct Job {
    pub request: DownloadRequest,
    pub package: Package,
}

impl Job {
    /// A job with no file behind it (the mock world): a simulated package of `request.size_mb`.
    pub fn simulated(request: DownloadRequest) -> Self {
        let package = Package::simulated(&request.app_id, &request.version, request.size_mb);
        Self { request, package }
    }
}

/// Progress reported by a transfer.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TransferProgress {
    /// 0–100.
    pub progress: f64,
    pub received_mb: f64,
}

/// Where a transfer reports progress.
pub type ProgressFn<'a> = &'a (dyn Fn(TransferProgress) + Send + Sync);

/// What a finished transfer produced.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TransferOutput {
    /// The verified file (`None` for simulated transfers).
    pub file: Option<PathBuf>,
}

/// Moves the bytes of one job. Must only advance while `gate` is open, and must return
/// [`DownloadError::Cancelled`] (after cleaning up) once it is cancelled.
pub trait Transfer: Send + Sync + 'static {
    fn run<'a>(
        &'a self,
        job: &'a Job,
        gate: &'a mut Gate,
        progress: ProgressFn<'a>,
    ) -> BoxFuture<'a, Result<TransferOutput, DownloadError>>;
}
