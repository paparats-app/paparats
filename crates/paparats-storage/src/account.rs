//! The account snapshot (one JSON row) and the activity log (its own table, newest first).

use paparats_core::{Account, Activity, ActivityKind};
use rusqlite::{Connection, OptionalExtension, params};

use crate::{Result, Storage, StorageError, from_json, to_json};

fn activity(conn: &Connection) -> Result<Vec<Activity>> {
    let mut stmt =
        conn.prepare("SELECT kind, app_id, version, date FROM activity ORDER BY id DESC")?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            Activity {
                kind: ActivityKind::Installed,
                app_id: r.get(1)?,
                version: r.get(2)?,
                date: r.get(3)?,
            },
        ))
    })?;
    rows.map(|row| {
        let (kind, mut item) = row?;
        item.kind = match kind.as_str() {
            "updated" => ActivityKind::Updated,
            "installed" => ActivityKind::Installed,
            other => {
                return Err(StorageError::Json(serde::de::Error::custom(format!(
                    "unknown activity kind {other:?}"
                ))));
            }
        };
        Ok(item)
    })
    .collect()
}

/// The stored account with the activity log filled in.
pub(crate) fn load(conn: &Connection) -> Result<Account> {
    let data: Option<String> = conn
        .query_row("SELECT data FROM account WHERE id = 1", [], |r| r.get(0))
        .optional()?;
    let data = data.ok_or_else(|| StorageError::NotFound("account".into()))?;
    let mut account: Account = from_json(&data)?;
    account.activity = activity(conn)?;
    Ok(account)
}

/// Stores the account row. The activity log is append-only and lives in its own table, so
/// `account.activity` is not written here.
pub(crate) fn store(conn: &Connection, account: &Account) -> Result<()> {
    let row = Account {
        activity: Vec::new(),
        ..account.clone()
    };
    conn.execute(
        "INSERT INTO account (id, data) VALUES (1, ?1)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        params![to_json(&row)?],
    )?;
    Ok(())
}

impl Storage {
    /// The account snapshot (`NotFound` before the first seed).
    pub fn account(&self) -> Result<Account> {
        self.read(load)
    }

    /// Replaces the account snapshot (activity excluded, see [`Storage::record_install`]).
    pub fn save_account(&self, account: &Account) -> Result<()> {
        self.with_tx(|tx| store(tx, account))
    }

    /// Atomic read-modify-write of the account: `f` may reject the change with its own error.
    pub fn update_account<E>(
        &self,
        f: impl FnOnce(&mut Account) -> std::result::Result<(), E>,
    ) -> std::result::Result<Account, E>
    where
        E: From<StorageError>,
    {
        self.with_tx(|tx| {
            let mut account = load(tx)?;
            f(&mut account)?;
            store(tx, &account)?;
            Ok(account)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use paparats_core::PlanId;

    #[test]
    fn account_is_missing_before_the_seed() {
        let s = Storage::open_in_memory().unwrap();
        assert!(matches!(s.account(), Err(StorageError::NotFound(_))));
    }

    #[test]
    fn account_round_trip_keeps_the_fixture() {
        let s = Storage::open_in_memory().unwrap();
        s.seed_from_fixtures().unwrap();
        let a = s.account().unwrap();
        assert_eq!(a.profile.name, "Serj Kaje");
        assert_eq!(a.devices.len(), 2);
        assert_eq!(a.activity.len(), 5);
        assert_eq!(
            a.activity[0].app_id, "obsidian",
            "fixture order, newest first"
        );
        assert_eq!(a.activity[4].app_id, "vlc");
        assert_eq!(a.subscription.plan, PlanId::Free);
        assert_eq!(a.usage.updates_installed, 248);
    }

    #[test]
    fn update_account_is_atomic() {
        let s = Storage::open_in_memory().unwrap();
        s.seed_from_fixtures().unwrap();
        let a = s
            .update_account(|a| {
                a.two_factor = false;
                Ok::<_, StorageError>(())
            })
            .unwrap();
        assert!(!a.two_factor);
        assert_eq!(a.activity.len(), 5, "activity is kept");

        let err = s.update_account(|a| {
            a.two_factor = true;
            Err(StorageError::NotFound("rejected".into()))
        });
        assert!(err.is_err());
        assert!(!s.account().unwrap().two_factor, "rolled back");

        let mut changed = s.account().unwrap();
        changed.signed_in = false;
        s.save_account(&changed).unwrap();
        assert!(!s.account().unwrap().signed_in);
    }
}
