//! The single error type that crosses the Tauri boundary.

use serde::Serialize;

/// Error returned by every Tauri command. Serialised as `{ kind, message }` so the UI can branch
/// on `kind` without parsing text.
#[derive(Debug, thiserror::Error, Serialize, specta::Type)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("internal error: {0}")]
    Internal(String),
}

pub type AppResult<T> = Result<T, AppError>;
