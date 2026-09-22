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
}
