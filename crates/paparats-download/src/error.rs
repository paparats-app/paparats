use paparats_install::{Cancelled, InstallError};

/// Errors of the download engine and its transfers.
#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("download was cancelled")]
    Cancelled,
    #[error("the package has no download URL")]
    MissingUrl,
    #[error("the package manifest has no SHA-256 hash")]
    MissingHash,
    #[error("invalid download URL: {0}")]
    InvalidUrl(String),
    #[error("host is not on the network allowlist: {0}")]
    HostNotAllowed(String),
    #[error("plain HTTP is only allowed for loopback hosts: {0}")]
    InsecureUrl(String),
    #[error("server answered HTTP {0}")]
    Http(u16),
    #[error("network error: {0}")]
    Network(String),
    #[error("download is larger than the manifest says ({expected} bytes)")]
    TooLarge { expected: u64 },
    #[error("SHA-256 mismatch: expected {expected}, got {actual}")]
    HashMismatch { expected: String, actual: String },
    #[error("file error: {0}")]
    Io(#[from] std::io::Error),
    #[error("install failed: {0}")]
    Install(#[from] InstallError),
    #[error("invalid download concurrency {0} (must be at least 1)")]
    InvalidConcurrency(u8),
}

impl From<Cancelled> for DownloadError {
    fn from(_: Cancelled) -> Self {
        Self::Cancelled
    }
}

impl From<reqwest::Error> for DownloadError {
    fn from(e: reqwest::Error) -> Self {
        // `without_url` keeps query strings (tokens) out of messages and logs.
        Self::Network(e.without_url().to_string())
    }
}
