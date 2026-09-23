//! Payloads of the remote manifests (inside a [`crate::ManifestEnvelope`]).
//!
//! Layout on the CDN, relative to the configured base URL (`https://cdn.paparats.app/v1/`):
//!
//! | File            | Signed by        | Payload                                            |
//! |-----------------|------------------|----------------------------------------------------|
//! | `channels.json` | official key     | [`ChannelDirectory`]: every channel, its manifest URL and — for verified channels — its pinned keys |
//! | `catalog.json`  | official key     | [`CatalogManifest`]: the apps of every known channel, editorial content |
//! | `platform.json` | official key     | [`PlatformManifest`]: plans, ecosystem numbers      |
//! | a channel's `manifestUrl` | official key or the channel's pinned key (verified); unsigned or self-signed (community) | [`crate::ChannelManifest`]: the channel's releases (download URL, SHA-256, strategy) |
//!
//! Every payload carries its `generated` date; a verified copy is never replaced by an older one.

use paparats_core::{Catalog, ChannelInfo, IsoDate, PlatformInfo};
use serde::{Deserialize, Serialize};

/// `catalog.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogManifest {
    pub generated: IsoDate,
    pub catalog: Catalog,
}

/// `platform.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformManifest {
    pub generated: IsoDate,
    pub platform: PlatformInfo,
}

/// `channels.json`: the channel directory, signed by Paparats.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelDirectory {
    pub generated: IsoDate,
    pub channels: Vec<ChannelEntry>,
}

/// One channel of the directory: what the UI shows, where its manifest lives, and the keys
/// Paparats pinned for it after review.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelEntry {
    #[serde(flatten)]
    pub info: ChannelInfo,
    /// Absolute `https://` URL of the channel's release manifest. Its host joins the network
    /// allowlist once the directory has verified.
    pub manifest_url: String,
    /// Keys the channel signs its manifest with. Honoured for verified channels only; a
    /// community channel's keys are never pinned.
    #[serde(default)]
    pub keys: Vec<PublishedKey>,
}

/// A public key published in the directory.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishedKey {
    pub id: String,
    /// 32 bytes, base64 or hex.
    pub public_key: String,
}
