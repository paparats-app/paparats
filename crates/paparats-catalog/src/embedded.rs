//! The catalog source trait and the embedded mock data set (`fixtures/*.json`).

use paparats_core::{
    App, Catalog, ChannelId, ChannelInfo, ChannelSubscription, IsoDate, PlatformInfo,
};
use serde::Deserialize;

use crate::CatalogError;

/// Raw fixture files, compiled into the binary. The storage crate seeds the user's world from its
/// own copies of `library.json`, `ideas.json`, `account.json` and the subscriptions in
/// `channels.json`.
pub mod fixtures {
    pub const CATALOG: &str = include_str!("../../../fixtures/catalog.json");
    pub const CHANNELS: &str = include_str!("../../../fixtures/channels.json");
    pub const PLATFORM: &str = include_str!("../../../fixtures/platform.json");
    pub const META: &str = include_str!("../../../fixtures/meta.json");
}

/// `fixtures/meta.json`: the anchors of the mock world.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixtureMeta {
    /// The day the mock data set was written against (2026-09-15).
    pub today: IsoDate,
    /// Channel the developer view acts as (nilesoft).
    pub developer_channel: ChannelId,
    /// End of the idea thank-you gift in the data set (today + 3 months).
    pub idea_bonus_until: IsoDate,
}

#[derive(Deserialize)]
struct ChannelsFile {
    channels: Vec<ChannelInfo>,
    subscriptions: Vec<ChannelSubscription>,
}

/// Where the catalog comes from: the embedded mock data set ([`EmbeddedCatalog`]), or signed
/// manifests from the CDN and followed channels, verified and cached ([`crate::RemoteCatalog`],
/// behind the `catalog` flag of `PAPARATS_REAL`; see [`crate::from_flags`]).
pub trait CatalogSource: Send + Sync {
    /// Apps of every known channel, categories, editorial content, update manifests, reviews.
    fn catalog(&self) -> Result<Catalog, CatalogError>;
    /// Plans, ecosystem numbers, client build.
    fn platform(&self) -> Result<PlatformInfo, CatalogError>;
    /// Every channel known to the client, followed or not. Embedded: as published, before local
    /// sync. Remote: with this machine's last sync and outage (see `RemoteCatalog::channels`).
    fn channels(&self) -> Result<Vec<ChannelInfo>, CatalogError>;
}

/// The mock data set compiled into the binary.
#[derive(Debug, Clone)]
pub struct EmbeddedCatalog {
    catalog: Catalog,
    platform: PlatformInfo,
    channels: Vec<ChannelInfo>,
    subscriptions: Vec<ChannelSubscription>,
    meta: FixtureMeta,
}

fn parse<T: for<'de> Deserialize<'de>>(name: &'static str, text: &str) -> Result<T, CatalogError> {
    serde_json::from_str(text).map_err(|source| CatalogError::Fixture { name, source })
}

impl EmbeddedCatalog {
    /// Parses the embedded fixtures.
    pub fn load() -> Result<Self, CatalogError> {
        let channels: ChannelsFile = parse("channels.json", fixtures::CHANNELS)?;
        Ok(Self {
            catalog: parse("catalog.json", fixtures::CATALOG)?,
            platform: parse("platform.json", fixtures::PLATFORM)?,
            channels: channels.channels,
            subscriptions: channels.subscriptions,
            meta: parse("meta.json", fixtures::META)?,
        })
    }

    pub fn catalog_ref(&self) -> &Catalog {
        &self.catalog
    }

    pub fn platform_ref(&self) -> &PlatformInfo {
        &self.platform
    }

    pub fn channels_ref(&self) -> &[ChannelInfo] {
        &self.channels
    }

    /// The followed channels a fresh install starts with (the official catalog first).
    pub fn seed_subscriptions(&self) -> &[ChannelSubscription] {
        &self.subscriptions
    }

    pub fn meta(&self) -> &FixtureMeta {
        &self.meta
    }

    pub fn app(&self, id: &str) -> Option<&App> {
        self.catalog.apps.iter().find(|a| a.id == id)
    }

    pub fn channel(&self, id: &str) -> Option<&ChannelInfo> {
        self.channels.iter().find(|c| c.id == id)
    }
}

impl CatalogSource for EmbeddedCatalog {
    fn catalog(&self) -> Result<Catalog, CatalogError> {
        Ok(self.catalog.clone())
    }

    fn platform(&self) -> Result<PlatformInfo, CatalogError> {
        Ok(self.platform.clone())
    }

    fn channels(&self) -> Result<Vec<ChannelInfo>, CatalogError> {
        Ok(self.channels.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use paparats_core::{OFFICIAL_CHANNEL, TrustLevel};

    #[test]
    fn loads_the_mock_data_set() {
        let c = EmbeddedCatalog::load().unwrap();
        assert_eq!(c.catalog_ref().apps.len(), 32);
        assert_eq!(c.channels_ref().len(), 6);
        assert_eq!(c.platform_ref().plans.len(), 3);
        assert_eq!(c.meta().today, "2026-09-15");
        assert_eq!(c.meta().developer_channel, "nilesoft");
        assert_eq!(c.seed_subscriptions()[0].channel_id, OFFICIAL_CHANNEL);
        assert_eq!(
            c.channel(OFFICIAL_CHANNEL).map(|ch| ch.trust),
            Some(TrustLevel::Official)
        );
        assert_eq!(c.app("shell").map(|a| a.home_channel()), Some("nilesoft"));
        assert!(c.app("nope").is_none());
        // The trait returns owned copies of the same data.
        assert_eq!(&c.catalog().unwrap(), c.catalog_ref());
        assert_eq!(c.channels().unwrap().len(), 6);
        assert_eq!(&c.platform().unwrap(), c.platform_ref());
    }
}
