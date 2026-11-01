//! First run. The demo world seeds the user's world from the mock data set (`fixtures/*.json`) —
//! the library, the followed channels, the ideas board and the account. The real app starts
//! empty instead ([`Storage::seed_local`]): the official catalog followed, nobody signed in.
//! Either runs once per database.

use paparats_core::{
    Account, ChannelSubscription, Idea, Library, Localized, OFFICIAL_CHANNEL, PlanId, Profile,
    Subscription, UsageStats,
};
use serde::Deserialize;

use crate::{Result, Storage, StorageError, account, channels, ideas, library, set_meta};

/// Raw fixture files the seed reads, compiled into the binary.
pub mod fixtures {
    pub const LIBRARY: &str = include_str!("../../../fixtures/library.json");
    pub const CHANNELS: &str = include_str!("../../../fixtures/channels.json");
    pub const IDEAS: &str = include_str!("../../../fixtures/ideas.json");
    pub const ACCOUNT: &str = include_str!("../../../fixtures/account.json");
}

/// Meta key marking a seeded database; the value names the data set.
const SEEDED_KEY: &str = "seeded";
const SEED_NAME: &str = "fixtures";
const LOCAL_SEED_NAME: &str = "local";

#[derive(Deserialize)]
struct ChannelsFile {
    subscriptions: Vec<ChannelSubscription>,
}

#[derive(Deserialize)]
struct IdeasFile {
    ideas: Vec<Idea>,
}

fn parse<T: for<'de> Deserialize<'de>>(name: &'static str, text: &str) -> Result<T> {
    serde_json::from_str(text).map_err(|source| StorageError::Fixture { name, source })
}

impl Storage {
    /// Whether the first-run seed has happened.
    pub fn is_seeded(&self) -> Result<bool> {
        Ok(self.meta(SEEDED_KEY)?.is_some())
    }

    /// Seeds the mock world on first run, in one transaction. Returns `false` (and changes
    /// nothing) when the database was already seeded.
    pub fn seed_from_fixtures(&self) -> Result<bool> {
        let library: Library = parse("library.json", fixtures::LIBRARY)?;
        let subscriptions =
            parse::<ChannelsFile>("channels.json", fixtures::CHANNELS)?.subscriptions;
        let board = parse::<IdeasFile>("ideas.json", fixtures::IDEAS)?.ideas;
        let account: Account = parse("account.json", fixtures::ACCOUNT)?;

        self.with_tx(|tx| {
            if self_seeded(tx)? {
                return Ok(false);
            }
            for app in &library.installed {
                library::upsert_installed(tx, app)?;
            }
            for app_id in &library.favorites {
                library::insert_favorite(tx, app_id)?;
            }
            for (position, collection) in (0_i64..).zip(&library.collections) {
                library::insert_collection(tx, position, collection)?;
            }
            for sub in &subscriptions {
                channels::insert_subscription(tx, sub)?;
            }
            for (position, idea) in (0_i64..).zip(&board) {
                ideas::insert_idea(tx, position, idea)?;
            }
            // The fixture lists activity newest first; the table reads back `ORDER BY id DESC`.
            for item in account.activity.iter().rev() {
                library::insert_activity(tx, item.kind, &item.app_id, &item.version, &item.date)?;
            }
            account::store(tx, &account)?;
            set_meta(tx, SEEDED_KEY, SEED_NAME)?;
            Ok(true)
        })
    }

    /// The real app's first run: follows the official catalog and stores a signed-out account
    /// with no history (`since` = `today`). Returns `false` (and changes nothing) when the
    /// database was already seeded.
    pub fn seed_local(&self, today: &str) -> Result<bool> {
        let empty = || Localized {
            en: String::new(),
            be: String::new(),
            ru: String::new(),
        };
        let account = Account {
            signed_in: false,
            profile: Profile {
                name: String::new(),
                email: String::new(),
                since: today.to_owned(),
                country: empty(),
                timezone: empty(),
            },
            devices: Vec::new(),
            activity: Vec::new(),
            usage: UsageStats {
                updates_installed: 0,
                time_saved_hours: 0,
            },
            subscription: Subscription {
                plan: PlanId::Free,
                renews_on: None,
                gift_until: None,
            },
            two_factor: false,
        };
        self.with_tx(|tx| {
            if self_seeded(tx)? {
                return Ok(false);
            }
            channels::insert_subscription(
                tx,
                &ChannelSubscription {
                    channel_id: OFFICIAL_CHANNEL.to_owned(),
                    paused: false,
                    stale_acknowledged: false,
                },
            )?;
            account::store(tx, &account)?;
            set_meta(tx, SEEDED_KEY, LOCAL_SEED_NAME)?;
            Ok(true)
        })
    }
}

fn self_seeded(tx: &rusqlite::Transaction<'_>) -> Result<bool> {
    let seeded: Option<String> = rusqlite::OptionalExtension::optional(tx.query_row(
        "SELECT value FROM meta WHERE key = ?1",
        [SEEDED_KEY],
        |r| r.get(0),
    ))?;
    Ok(seeded.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_real_app_starts_empty() {
        let s = Storage::open_in_memory().unwrap();
        assert!(s.seed_local("2026-11-01").unwrap());
        assert!(s.is_seeded().unwrap());
        assert!(
            !s.seed_local("2026-11-02").unwrap(),
            "second run is a no-op"
        );
        assert!(
            !s.seed_from_fixtures().unwrap(),
            "no demo data over a real database"
        );
        let account = s.account().unwrap();
        assert!(!account.signed_in);
        assert_eq!(account.profile.since, "2026-11-01");
        assert!(account.devices.is_empty() && account.activity.is_empty());
        assert_eq!(account.subscription.plan, PlanId::Free);
        let subs = s.subscriptions().unwrap();
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].channel_id, OFFICIAL_CHANNEL);
        assert!(s.installed_apps().unwrap().is_empty());
        assert!(s.ideas().unwrap().is_empty());
    }

    #[test]
    fn seeds_once() {
        let s = Storage::open_in_memory().unwrap();
        assert!(!s.is_seeded().unwrap());
        assert!(s.seed_from_fixtures().unwrap());
        assert!(s.is_seeded().unwrap());
        s.remove_installed("vscode").unwrap();
        assert!(!s.seed_from_fixtures().unwrap(), "second run is a no-op");
        assert_eq!(
            s.installed_apps().unwrap().len(),
            13,
            "user changes survive"
        );
        assert_eq!(s.subscriptions().unwrap().len(), 3);
        assert_eq!(s.ideas().unwrap().len(), 9);
    }

    #[test]
    fn seed_survives_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("paparats.db");
        {
            let s = Storage::open(&path).unwrap();
            assert!(s.seed_from_fixtures().unwrap());
            s.set_favorite("krita", true).unwrap();
        }
        let s = Storage::open(&path).unwrap();
        assert!(!s.seed_from_fixtures().unwrap());
        assert!(s.library().unwrap().favorites.contains(&"krita".to_owned()));
    }
}
