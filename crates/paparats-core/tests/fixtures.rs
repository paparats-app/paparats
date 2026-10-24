//! The mock data set in `fixtures/` must deserialise into the domain model — this keeps the
//! JSON, the Rust types and the generated TypeScript bindings in lock-step.

use paparats_core::*;
use serde::Deserialize;

fn load<T: for<'de> Deserialize<'de>>(name: &str) -> T {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(name);
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{name}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{name}: {e}"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ChannelsFile {
    channels: Vec<ChannelInfo>,
    subscriptions: Vec<ChannelSubscription>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct IdeasFile {
    ideas: Vec<Idea>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MetaFile {
    today: IsoDate,
    developer_channel: ChannelId,
    idea_bonus_until: IsoDate,
}

#[test]
fn catalog_fixture_matches_model() {
    let c: Catalog = load("catalog.json");
    assert_eq!(c.apps.len(), 32);
    assert_eq!(c.categories.len(), 9);
    for id in c.featured.iter().chain(&c.notable).chain(&c.pro_apps) {
        assert!(c.apps.iter().any(|a| &a.id == id), "unknown app {id}");
    }
    for u in &c.updates {
        assert!(
            c.apps.iter().any(|a| a.id == u.app_id),
            "update for unknown app {}",
            u.app_id
        );
    }
}

#[test]
fn fixture_update_manifests_carry_simulated_packages() {
    let c: Catalog = load("catalog.json");
    assert!(!c.updates.is_empty());
    for u in &c.updates {
        let app = c.apps.iter().find(|a| a.id == u.app_id);
        let p = u
            .package
            .as_ref()
            .unwrap_or_else(|| panic!("update {} has no package", u.app_id));
        assert_eq!(p.app_id, u.app_id);
        assert_eq!(Some(&p.version), app.map(|a| &a.version), "{}", u.app_id);
        assert_eq!(p.strategy, InstallStrategy::Simulated, "{}", u.app_id);
        assert_eq!(p.size_bytes, mb_to_bytes(u.download_mb), "{}", u.app_id);
        assert_eq!((&p.url, &p.sha256, &p.signer), (&None, &None, &None));
    }
}

#[test]
fn channel_fixture_matches_model() {
    let f: ChannelsFile = load("channels.json");
    assert!(
        f.channels
            .iter()
            .any(|c| c.id == OFFICIAL_CHANNEL && c.trust == TrustLevel::Official)
    );
    assert!(
        f.subscriptions
            .iter()
            .any(|s| s.channel_id == OFFICIAL_CHANNEL)
    );
}

#[test]
fn other_fixtures_match_model() {
    let ideas: IdeasFile = load("ideas.json");
    assert!(!ideas.ideas.is_empty());
    let account: Account = load("account.json");
    assert_eq!(account.subscription.plan, PlanId::Free);
    let platform: PlatformInfo = load("platform.json");
    assert_eq!(platform.plans.len(), 3);
    let library: Library = load("library.json");
    assert_eq!(library.installed.len(), 14);
    let meta: MetaFile = load("meta.json");
    assert_eq!(meta.developer_channel, "kvetka");
    assert!(meta.today < meta.idea_bonus_until);
}
