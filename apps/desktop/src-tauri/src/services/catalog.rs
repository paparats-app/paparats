//! CatalogService.

use paparats_catalog::CatalogSource;
use paparats_core::{Catalog, PlatformInfo};

use super::AppState;
use crate::error::AppResult;

impl AppState {
    /// The full catalog (apps of every known channel; the UI filters by followed channels).
    /// With the remote catalog and nothing cached, waits for the first refresh.
    pub async fn get_catalog(&self) -> AppResult<Catalog> {
        self.catalog_ready().await;
        Ok(self.catalog.catalog()?)
    }

    /// Plans, ecosystem numbers and Settings › About. The version is this binary's.
    pub async fn get_platform(&self) -> AppResult<PlatformInfo> {
        self.catalog_ready().await;
        let mut platform = self.catalog.platform()?;
        env!("CARGO_PKG_VERSION").clone_into(&mut platform.about.version);
        Ok(platform)
    }
}

#[cfg(test)]
mod tests {
    use super::super::testing::state;

    #[tokio::test]
    async fn catalog_and_platform() {
        let (s, _) = state();
        assert_eq!(s.get_catalog().await.unwrap().apps.len(), 32);
        let p = s.get_platform().await.unwrap();
        assert_eq!(p.plans.len(), 3);
        assert_eq!(p.about.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(p.about.build, "20260915");
    }
}
