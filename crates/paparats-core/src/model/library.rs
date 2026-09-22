//! The user's library (installed apps, favorites, collections) and the download queue.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::catalog::AppId;
use super::text::{IsoDate, Text};

/// An app found on this PC (inventory), with the version that is installed.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub app_id: AppId,
    pub version: String,
    pub last_used: IsoDate,
}

/// A user collection in the Library. `apps: None` means "all installed apps".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LibraryCollection {
    pub id: String,
    pub icon: String,
    pub label: Text,
    pub apps: Option<Vec<AppId>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub installed: Vec<InstalledApp>,
    pub favorites: Vec<AppId>,
    pub collections: Vec<LibraryCollection>,
}

/// Whether a download installs an app for the first time or updates an installed one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DownloadKind {
    Install,
    Update,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub app_id: AppId,
    pub version: String,
    /// Bytes to transfer, in megabytes (update manifest size for updates, full size otherwise).
    #[specta(type = crate::Num)]
    pub size_mb: f64,
    pub kind: DownloadKind,
}

/// Lifecycle of a queue entry: `queued → downloading (pausable) → installing → gone`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DownloadState {
    Queued,
    Downloading,
    Paused,
    Installing,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
    pub app_id: AppId,
    pub version: String,
    pub kind: DownloadKind,
    pub state: DownloadState,
    /// 0–100.
    #[specta(type = crate::Num)]
    pub progress: f64,
    #[specta(type = crate::Num)]
    pub size_mb: f64,
}

/// The whole queue, in order: running items first, then queued ones.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSnapshot {
    pub items: Vec<DownloadItem>,
    /// Current "Parallel downloads" limit.
    pub concurrency: u8,
    pub online: bool,
}

/// Payload of the `download://progress` event (≥ 10 Hz while downloading).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub app_id: AppId,
    /// 0–100.
    #[specta(type = crate::Num)]
    pub progress: f64,
    #[specta(type = crate::Num)]
    pub received_mb: f64,
    #[specta(type = crate::Num)]
    pub size_mb: f64,
}

/// Payload of the `download://state` event.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum DownloadPhase {
    Queued,
    Downloading,
    Paused,
    Installing,
    /// Terminal: the app is recorded in the inventory at `version`.
    Installed {
        version: String,
        update: bool,
    },
    /// Terminal: removed from the queue by the user.
    Cancelled,
    /// Terminal: hash mismatch, network or installer error.
    Failed {
        message: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStateChange {
    pub app_id: AppId,
    pub phase: DownloadPhase,
}
