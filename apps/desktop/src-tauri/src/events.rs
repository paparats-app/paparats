//! Typed events (tauri-specta) and the bridge from the download engine to the UI.

use std::sync::Arc;

use paparats_core::{
    ActivityKind, DownloadKind, DownloadProgress, DownloadRequest, DownloadStateChange,
    InstalledApp,
};
use paparats_download::{Clock, DownloadObserver};
use paparats_inventory::Inventory;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

/// `download://progress` — progress of a downloading item (every 110 ms tick while simulated).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[tauri_specta(event_name = "download://progress")]
pub struct DownloadProgressEvent(pub DownloadProgress);

/// `download://state` — lifecycle changes. When `installed` arrives the library inventory has
/// already been updated.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, tauri_specta::Event)]
#[tauri_specta(event_name = "download://state")]
pub struct DownloadStateEvent(pub DownloadStateChange);

/// Where download events go (the webview in the app, a recorder in tests).
pub trait UiEvents: Send + Sync + 'static {
    fn progress(&self, progress: DownloadProgress);
    fn state(&self, change: DownloadStateChange);
}

/// Emits the typed events to every webview.
pub struct TauriEvents<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriEvents<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> UiEvents for TauriEvents<R> {
    fn progress(&self, progress: DownloadProgress) {
        if let Err(e) = DownloadProgressEvent(progress).emit(&self.app) {
            tracing::debug!(error = %e, "could not emit download progress");
        }
    }

    fn state(&self, change: DownloadStateChange) {
        if let Err(e) = DownloadStateEvent(change).emit(&self.app) {
            tracing::warn!(error = %e, "could not emit a download state change");
        }
    }
}

/// Records a finished download: the inventory entry, an activity line dated today and — for
/// updates — `usage.updatesInstalled + 1` (the TypeScript mock's `finish()`).
pub fn record_finished_download(
    inventory: &dyn Inventory,
    request: &DownloadRequest,
    app: &InstalledApp,
    today: &str,
) -> Result<(), String> {
    let kind = match request.kind {
        DownloadKind::Install => ActivityKind::Installed,
        DownloadKind::Update => ActivityKind::Updated,
    };
    inventory
        .record(app, kind, &today.to_owned())
        .map_err(|e| e.to_string())
}

/// The engine's observer: records installs, then forwards events to the UI.
pub struct EngineBridge<I: Inventory> {
    pub inventory: I,
    pub clock: Clock,
    pub ui: Arc<dyn UiEvents>,
}

impl<I: Inventory + 'static> DownloadObserver for EngineBridge<I> {
    fn progress(&self, progress: DownloadProgress) {
        self.ui.progress(progress);
    }

    fn state(&self, change: DownloadStateChange) {
        tracing::info!(app = %change.app_id, phase = ?change.phase, "download");
        self.ui.state(change);
    }

    fn installed(&self, request: &DownloadRequest, app: &InstalledApp) -> Result<(), String> {
        record_finished_download(&self.inventory, request, app, &(self.clock)())
    }
}
