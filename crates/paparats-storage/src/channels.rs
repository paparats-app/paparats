//! Followed channels (in the order they were added) and the last successful sync per channel.

use std::collections::BTreeMap;

use paparats_core::{ChannelId, ChannelSubscription, IsoDate};
use rusqlite::{Connection, Transaction, params};

use crate::{Result, Storage, StorageError};

fn subscriptions(conn: &Connection) -> Result<Vec<ChannelSubscription>> {
    let mut stmt = conn.prepare(
        "SELECT channel_id, paused, stale_acknowledged FROM channel_subscriptions
         ORDER BY position, channel_id",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ChannelSubscription {
            channel_id: r.get(0)?,
            paused: r.get(1)?,
            stale_acknowledged: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub(crate) fn insert_subscription(tx: &Transaction<'_>, sub: &ChannelSubscription) -> Result<bool> {
    let inserted = tx.execute(
        "INSERT OR IGNORE INTO channel_subscriptions (channel_id, position, paused, stale_acknowledged)
         VALUES (?1, (SELECT COALESCE(MAX(position), -1) + 1 FROM channel_subscriptions), ?2, ?3)",
        params![sub.channel_id, sub.paused, sub.stale_acknowledged],
    )?;
    Ok(inserted > 0)
}

fn update_flag(tx: &Transaction<'_>, sql: &str, channel_id: &str, value: bool) -> Result<()> {
    if tx.execute(sql, params![channel_id, value])? == 0 {
        return Err(StorageError::NotFound(format!(
            "subscription to {channel_id}"
        )));
    }
    Ok(())
}

impl Storage {
    /// Followed channels, in the order they were added.
    pub fn subscriptions(&self) -> Result<Vec<ChannelSubscription>> {
        self.read(subscriptions)
    }

    /// Follows a channel (switched on, callout not acknowledged). Following twice is a no-op.
    /// Returns the subscriptions.
    pub fn subscribe(&self, channel_id: &str) -> Result<Vec<ChannelSubscription>> {
        self.with_tx(|tx| {
            insert_subscription(
                tx,
                &ChannelSubscription {
                    channel_id: channel_id.to_owned(),
                    paused: false,
                    stale_acknowledged: false,
                },
            )?;
            subscriptions(tx)
        })
    }

    /// Unfollows a channel (forgetting its paused/acknowledged flags). Returns the subscriptions.
    pub fn unsubscribe(&self, channel_id: &str) -> Result<Vec<ChannelSubscription>> {
        self.with_tx(|tx| {
            tx.execute(
                "DELETE FROM channel_subscriptions WHERE channel_id = ?1",
                [channel_id],
            )?;
            subscriptions(tx)
        })
    }

    /// Switches a followed channel off/on (`NotFound` when it is not followed).
    pub fn set_subscription_paused(
        &self,
        channel_id: &str,
        paused: bool,
    ) -> Result<Vec<ChannelSubscription>> {
        self.with_tx(|tx| {
            update_flag(
                tx,
                "UPDATE channel_subscriptions SET paused = ?2 WHERE channel_id = ?1",
                channel_id,
                paused,
            )?;
            subscriptions(tx)
        })
    }

    /// "Keep" on the stale callout (`NotFound` when the channel is not followed).
    pub fn acknowledge_stale(&self, channel_id: &str) -> Result<Vec<ChannelSubscription>> {
        self.with_tx(|tx| {
            update_flag(
                tx,
                "UPDATE channel_subscriptions SET stale_acknowledged = ?2 WHERE channel_id = ?1",
                channel_id,
                true,
            )?;
            subscriptions(tx)
        })
    }

    /// Last successful "Sync now" per channel (overrides the published `synced` date).
    pub fn channel_sync_dates(&self) -> Result<BTreeMap<ChannelId, IsoDate>> {
        self.read(|c| {
            let mut stmt = c.prepare("SELECT channel_id, synced FROM channel_sync")?;
            let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
            Ok(rows.collect::<rusqlite::Result<_>>()?)
        })
    }

    pub fn set_channel_synced(&self, channel_id: &str, date: &IsoDate) -> Result<()> {
        self.with_tx(|tx| {
            tx.execute(
                "INSERT INTO channel_sync (channel_id, synced) VALUES (?1, ?2)
                 ON CONFLICT(channel_id) DO UPDATE SET synced = excluded.synced",
                params![channel_id, date],
            )?;
            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded() -> Storage {
        let s = Storage::open_in_memory().unwrap();
        s.seed_from_fixtures().unwrap();
        s
    }

    fn ids(subs: &[ChannelSubscription]) -> Vec<&str> {
        subs.iter().map(|s| s.channel_id.as_str()).collect()
    }

    #[test]
    fn follow_and_unfollow_in_order() {
        let s = seeded();
        assert_eq!(
            ids(&s.subscriptions().unwrap()),
            ["paparats", "nilesoft", "fossfriends"]
        );
        let subs = s.subscribe("winaero").unwrap();
        assert_eq!(
            ids(&subs),
            ["paparats", "nilesoft", "fossfriends", "winaero"]
        );
        assert_eq!(s.subscribe("winaero").unwrap().len(), 4, "idempotent");
        let subs = s.unsubscribe("nilesoft").unwrap();
        assert_eq!(ids(&subs), ["paparats", "fossfriends", "winaero"]);
        let subs = s.subscribe("nilesoft").unwrap();
        assert_eq!(ids(&subs).last(), Some(&"nilesoft"), "re-follow goes last");
    }

    #[test]
    fn flags_need_a_subscription_and_reset_on_unfollow() {
        let s = seeded();
        let subs = s.set_subscription_paused("nilesoft", true).unwrap();
        assert!(subs[1].paused);
        let subs = s.acknowledge_stale("fossfriends").unwrap();
        assert!(subs[2].stale_acknowledged);
        assert!(matches!(
            s.set_subscription_paused("winaero", true),
            Err(StorageError::NotFound(_))
        ));
        assert!(matches!(
            s.acknowledge_stale("winaero"),
            Err(StorageError::NotFound(_))
        ));
        s.unsubscribe("nilesoft").unwrap();
        let subs = s.subscribe("nilesoft").unwrap();
        assert!(!subs.last().unwrap().paused);
    }

    #[test]
    fn sync_dates() {
        let s = seeded();
        assert!(s.channel_sync_dates().unwrap().is_empty());
        s.set_channel_synced("nilesoft", &"2026-09-15".into())
            .unwrap();
        s.set_channel_synced("nilesoft", &"2026-09-16".into())
            .unwrap();
        let dates = s.channel_sync_dates().unwrap();
        assert_eq!(
            dates.get("nilesoft").map(String::as_str),
            Some("2026-09-16")
        );
    }
}
