//! Catalog and channel data: where it comes from ([`CatalogSource`]: the embedded mock data set,
//! or — behind the `catalog` flag of `PAPARATS_REAL` — signed manifests from the CDN through
//! [`RemoteCatalog`]), the install-source rule, channel look-up and the manifest signature check.

mod backend;
mod embedded;
mod envelope;
mod error;
pub mod hex;
mod manifest;
pub mod remote;
pub mod rules;

pub use backend::{CatalogBackend, from_flags};
pub use embedded::{CatalogSource, EmbeddedCatalog, FixtureMeta, fixtures};
pub use envelope::{
    CommunityPayload, KeyRing, ManifestEnvelope, TrustWarning, decode_key_bytes, key_fingerprint,
    open_community, parse_public_key, sign_envelope,
};
pub use error::CatalogError;
pub use manifest::{
    ChannelManifest, Ed25519Verifier, ManifestVerifier, SignedManifest, verify_manifest,
};
pub use remote::wire::{
    CatalogManifest, ChannelDirectory, ChannelEntry, PlatformManifest, PublishedKey,
};
pub use remote::{
    ChannelPackage, ChannelReleases, Freshness, OUTAGE_AFTER_FAILURES, RefreshReport,
    RemoteCatalog, RemoteConfig,
};
pub use rules::{
    alternatives, down_days, find_channel, is_active, is_stale, lookup, normalize_address,
    resolve_source,
};
