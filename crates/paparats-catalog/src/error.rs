use paparats_core::dates::DateError;
use paparats_storage::StorageError;

/// Errors of the catalog crate.
#[derive(Debug, thiserror::Error)]
pub enum CatalogError {
    #[error("embedded fixture {name} is malformed: {source}")]
    Fixture {
        name: &'static str,
        #[source]
        source: serde_json::Error,
    },
    #[error("manifest signature does not match any trusted key")]
    BadSignature,
    #[error("manifest signature is malformed: {0}")]
    MalformedSignature(String),
    #[error("public key is malformed: {0}")]
    MalformedKey(String),
    #[error("manifest payload is malformed: {0}")]
    MalformedManifest(#[source] serde_json::Error),
    #[error("no trusted manifest keys are configured")]
    NoTrustedKeys,

    // Remote catalog (M7).
    #[error("manifest envelope is malformed: {0}")]
    MalformedEnvelope(String),
    #[error("manifest is not signed")]
    Unsigned,
    #[error("manifest is signed with an unknown key {0:?}")]
    UnknownKey(String),
    #[error("manifest belongs to channel {found:?}, expected {expected:?}")]
    ChannelMismatch { expected: String, found: String },
    #[error("manifest from {received} is older than the verified copy from {cached}")]
    Rollback { cached: String, received: String },
    #[error("manifest lists an invalid package for {app_id}: {reason}")]
    InvalidPackage { app_id: String, reason: String },
    #[error("invalid manifest URL: {0}")]
    InvalidUrl(String),
    #[error("plain HTTP is only allowed for loopback hosts: {0}")]
    InsecureUrl(String),
    #[error("host is not on the network allowlist: {0}")]
    HostNotAllowed(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("server answered HTTP {0}")]
    Http(u16),
    #[error("manifest is larger than {limit} bytes")]
    TooLarge { limit: u64 },
    #[error("unknown channel {0}")]
    UnknownChannel(String),
    #[error("no verified {0} is available yet (never fetched, nothing cached)")]
    Unavailable(&'static str),
    #[error("invalid date in a manifest: {0}")]
    Date(#[from] DateError),
    #[error("manifest cache: {0}")]
    Storage(#[from] StorageError),
}

impl From<reqwest::Error> for CatalogError {
    fn from(e: reqwest::Error) -> Self {
        // `without_url` keeps query strings out of messages and logs.
        Self::Network(e.without_url().to_string())
    }
}
