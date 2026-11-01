//! Distribution channels (sources), trust levels and the source rule.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::catalog::{AppId, ChannelId};
use super::text::{IsoDate, Localized};

/// How much Paparats vouches for a channel. Ordered from most to least trusted.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, Type,
)]
#[serde(rename_all = "lowercase")]
pub enum TrustLevel {
    /// The Paparats catalog: curated, tested and signed by Paparats.
    Official,
    /// Author reviewed by Paparats; files from the author's own releases.
    Verified,
    /// Anyone can publish; files come straight from the author's server.
    Community,
}

impl TrustLevel {
    /// Lower is more trusted (official 0 › verified 1 › community 2).
    pub fn rank(self) -> u8 {
        match self {
            TrustLevel::Official => 0,
            TrustLevel::Verified => 1,
            TrustLevel::Community => 2,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ChannelKind {
    Catalog,
    Developer,
    Curated,
}

/// Where a channel's binaries are served from. Paparats mirrors nothing: every file comes from
/// its author's own releases (D68). One variant today; the field stays so a manifest can say so.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum FileHost {
    /// The author's own releases (GitHub Releases for the official catalog).
    Author,
}

/// A distribution channel (named `ChannelInfo` because `Channel` is taken by the Tauri IPC runtime).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChannelInfo {
    pub id: ChannelId,
    pub name: String,
    pub kind: ChannelKind,
    pub trust: TrustLevel,
    pub author: String,
    /// Address without scheme, e.g. `kvetka.example/paparats`.
    pub addr: String,
    /// Short code including the `@`, e.g. `@kvetka`.
    pub handle: String,
    pub tint: String,
    pub mono: String,
    pub subscribers: u32,
    /// Last successful sync; `None` = never synced.
    pub synced: Option<IsoDate>,
    pub files: FileHost,
    /// Where problem reports go (Paparats keeps a copy).
    pub support: String,
    pub desc: Localized<String>,
    /// Date of the manual Paparats review (verified channels).
    pub reviewed: Option<IsoDate>,
    /// Date the channel stopped answering; `None` = reachable.
    pub outage: Option<IsoDate>,
}

/// A followed channel that has not answered for this many days gets the stale callout
/// ("Keep" / "Unsubscribe").
pub const STALE_AFTER_DAYS: u32 = 14;

/// The user's relationship with a followed channel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChannelSubscription {
    pub channel_id: ChannelId,
    /// Followed but switched off: its apps are hidden and its updates are not fetched.
    pub paused: bool,
    /// The user chose "Keep" on the stale callout.
    pub stale_acknowledged: bool,
}

/// Result of looking a channel up by address, host or `@handle`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ChannelLookup {
    Found { channel: ChannelInfo },
    AlreadySubscribed { channel: ChannelInfo },
    NotFound,
}

/// Result of "Sync now".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SyncOutcome {
    Synced { at: IsoDate },
    Unreachable { days: u32 },
}

/// What a problem report is about.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ReportTarget {
    pub app_id: Option<AppId>,
    pub channel_id: ChannelId,
}

/// Where a report went: the Paparats team only (official catalog) or the channel author with a
/// copy to Paparats.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ReportReceipt {
    Paparats,
    Author {
        channel_name: String,
        author: String,
    },
}
