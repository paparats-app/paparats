//! The remote catalog's local state (M7): the last verified copy of every signed manifest the
//! client fetched — the raw envelope exactly as served, with its `ETag` for `If-None-Match` — and
//! per-channel reachability, from which the catalog crate derives outages.
//!
//! Only manifests whose signature checked out are written here; the catalog crate verifies them
//! again when it loads them, so a copy that no longer verifies (a rotated key) is never used.

use std::collections::BTreeMap;

use paparats_core::{ChannelId, IsoDate};
use rusqlite::{Connection, OptionalExtension, Transaction, params};

use crate::{Result, Storage};

/// A cached manifest: the body as served and the validator to revalidate it with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CachedManifest {
    /// The URL it was fetched from (the cache key).
    pub url: String,
    /// The server's `ETag`, sent back as `If-None-Match`.
    pub etag: Option<String>,
    /// The envelope bytes exactly as served.
    pub body: Vec<u8>,
    /// Last day the server confirmed this copy (200 or 304).
    pub fetched: IsoDate,
}

/// Consecutive failed syncs of a channel, since `first_failure`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChannelHealth {
    pub failures: u32,
    pub first_failure: IsoDate,
    pub last_failure: IsoDate,
}

fn health_row(conn: &Connection, channel_id: &str) -> Result<Option<ChannelHealth>> {
    Ok(conn
        .query_row(
            "SELECT failures, first_failure, last_failure FROM channel_health
             WHERE channel_id = ?1",
            [channel_id],
            |r| {
                Ok(ChannelHealth {
                    failures: r.get(0)?,
                    first_failure: r.get(1)?,
                    last_failure: r.get(2)?,
                })
            },
        )
        .optional()?)
}

fn set_synced(tx: &Transaction<'_>, channel_id: &str, date: &str) -> Result<()> {
    tx.execute(
        "INSERT INTO channel_sync (channel_id, synced) VALUES (?1, ?2)
         ON CONFLICT(channel_id) DO UPDATE SET synced = excluded.synced",
        params![channel_id, date],
    )?;
    Ok(())
}

impl Storage {
    /// The last verified copy fetched from `url`.
    pub fn cached_manifest(&self, url: &str) -> Result<Option<CachedManifest>> {
        self.read(|c| {
            Ok(c.query_row(
                "SELECT url, etag, body, fetched FROM manifest_cache WHERE url = ?1",
                [url],
                |r| {
                    Ok(CachedManifest {
                        url: r.get(0)?,
                        etag: r.get(1)?,
                        body: r.get(2)?,
                        fetched: r.get(3)?,
                    })
                },
            )
            .optional()?)
        })
    }

    /// Stores (or replaces) a verified copy.
    pub fn put_cached_manifest(&self, entry: &CachedManifest) -> Result<()> {
        self.with_tx(|tx| {
            tx.execute(
                "INSERT INTO manifest_cache (url, etag, body, fetched) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(url) DO UPDATE SET
                     etag = excluded.etag, body = excluded.body, fetched = excluded.fetched",
                params![entry.url, entry.etag, entry.body, entry.fetched],
            )?;
            Ok(())
        })
    }

    /// The server answered `304 Not Modified`: the copy is current as of `fetched`. Returns
    /// whether a copy was there.
    pub fn touch_cached_manifest(&self, url: &str, fetched: &str) -> Result<bool> {
        self.with_tx(|tx| {
            Ok(tx.execute(
                "UPDATE manifest_cache SET fetched = ?2 WHERE url = ?1",
                params![url, fetched],
            )? > 0)
        })
    }

    /// Forgets a copy (one that no longer verifies).
    pub fn remove_cached_manifest(&self, url: &str) -> Result<()> {
        self.with_tx(|tx| {
            tx.execute("DELETE FROM manifest_cache WHERE url = ?1", [url])?;
            Ok(())
        })
    }

