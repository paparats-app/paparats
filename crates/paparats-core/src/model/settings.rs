//! User settings (Settings screen) and build information (Settings › About).

use serde::{Deserialize, Serialize};
use specta::Type;

use super::text::Locale;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum UpdateSchedule {
    Hourly,
    Daily,
    Weekly,
}

/// Every persisted setting. Field names match the settings-row ids of the design
/// (`README.md` › Settings); defaults match the prototype.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    // General
    pub theme: ThemePreference,
    pub locale: Locale,
    pub startup: bool,
    pub tray: bool,
    pub recommend: bool,
    pub animations: bool,
    // Updates
    pub auto: bool,
    pub schedule: UpdateSchedule,
    pub metered: bool,
    pub notify_ready: bool,
    // Downloads
    pub location: String,
    /// "Parallel downloads": 1, 2 or 4.
    pub parallel: u8,
    pub keep: bool,
    // Apps
    pub per_user: bool,
    pub shortcuts: bool,
    pub open_after: bool,
    // Notifications
    pub n_updates: bool,
    pub n_new: bool,
    pub n_sound: bool,
    // Privacy
    pub crash: bool,
    // Advanced
    pub dev: bool,
    pub portable: bool,
    /// Developer mode tool: act as the Kvetka channel on the Ideas board.
    pub view_as_developer: bool,
    /// Developer mode tool: pretend the network is down.
    pub simulate_offline: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::Dark,
            locale: Locale::En,
            startup: true,
            tray: true,
            recommend: true,
            animations: true,
            auto: true,
            schedule: UpdateSchedule::Hourly,
            metered: false,
            notify_ready: true,
            location: r"C:\Program Files\Paparats".to_owned(),
            parallel: 2,
            keep: false,
            per_user: true,
            shortcuts: false,
            open_after: true,
            n_updates: true,
            n_new: false,
            n_sound: false,
            crash: false,
            dev: false,
            portable: false,
            view_as_developer: false,
            simulate_offline: false,
        }
    }
}

/// Settings › About.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AboutInfo {
    pub version: String,
    pub build: String,
}

/// Result of "Check for updates" (the Paparats client itself).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SelfUpdateCheck {
    UpToDate,
    Available { version: String },
}
