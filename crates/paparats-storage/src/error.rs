/// Errors of the storage crate.
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("stored data is malformed: {0}")]
    Json(#[from] serde_json::Error),
    #[error("embedded fixture {name} is malformed: {source}")]
    Fixture {
        name: &'static str,
        #[source]
        source: serde_json::Error,
    },
    #[error("database schema {found} is newer than this client supports ({supported})")]
    SchemaTooNew { found: u32, supported: u32 },
    #[error("{0} not found")]
    NotFound(String),
    #[error("the database lock is poisoned")]
    Poisoned,
    #[error("could not create the database directory: {0}")]
    Io(#[from] std::io::Error),
}
