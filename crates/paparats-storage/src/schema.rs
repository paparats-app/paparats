//! Schema migrations, tracked with `PRAGMA user_version`. Append new migrations; never edit one
//! that has shipped.

use rusqlite::Connection;

use crate::{Result, StorageError};

/// Migration `n` (1-based) brings the schema from version `n - 1` to `n`.
const MIGRATIONS: &[&str] = &[
    // 1 — initial schema.
    "
    CREATE TABLE installed (
        app_id    TEXT PRIMARY KEY NOT NULL,
        version   TEXT NOT NULL,
        last_used TEXT NOT NULL,
        position  INTEGER NOT NULL
    );
    CREATE TABLE favorites (
        app_id   TEXT PRIMARY KEY NOT NULL,
        position INTEGER NOT NULL
    );
    CREATE TABLE library_collections (
        id       TEXT PRIMARY KEY NOT NULL,
        position INTEGER NOT NULL,
        data     TEXT NOT NULL
    );
    CREATE TABLE activity (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        kind    TEXT NOT NULL,
        app_id  TEXT NOT NULL,
        version TEXT NOT NULL,
        date    TEXT NOT NULL
    );
    CREATE TABLE channel_subscriptions (
        channel_id         TEXT PRIMARY KEY NOT NULL,
        position           INTEGER NOT NULL,
        paused             INTEGER NOT NULL DEFAULT 0,
        stale_acknowledged INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE channel_sync (
        channel_id TEXT PRIMARY KEY NOT NULL,
        synced     TEXT NOT NULL
    );
    CREATE TABLE ideas (
        id       TEXT PRIMARY KEY NOT NULL,
        position INTEGER NOT NULL,
        data     TEXT NOT NULL
    );
    CREATE TABLE account (
        id   INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        data TEXT NOT NULL
    );
    CREATE TABLE meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
    );
    ",
];

/// The schema version this build creates and understands.
pub const SCHEMA_VERSION: u32 = MIGRATIONS.len() as u32;

pub(crate) fn user_version(conn: &Connection) -> Result<u32> {
    Ok(conn.pragma_query_value(None, "user_version", |r| r.get(0))?)
}

/// Applies every pending migration, each in its own transaction together with its version bump.
pub(crate) fn migrate(conn: &mut Connection) -> Result<()> {
    let found = user_version(conn)?;
    if found > SCHEMA_VERSION {
        return Err(StorageError::SchemaTooNew {
            found,
            supported: SCHEMA_VERSION,
        });
    }
    for (version, sql) in (1_u32..).zip(MIGRATIONS).skip(found as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        migrate(&mut conn).unwrap();
        assert_eq!(user_version(&conn).unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn refuses_a_newer_schema() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "user_version", SCHEMA_VERSION + 1)
            .unwrap();
        assert!(matches!(
            migrate(&mut conn),
            Err(StorageError::SchemaTooNew { .. })
        ));
    }
}
