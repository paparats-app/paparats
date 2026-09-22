//! Ideas board: one JSON row per idea, ordered like the board (new proposals first).

use paparats_core::Idea;
use rusqlite::{Connection, OptionalExtension, Transaction, params};

use crate::{Result, Storage, StorageError, from_json, to_json};

fn ideas(conn: &Connection) -> Result<Vec<Idea>> {
    let mut stmt = conn.prepare("SELECT data FROM ideas ORDER BY position, id")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    rows.map(|data| from_json(&data?)).collect()
}

fn idea(conn: &Connection, id: &str) -> Result<Option<Idea>> {
    let data: Option<String> = conn
        .query_row("SELECT data FROM ideas WHERE id = ?1", [id], |r| r.get(0))
        .optional()?;
    data.map(|d| from_json(&d)).transpose()
}

pub(crate) fn insert_idea(tx: &Transaction<'_>, position: i64, idea: &Idea) -> Result<()> {
    tx.execute(
        "INSERT INTO ideas (id, position, data) VALUES (?1, ?2, ?3)",
        params![idea.id, position, to_json(idea)?],
    )?;
    Ok(())
}

impl Storage {
    /// Every idea in board order.
    pub fn ideas(&self) -> Result<Vec<Idea>> {
        self.read(ideas)
    }

    pub fn idea(&self, id: &str) -> Result<Option<Idea>> {
        self.read(|c| idea(c, id))
    }

    /// Inserts a new idea at the top of the board. `make` receives the ids already taken so it
    /// can pick a fresh one inside the same transaction.
    pub fn insert_idea_first<E>(
        &self,
        make: impl FnOnce(&dyn Fn(&str) -> bool) -> std::result::Result<Idea, E>,
    ) -> std::result::Result<Idea, E>
    where
        E: From<StorageError>,
    {
        self.with_tx(|tx| {
            let exists = |id: &str| {
                tx.query_row("SELECT 1 FROM ideas WHERE id = ?1", [id], |_| Ok(()))
                    .optional()
                    .map(|found| found.is_some())
                    // A failing probe must not hand out a possibly taken id; the insert below
                    // would then fail on the primary key anyway.
                    .unwrap_or(true)
            };
            let new = make(&exists)?;
            let first: i64 = tx
                .query_row(
                    "SELECT COALESCE(MIN(position), 1) - 1 FROM ideas",
                    [],
                    |r| r.get(0),
                )
                .map_err(StorageError::from)?;
            insert_idea(tx, first, &new)?;
            Ok(new)
        })
    }

    /// Atomic read-modify-write of one idea (`NotFound` when missing); `f` may reject the change.
    pub fn update_idea<E>(
        &self,
        id: &str,
        f: impl FnOnce(&mut Idea) -> std::result::Result<(), E>,
    ) -> std::result::Result<Idea, E>
    where
        E: From<StorageError>,
    {
        self.with_tx(|tx| {
            let mut current =
                idea(tx, id)?.ok_or_else(|| StorageError::NotFound(format!("idea {id}")))?;
            f(&mut current)?;
            tx.execute(
                "UPDATE ideas SET data = ?2 WHERE id = ?1",
                params![id, to_json(&current)?],
            )
            .map_err(StorageError::from)?;
            Ok(current)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use paparats_core::{IdeaKind, IdeaStatus, Text};

    fn seeded() -> Storage {
        let s = Storage::open_in_memory().unwrap();
        s.seed_from_fixtures().unwrap();
        s
    }

    fn draft(id: &str) -> Idea {
        let mut i = seeded().ideas().unwrap().remove(0);
        i.id = id.into();
        i.kind = IdeaKind::New;
        i.title = Text::Plain("A new idea".into());
        i.mine = true;
        i
    }

    #[test]
    fn board_order_and_new_ideas_on_top() {
        let s = seeded();
        let all = s.ideas().unwrap();
        assert_eq!(all.len(), 9);
        assert_eq!(all[0].id, "clip");
        assert_eq!(all[8].id, "slounik");

        let created = s
            .insert_idea_first(|exists| {
                assert!(exists("clip"));
                assert!(!exists("u1"));
                Ok::<_, StorageError>(draft("u1"))
            })
            .unwrap();
        assert_eq!(created.id, "u1");
        s.insert_idea_first(|_| Ok::<_, StorageError>(draft("u2")))
            .unwrap();
        let ids: Vec<String> = s.ideas().unwrap().into_iter().map(|i| i.id).collect();
        assert_eq!(&ids[..3], ["u2", "u1", "clip"]);
    }

    #[test]
    fn update_idea_round_trip_and_errors() {
        let s = seeded();
        let i = s
            .update_idea("clip", |i| {
                i.status = IdeaStatus::Work;
                Ok::<_, StorageError>(())
            })
            .unwrap();
        assert_eq!(i.status, IdeaStatus::Work);
        assert_eq!(s.idea("clip").unwrap().unwrap().status, IdeaStatus::Work);
        assert!(matches!(
            s.update_idea("nope", |_| Ok::<_, StorageError>(())),
            Err(StorageError::NotFound(_))
        ));
        assert!(s.idea("nope").unwrap().is_none());
    }
}
