//! Local persistence: one SQLite database (`paparats.db` in the app data directory) holding the
//! inventory, favorites, library collections, activity, channel subscriptions, ideas, the account
//! snapshot and key-value meta. Settings stay in the UI's settings store.
//!
//! [`Storage`] is `Send + Sync`: one connection behind a mutex, never held across an `.await`
//! (every method is synchronous and short). Read-modify-write helpers run inside a transaction.

mod account;
mod channels;
mod error;
mod ideas;
mod library;
mod manifest_cache;
mod schema;
mod seed;

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::{Connection, OptionalExtension, Transaction, params};

pub use error::StorageError;
pub use manifest_cache::{CachedManifest, ChannelHealth};
pub use schema::SCHEMA_VERSION;
pub use seed::fixtures;

/// Result of every storage call.
pub type Result<T, E = StorageError> = std::result::Result<T, E>;

/// The local database.
pub struct Storage {
    conn: Mutex<Connection>,
}

impl std::fmt::Debug for Storage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Storage").finish_non_exhaustive()
    }
}

impl Storage {
    /// Opens (or creates) the database at `path`, creating missing parent directories, and
    /// migrates it to [`SCHEMA_VERSION`].
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
            std::fs::create_dir_all(dir)?;
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        Self::init(conn)
    }

    /// A private in-memory database (tests, previews).
    pub fn open_in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(mut conn: Connection) -> Result<Self> {
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        schema::migrate(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|_| StorageError::Poisoned)
    }

    /// Runs `f` inside one transaction; any error rolls it back.
    pub(crate) fn with_tx<T, E>(
        &self,
        f: impl FnOnce(&Transaction<'_>) -> std::result::Result<T, E>,
    ) -> std::result::Result<T, E>
    where
        E: From<StorageError>,
    {
        let mut conn = self.lock()?;
        let tx = conn.transaction().map_err(StorageError::from)?;
        let value = f(&tx)?;
        tx.commit().map_err(StorageError::from)?;
        Ok(value)
    }

    /// Runs a read-only `f` on the connection.
    pub(crate) fn read<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let conn = self.lock()?;
        f(&conn)
    }

    /// The schema version stored in the database (`PRAGMA user_version`).
    pub fn schema_version(&self) -> Result<u32> {
        self.read(schema::user_version)
    }

    /// A value from the key-value meta table.
    pub fn meta(&self, key: &str) -> Result<Option<String>> {
        self.read(|c| {
            Ok(
                c.query_row("SELECT value FROM meta WHERE key = ?1", [key], |r| r.get(0))
                    .optional()?,
            )
        })
    }

    /// Writes a value into the key-value meta table.
    pub fn set_meta(&self, key: &str, value: &str) -> Result<()> {
        self.with_tx(|tx| set_meta(tx, key, value))
    }
}

pub(crate) fn set_meta(tx: &Transaction<'_>, key: &str, value: &str) -> Result<()> {
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

/// Serialises a value as the JSON stored in a `data` column.
pub(crate) fn to_json<T: serde::Serialize>(value: &T) -> Result<String> {
    Ok(serde_json::to_string(value)?)
}

pub(crate) fn from_json<T: serde::de::DeserializeOwned>(text: &str) -> Result<T> {
    Ok(serde_json::from_str(text)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meta_round_trip() {
        let s = Storage::open_in_memory().unwrap();
        assert_eq!(s.meta("k").unwrap(), None);
        s.set_meta("k", "v1").unwrap();
        s.set_meta("k", "v2").unwrap();
        assert_eq!(s.meta("k").unwrap().as_deref(), Some("v2"));
    }

    #[test]
    fn migrates_and_persists_across_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("paparats.db");
        {
            let s = Storage::open(&path).unwrap();
            assert_eq!(s.schema_version().unwrap(), SCHEMA_VERSION);
            s.set_meta("hello", "world").unwrap();
        }
        let s = Storage::open(&path).unwrap();
        assert_eq!(s.schema_version().unwrap(), SCHEMA_VERSION);
        assert_eq!(s.meta("hello").unwrap().as_deref(), Some("world"));
    }

    #[test]
    fn storage_is_shareable_across_threads() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<Storage>();
    }
}
