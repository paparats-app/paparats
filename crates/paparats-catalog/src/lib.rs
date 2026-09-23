//! Catalog and channel data: where it comes from ([`CatalogSource`]; today the embedded mock data
//! set, later signed manifests from the CDN), the install-source rule, channel look-up and the
//! manifest signature check.

mod embedded;
mod error;
pub mod hex;
mod manifest;
pub mod rules;

pub use embedded::{CatalogSource, EmbeddedCatalog, FixtureMeta, fixtures};
pub use error::CatalogError;
pub use manifest::{
    ChannelManifest, Ed25519Verifier, ManifestVerifier, SignedManifest, verify_manifest,
};
pub use rules::{
    alternatives, down_days, find_channel, is_active, is_stale, lookup, normalize_address,
    resolve_source,
};
