//! Picking the catalog strategy at start: the embedded mock data set (default) or the real
//! remote catalog, behind the `catalog` flag of `PAPARATS_REAL` (parsed once, by the app).

use std::sync::Arc;

use paparats_core::{Catalog, ChannelInfo, PlatformInfo};
use paparats_storage::Storage;

use crate::{CatalogError, CatalogSource, EmbeddedCatalog, RemoteCatalog, RemoteConfig};

/// The catalog the app runs on.
#[derive(Debug, Clone)]
pub enum CatalogBackend {
    /// The mock data set compiled into the binary.
    Embedded(Arc<EmbeddedCatalog>),
    /// Signed manifests from the CDN, verified and cached.
    Remote(Arc<RemoteCatalog>),
}

impl CatalogBackend {
    /// The remote catalog, when it is the one in use (refresh, channel sync, packages).
    pub fn remote(&self) -> Option<&Arc<RemoteCatalog>> {
        match self {
            Self::Remote(remote) => Some(remote),
            Self::Embedded(_) => None,
        }
    }

    pub fn is_remote(&self) -> bool {
        matches!(self, Self::Remote(_))
    }
}

impl CatalogSource for CatalogBackend {
    fn catalog(&self) -> Result<Catalog, CatalogError> {
        match self {
            Self::Embedded(c) => c.catalog(),
            Self::Remote(c) => c.catalog(),
        }
    }

    fn platform(&self) -> Result<PlatformInfo, CatalogError> {
        match self {
            Self::Embedded(c) => c.platform(),
            Self::Remote(c) => c.platform(),
        }
    }

    fn channels(&self) -> Result<Vec<ChannelInfo>, CatalogError> {
        match self {
            Self::Embedded(c) => c.channels(),
            Self::Remote(c) => c.channels(),
        }
    }
}

/// `real` is the `catalog` flag of `PAPARATS_REAL`. Off: the embedded mock data set (`config`
/// is not used). On: a [`RemoteCatalog`] over `storage`, loaded from its cache — call
/// [`RemoteCatalog::refresh`] (and `sync_channels` for the active subscriptions) once a runtime
/// is up. Fails when the remote cannot be set up (no pinned official key, a bad base URL).
pub fn from_flags(
    real: bool,
    storage: Arc<Storage>,
    config: RemoteConfig,
) -> Result<CatalogBackend, CatalogError> {
    if real {
        tracing::info!(base = %config.base_url, "catalog: remote (PAPARATS_REAL)");
        Ok(CatalogBackend::Remote(Arc::new(RemoteCatalog::new(
            config, storage,
        )?)))
    } else {
        Ok(CatalogBackend::Embedded(Arc::new(EmbeddedCatalog::load()?)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::KeyRing;
    use ed25519_dalek::SigningKey;

    fn keys() -> KeyRing {
        KeyRing::new()
            .with("test", SigningKey::from_bytes(&[7; 32]).verifying_key())
            .unwrap()
    }

    #[test]
    fn the_flag_picks_the_strategy() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let config = RemoteConfig::new("https://paparats-app.github.io/v1", keys());

        let mock = from_flags(false, Arc::clone(&storage), config.clone()).unwrap();
        assert!(!mock.is_remote());
        assert_eq!(mock.catalog().unwrap().apps.len(), 32);
        assert_eq!(mock.channels().unwrap().len(), 6);
        assert_eq!(mock.platform().unwrap().plans.len(), 3);

        let real = from_flags(true, Arc::clone(&storage), config.clone()).unwrap();
        assert!(real.is_remote() && real.remote().is_some());
        // Nothing fetched or cached yet.
        assert!(matches!(real.catalog(), Err(CatalogError::Unavailable(_))));
        assert!(matches!(real.platform(), Err(CatalogError::Unavailable(_))));
        assert!(matches!(real.channels(), Err(CatalogError::Unavailable(_))));

        // No pinned key, or a base URL that is not HTTPS: the remote cannot be set up.
        let unkeyed = config.clone().with_official_keys(KeyRing::new());
        assert!(matches!(
            from_flags(true, Arc::clone(&storage), unkeyed),
            Err(CatalogError::NoTrustedKeys)
        ));
        let insecure = config.with_base_url("http://paparats-app.github.io/v1/");
        assert!(matches!(
            from_flags(true, storage, insecure),
            Err(CatalogError::InsecureUrl(_))
        ));
    }
}
