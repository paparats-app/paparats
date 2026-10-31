//! The catalog: apps, categories, editorial collections and slides, update manifests, reviews.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::detection::AppDetection;
use super::text::{IsoDate, Localized};

/// Stable app identifier, e.g. `"obsidian"`.
pub type AppId = String;
/// Stable channel identifier, e.g. `"kvetka"`. The official catalog is [`OFFICIAL_CHANNEL`].
pub type ChannelId = String;

/// Id of the official Paparats catalog channel — always subscribed, cannot be paused or removed.
pub const OFFICIAL_CHANNEL: &str = "paparats";

/// The nine fixed store categories. Labels and descriptions are UI copy (i18n catalogs).
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, Type,
)]
#[serde(rename_all = "lowercase")]
pub enum CategoryId {
    Productivity,
    Development,
    Design,
    Media,
    Utilities,
    System,
    Lifestyle,
    Games,
    Education,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: CategoryId,
    /// Number of apps in the full catalog (shown on tiles), not just the ones in this data set.
    pub catalog_count: u32,
    /// Lucide icon name in kebab-case, e.g. `"laptop"`.
    pub icon: String,
    /// Tint behind the category photograph, `#rrggbb`.
    pub hue: String,
}

/// One catalog entry. `channel` is the publishing channel (absent = official catalog);
/// `also_in` lists other channels that offer the same app (the source rule picks the most trusted).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct App {
    pub id: AppId,
    pub name: String,
    pub publisher: String,
    pub category: CategoryId,
    /// Monogram tile colour, `#rrggbb` (placeholder until publisher icons are wired).
    pub tint: String,
    /// Two-letter monogram shown on the tile.
    pub mono: String,
    /// Latest version in the catalog.
    pub version: String,
    /// Full download size of the latest version, in megabytes.
    #[specta(type = crate::Num)]
    pub size_mb: f64,
    /// Release date of the latest version.
    pub updated: IsoDate,
    pub license: String,
    pub portable: bool,
    /// Participates in Paparats Pro.
    pub pro: bool,
    pub pro_note: Option<Localized<String>>,
    pub tagline: Localized<String>,
    pub long: Localized<String>,
    pub channel: Option<ChannelId>,
    pub also_in: Vec<ChannelId>,
    /// Publisher icon URL from the catalog CDN; absent = monogram tile.
    pub icon_url: Option<String>,
    /// How the inventory recognises this app on the PC; absent = only the portable copies Paparats
    /// extracted itself are found.
    pub detection: Option<AppDetection>,
    /// Where the app comes from and what that means for the user. The real catalog fills it from
    /// the app's GitHub repository; the demo world has none.
    #[serde(default)]
    pub source: Option<AppSource>,
}

/// An app's GitHub repository and the facts the catalog bot read from it and from the release
/// it picked.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppSource {
    /// `owner/name` on GitHub; the release files come from its Releases.
    pub repo: String,
    /// GitHub stars when the catalog was built (shown instead of ratings).
    pub stars: u32,
    /// When the repository was created: the project's age on the "Rising" shelf.
    pub since: IsoDate,
    /// The project's website, when it names one.
    pub homepage: Option<String>,
    /// "Support the author" links from the repository's `FUNDING.yml`.
    #[serde(default)]
    pub funding: Vec<String>,
    /// The version is a 0.x release (the project calls it early).
    #[serde(default)]
    pub early: bool,
    /// The author does not sign the installer; Paparats checks it against the catalog's
    /// SHA-256 only.
    #[serde(default)]
    pub unsigned: bool,
    /// Installing asks for administrator rights.
    #[serde(default)]
    pub needs_admin: bool,
}

impl App {
    /// The publishing channel, defaulting to the official catalog.
    pub fn home_channel(&self) -> &str {
        self.channel.as_deref().unwrap_or(OFFICIAL_CHANNEL)
    }

    /// Every channel that offers this app: the home channel first, then `also_in`.
    pub fn candidate_channels(&self) -> impl Iterator<Item = &str> {
        std::iter::once(self.home_channel()).chain(self.also_in.iter().map(String::as_str))
    }
}

/// Editorial collection on Home / Browse ("Essential Windows Apps", …).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub icon: String,
    pub title: Localized<String>,
    pub sub: Localized<String>,
    pub apps: Vec<AppId>,
}

/// Where a Home hero slide's call to action leads.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum HeroTarget {
    Browse,
    Library,
    Categories,
    Subscription,
    /// The "Rising" collection (young projects), opened in Browse.
    Rising,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HeroSlide {
    pub kicker: Localized<String>,
    pub title1: Localized<String>,
    pub title2: Localized<String>,
    pub body: Localized<String>,
    pub cta: Localized<String>,
    pub quote: Localized<String>,
    pub target: HeroTarget,
}

/// Featured-app slide on Browse.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BrowseHero {
    pub app_id: AppId,
    pub title1: Localized<String>,
    pub title2: Localized<String>,
    pub body: Localized<String>,
    pub note: Localized<String>,
}

/// Release notes and download size of the latest version of an app (the update manifest).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateManifest {
    pub app_id: AppId,
    /// Size of the update download, in megabytes (may differ from the full install size).
    #[specta(type = crate::Num)]
    pub download_mb: f64,
    pub notes: Localized<Vec<String>>,
    /// The download manifest of the new version: install strategy, expected SHA-256 and signer.
    /// `None` (null or absent) in data sets that do not publish one; the mock world's are
    /// `simulated`.
    pub package: Option<super::package::Package>,
}

/// A user review. The mock data set shares one pool across apps.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub author: String,
    pub date: IsoDate,
    pub stars: u8,
    pub helpful: u32,
    pub text: Localized<String>,
}

/// Everything the discovery screens need, in one snapshot.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub apps: Vec<App>,
    pub categories: Vec<Category>,
    pub collections: Vec<Collection>,
    pub hero_slides: Vec<HeroSlide>,
    pub browse_heroes: Vec<BrowseHero>,
    /// App ids for the "Featured apps" rows.
    pub featured: Vec<AppId>,
    /// App ids for "New and notable".
    pub notable: Vec<AppId>,
    /// App ids shown under "Popular apps with Pro features".
    pub pro_apps: Vec<AppId>,
    pub updates: Vec<UpdateManifest>,
    /// Fallback release notes for versions without a manifest (version history).
    pub generic_notes: Localized<Vec<String>>,
    pub review_pool: Vec<Review>,
}
