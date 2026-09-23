//! Library: the inventory of this PC (installed apps), favorites, collections, and the activity
//! log written when a download finishes.

use paparats_core::{ActivityKind, InstalledApp, IsoDate, Library, LibraryCollection};
use rusqlite::{Connection, OptionalExtension, Transaction, params};

use crate::{Result, Storage, StorageError, account, from_json, to_json};

pub(crate) fn activity_kind_str(kind: ActivityKind) -> &'static str {
    match kind {
        ActivityKind::Installed => "installed",
        ActivityKind::Updated => "updated",
    }
}

pub(crate) fn installed(conn: &Connection) -> Result<Vec<InstalledApp>> {
    let mut stmt =
        conn.prepare("SELECT app_id, version, last_used FROM installed ORDER BY position, app_id")?;
    let rows = stmt.query_map([], |r| {
        Ok(InstalledApp {
            app_id: r.get(0)?,
            version: r.get(1)?,
            last_used: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn favorites(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT app_id FROM favorites ORDER BY position, app_id")?;
    let rows = stmt.query_map([], |r| r.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn collections(conn: &Connection) -> Result<Vec<LibraryCollection>> {
    let mut stmt = conn.prepare("SELECT data FROM library_collections ORDER BY position, id")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    rows.map(|data| from_json(&data?))
        .collect::<Result<Vec<LibraryCollection>>>()
}

fn library(conn: &Connection) -> Result<Library> {
    Ok(Library {
        installed: installed(conn)?,
        favorites: favorites(conn)?,
        collections: collections(conn)?,
    })
}

/// Inserts or replaces an installed app, keeping its place in the list when it was already there.
pub(crate) fn upsert_installed(tx: &Transaction<'_>, app: &InstalledApp) -> Result<()> {
    let updated = tx.execute(
        "UPDATE installed SET version = ?2, last_used = ?3 WHERE app_id = ?1",
        params![app.app_id, app.version, app.last_used],
    )?;
    if updated == 0 {
        tx.execute(
            "INSERT INTO installed (app_id, version, last_used, position)
             VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(position), -1) + 1 FROM installed))",
            params![app.app_id, app.version, app.last_used],
        )?;
    }
    Ok(())
}

pub(crate) fn insert_favorite(tx: &Transaction<'_>, app_id: &str) -> Result<()> {
    tx.execute(
        "INSERT OR IGNORE INTO favorites (app_id, position)
         VALUES (?1, (SELECT COALESCE(MAX(position), -1) + 1 FROM favorites))",
        [app_id],
    )?;
    Ok(())
}

pub(crate) fn insert_collection(
    tx: &Transaction<'_>,
    position: i64,
    collection: &LibraryCollection,
) -> Result<()> {
    tx.execute(
        "INSERT OR REPLACE INTO library_collections (id, position, data) VALUES (?1, ?2, ?3)",
        params![collection.id, position, to_json(collection)?],
    )?;
    Ok(())
}

pub(crate) fn insert_activity(
    tx: &Transaction<'_>,
    kind: ActivityKind,
    app_id: &str,
    version: &str,
    date: &str,
) -> Result<()> {
    tx.execute(
        "INSERT INTO activity (kind, app_id, version, date) VALUES (?1, ?2, ?3, ?4)",
        params![activity_kind_str(kind), app_id, version, date],
    )?;
    Ok(())
}

impl Storage {
    /// Installed apps, favorites and collections.
    pub fn library(&self) -> Result<Library> {
        self.read(library)
    }

    /// Installed apps in list order (first install first).
    pub fn installed_apps(&self) -> Result<Vec<InstalledApp>> {
        self.read(installed)
    }

    pub fn installed_app(&self, app_id: &str) -> Result<Option<InstalledApp>> {
        self.read(|c| {
            Ok(c.query_row(
                "SELECT app_id, version, last_used FROM installed WHERE app_id = ?1",
                [app_id],
                |r| {
                    Ok(InstalledApp {
                        app_id: r.get(0)?,
                        version: r.get(1)?,
                        last_used: r.get(2)?,
                    })
                },
            )
            .optional()?)
        })
    }

    /// Adds or removes a favorite (idempotent) and returns the library.
    pub fn set_favorite(&self, app_id: &str, favorite: bool) -> Result<Library> {
        self.with_tx(|tx| {
            if favorite {
                insert_favorite(tx, app_id)?;
            } else {
                tx.execute("DELETE FROM favorites WHERE app_id = ?1", [app_id])?;
            }
            library(tx)
        })
    }

    /// Removes an app from the inventory. Favorites survive (the prototype only hides the app).
    /// Returns whether it was installed.
    pub fn remove_installed(&self, app_id: &str) -> Result<bool> {
        self.with_tx(|tx| Ok(tx.execute("DELETE FROM installed WHERE app_id = ?1", [app_id])? > 0))
    }

    /// Records a finished download in one transaction: the inventory entry (in place for an
    /// update), an activity line dated `date`, and — for updates — `usage.updatesInstalled + 1`.
    pub fn record_install(
        &self,
        app: &InstalledApp,
        kind: ActivityKind,
        date: &IsoDate,
    ) -> Result<()> {
        self.with_tx(|tx| {
            upsert_installed(tx, app)?;
            insert_activity(tx, kind, &app.app_id, &app.version, date)?;
            if kind == ActivityKind::Updated {
                let mut acc = account::load(tx)?;
                acc.usage.updates_installed = acc.usage.updates_installed.saturating_add(1);
                account::store(tx, &acc)?;
            }
            Ok::<_, StorageError>(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded() -> Storage {
        let s = Storage::open_in_memory().unwrap();
        assert!(s.seed_from_fixtures().unwrap());
        s
    }

    fn app(id: &str, version: &str) -> InstalledApp {
        InstalledApp {
            app_id: id.into(),
            version: version.into(),
            last_used: "2026-09-15".into(),
        }
    }

    #[test]
    fn library_keeps_fixture_order() {
        let lib = seeded().library().unwrap();
        assert_eq!(lib.installed.len(), 14);
        assert_eq!(lib.installed[0].app_id, "vscode");
        assert_eq!(lib.installed[13].app_id, "czkawka");
        assert_eq!(lib.favorites, ["obsidian", "everything", "vlc"]);
        assert_eq!(lib.collections.len(), 4);
        assert_eq!(lib.collections[0].apps, None);
        assert_eq!(lib.collections[1].id, "work");
    }

    #[test]
    fn favorites_are_idempotent_and_ordered() {
        let s = seeded();
        let lib = s.set_favorite("krita", true).unwrap();
        assert_eq!(lib.favorites, ["obsidian", "everything", "vlc", "krita"]);
        let lib = s.set_favorite("krita", true).unwrap();
        assert_eq!(lib.favorites.len(), 4);
        let lib = s.set_favorite("everything", false).unwrap();
        assert_eq!(lib.favorites, ["obsidian", "vlc", "krita"]);
        let lib = s.set_favorite("nope", false).unwrap();
        assert_eq!(lib.favorites.len(), 3);
    }

    #[test]
    fn uninstall_keeps_favorites() {
        let s = seeded();
        assert!(s.remove_installed("obsidian").unwrap());
        assert!(!s.remove_installed("obsidian").unwrap());
        let lib = s.library().unwrap();
        assert_eq!(lib.installed.len(), 13);
        assert!(lib.favorites.contains(&"obsidian".to_owned()));
        assert_eq!(s.installed_app("obsidian").unwrap(), None);
    }

    #[test]
    fn record_install_updates_in_place_and_counts_updates() {
        let s = seeded();
        let before = s.account().unwrap();
        let date = "2026-09-16".to_owned();

        s.record_install(&app("obsidian", "1.8.10"), ActivityKind::Updated, &date)
            .unwrap();
        let installed = s.installed_apps().unwrap();
        assert_eq!(installed[2], app("obsidian", "1.8.10"), "same position");

        s.record_install(&app("obs", "31.1.2"), ActivityKind::Installed, &date)
            .unwrap();
        let installed = s.installed_apps().unwrap();
        assert_eq!(installed.len(), 15);
        assert_eq!(installed[14].app_id, "obs", "new installs go last");

        let after = s.account().unwrap();
        assert_eq!(
            after.usage.updates_installed,
            before.usage.updates_installed + 1,
            "only updates count"
        );
        assert_eq!(after.activity.len(), before.activity.len() + 2);
        assert_eq!(after.activity[0].app_id, "obs", "newest first");
        assert_eq!(after.activity[0].kind, ActivityKind::Installed);
        assert_eq!(after.activity[1].app_id, "obsidian");
        assert_eq!(after.activity[1].kind, ActivityKind::Updated);
        assert_eq!(after.activity[1].date, "2026-09-16");
        assert_eq!(after.activity[2], before.activity[0]);
    }
}
