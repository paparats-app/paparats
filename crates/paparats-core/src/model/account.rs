//! Account, subscription (Paparats Pro), devices, activity and stats.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::catalog::AppId;
use super::text::{IsoDate, Localized};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    pub email: String,
    /// Account creation date ("Member since …").
    pub since: IsoDate,
    pub country: Localized<String>,
    pub timezone: Localized<String>,
}

/// Editable part of the profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePatch {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub name: String,
    pub os: String,
    pub last_active: IsoDate,
    /// The PC this client runs on.
    pub current: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ActivityKind {
    Installed,
    Updated,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub kind: ActivityKind,
    pub app_id: AppId,
    pub version: String,
    pub date: IsoDate,
}

/// Personal usage numbers (Profile › Usage stats).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    /// Updates installed through Paparats over the account's lifetime.
    pub updates_installed: u32,
    pub time_saved_hours: u32,
}

/// Ecosystem numbers (Subscription › right column). Shown as "50+", "10,000+".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PlatformStats {
    pub developers: u32,
    pub apps: u32,
    pub pro_members: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum PlanId {
    Free,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum PlanPeriod {
    Forever,
    Month,
    Year,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PlanBadge {
    MostPopular,
    Save18,
}

/// A subscription plan. Names, subtitles and feature lists are UI copy (i18n catalogs, keyed by
/// `id`); the price is data and is formatted with `Intl.NumberFormat` (currency).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub id: PlanId,
    /// Price per period in major units, e.g. `4.99`.
    #[specta(type = crate::Num)]
    pub amount: f64,
    /// ISO 4217 code, e.g. `"USD"`.
    pub currency: String,
    pub period: PlanPeriod,
    pub badge: Option<PlanBadge>,
    /// Number of feature lines in the i18n catalog for this plan.
    pub feature_count: u8,
}

/// The user's Paparats Pro state. Pro is active when `plan != free` or a gift is running.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub plan: PlanId,
    /// Next renewal of a paid plan.
    pub renews_on: Option<IsoDate>,
    /// Pro granted as a thank-you for a released idea ("Paparats Pro · gift"), active until then.
    pub gift_until: Option<IsoDate>,
}

/// Length of the thank-you Pro gift for a released idea.
pub const IDEA_BONUS_MONTHS: u32 = 3;

/// Everything the account surfaces need, in one snapshot.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub signed_in: bool,
    pub profile: Profile,
    pub devices: Vec<Device>,
    pub activity: Vec<Activity>,
    pub usage: UsageStats,
    pub subscription: Subscription,
    pub two_factor: bool,
}

/// Storefront facts that are not personal: plans, ecosystem numbers, client build.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub platform_stats: PlatformStats,
    pub plans: Vec<Plan>,
    pub about: super::settings::AboutInfo,
    /// Which storefront surfaces the catalog turns on. Absent = all of them (the demo world).
    #[serde(default)]
    pub features: Features,
}

/// Storefront surfaces that need a server Paparats does not run yet. The demo world shows them
/// all; the real catalog turns off the ones with nothing behind them, so the client never shows
/// made-up numbers or buttons that cannot work.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Features {
    /// Paparats Pro: plans, the subscription screen, Pro badges and notes.
    pub pro: bool,
    /// Signing in, the profile, devices and activity.
    pub account: bool,
    /// The ideas board and idea pages.
    pub ideas: bool,
    /// Channels besides the official catalog: adding and following them, channel pages.
    pub channels: bool,
    /// User ratings and reviews (the real catalog shows GitHub stars instead).
    pub reviews: bool,
}

impl Default for Features {
    fn default() -> Self {
        Self {
            pro: true,
            account: true,
            ideas: true,
            channels: true,
            reviews: true,
        }
    }
}