    /// Channels whose last sync failed, with their current failure streak.
    pub fn channel_health(&self) -> Result<BTreeMap<ChannelId, ChannelHealth>> {
        self.read(|c| {
            let mut stmt = c.prepare(
                "SELECT channel_id, failures, first_failure, last_failure FROM channel_health",
            )?;
            let rows = stmt.query_map([], |r| {
                Ok((
                    r.get(0)?,
                    ChannelHealth {
                        failures: r.get(1)?,
                        first_failure: r.get(2)?,
                        last_failure: r.get(3)?,
                    },
                ))
            })?;
            Ok(rows.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// A sync of `channel_id` failed on `date`: extends the streak (starting it on `date`).
    /// Returns the streak.
    pub fn record_channel_failure(&self, channel_id: &str, date: &str) -> Result<ChannelHealth> {
        self.with_tx(|tx| {
            tx.execute(
                "INSERT INTO channel_health (channel_id, failures, first_failure, last_failure)
                 VALUES (?1, 1, ?2, ?2)
                 ON CONFLICT(channel_id) DO UPDATE SET
                     failures = failures + 1, last_failure = excluded.last_failure",
                params![channel_id, date],
            )?;
            health_row(tx, channel_id)?
                .ok_or_else(|| crate::StorageError::NotFound(format!("health of {channel_id}")))
        })
    }

    /// A sync of `channel_id` succeeded on `date`: stamps the sync date (like
    /// [`Storage::set_channel_synced`]) and ends any failure streak, in one transaction.
    pub fn record_channel_success(&self, channel_id: &str, date: &str) -> Result<()> {
        self.with_tx(|tx| {
            set_synced(tx, channel_id, date)?;
            tx.execute(
                "DELETE FROM channel_health WHERE channel_id = ?1",
                [channel_id],
            )?;
            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(url: &str, etag: Option<&str>, body: &[u8]) -> CachedManifest {
        CachedManifest {
            url: url.into(),
            etag: etag.map(str::to_owned),
            body: body.to_vec(),
            fetched: "2026-09-15".into(),
        }
    }

    #[test]
    fn manifest_cache_round_trip() {
        let s = Storage::open_in_memory().unwrap();
        let url = "https://cdn.paparats.app/v1/catalog.json";
        assert_eq!(s.cached_manifest(url).unwrap(), None);
        assert!(!s.touch_cached_manifest(url, "2026-09-16").unwrap());

        s.put_cached_manifest(&entry(url, Some("\"v1\""), b"{\"a\":1}"))
            .unwrap();
        s.put_cached_manifest(&entry(url, Some("\"v2\""), b"{\"a\":2}"))
            .unwrap();
        let cached = s.cached_manifest(url).unwrap().unwrap();
        assert_eq!(cached.etag.as_deref(), Some("\"v2\""));
        assert_eq!(cached.body, b"{\"a\":2}");

        assert!(s.touch_cached_manifest(url, "2026-09-16").unwrap());
        assert_eq!(
            s.cached_manifest(url).unwrap().unwrap().fetched,
            "2026-09-16"
        );

        s.put_cached_manifest(&entry("https://x.test/m.json", None, b"{}"))
            .unwrap();
        assert_eq!(
            s.cached_manifest("https://x.test/m.json")
                .unwrap()
                .unwrap()
                .etag,
            None
        );
        s.remove_cached_manifest(url).unwrap();
        assert_eq!(s.cached_manifest(url).unwrap(), None);
    }

    #[test]
    fn failure_streaks_start_on_the_first_failure_and_end_on_success() {
        let s = Storage::open_in_memory().unwrap();
        assert!(s.channel_health().unwrap().is_empty());

        let h = s.record_channel_failure("nilesoft", "2026-09-10").unwrap();
        assert_eq!((h.failures, h.first_failure.as_str()), (1, "2026-09-10"));
        let h = s.record_channel_failure("nilesoft", "2026-09-12").unwrap();
        assert_eq!(h.failures, 2);
        assert_eq!(h.first_failure, "2026-09-10", "the streak keeps its start");
        assert_eq!(h.last_failure, "2026-09-12");
        s.record_channel_failure("winaero", "2026-09-12").unwrap();
        assert_eq!(s.channel_health().unwrap().len(), 2);

        s.record_channel_success("nilesoft", "2026-09-13").unwrap();
        let health = s.channel_health().unwrap();
        assert!(!health.contains_key("nilesoft"));
        assert!(health.contains_key("winaero"));
        assert_eq!(
            s.channel_sync_dates()
                .unwrap()
                .get("nilesoft")
                .map(String::as_str),
            Some("2026-09-13")
        );

        let h = s.record_channel_failure("nilesoft", "2026-09-20").unwrap();
        assert_eq!((h.failures, h.first_failure.as_str()), (1, "2026-09-20"));
    }
}
