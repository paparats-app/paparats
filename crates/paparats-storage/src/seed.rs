//! First run: seeds the user's world from the mock data set (`fixtures/*.json`) — the library,
//! the followed channels, the ideas board and the account. Runs once per database.

use paparats_core::{Account, ChannelSubscription, Idea, Library};
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
            let seeded: Option<String> = rusqlite::OptionalExtension::optional(tx.query_row(
                "SELECT value FROM meta WHERE key = ?1",
                [SEEDED_KEY],
                |r| r.get(0),
            ))?;
            if seeded.is_some() {
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
}

#[cfg(test)]
mod tests {
    use super::*;

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
