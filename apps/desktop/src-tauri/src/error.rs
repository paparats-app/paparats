//! The single error type that crosses the Tauri boundary.

use paparats_account::AccountError;
use paparats_catalog::CatalogError;
use paparats_core::dates::DateError;
use paparats_download::DownloadError;
use paparats_install::InstallError;
use paparats_inventory::InventoryError;
use paparats_storage::StorageError;
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

impl AppError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::Invalid(message.into())
    }

    pub fn not_found(what: impl Into<String>) -> Self {
        Self::NotFound(what.into())
    }

    /// Logs an unexpected failure (never personal data: messages come from our own errors).
    fn internal(e: impl std::fmt::Display) -> Self {
        let message = e.to_string();
        tracing::error!(error = %message, "internal error");
        Self::Internal(message)
    }
}

impl From<StorageError> for AppError {
    fn from(e: StorageError) -> Self {
        match e {
            StorageError::NotFound(what) => Self::NotFound(what),
            other => Self::internal(other),
        }
    }
}

impl From<AccountError> for AppError {
    fn from(e: AccountError) -> Self {
        match e {
            AccountError::Invalid(m) => Self::Invalid(m),
            AccountError::NotFound(what) => Self::NotFound(what),
            AccountError::Storage(e) => e.into(),
            AccountError::Date(e) => Self::internal(e),
        }
    }
}

impl From<InventoryError> for AppError {
    fn from(e: InventoryError) -> Self {
        match e {
            InventoryError::Storage(e) => e.into(),
        }
    }
}

impl From<DownloadError> for AppError {
    fn from(e: DownloadError) -> Self {
        match e {
            DownloadError::InvalidConcurrency(_) => Self::Invalid(e.to_string()),
            other => Self::internal(other),
        }
    }
}

impl From<CatalogError> for AppError {
    fn from(e: CatalogError) -> Self {
        Self::internal(e)
    }
}

impl From<InstallError> for AppError {
    fn from(e: InstallError) -> Self {
        Self::internal(e)
    }
}

impl From<DateError> for AppError {
    fn from(e: DateError) -> Self {
        Self::internal(e)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_shape() {
        let json = serde_json::to_value(AppError::invalid("title too short")).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"kind": "invalid", "message": "title too short"})
        );
    }

    #[test]
    fn crate_errors_map_to_kinds() {
        assert!(matches!(
            AppError::from(StorageError::NotFound("idea x".into())),
            AppError::NotFound(_)
        ));
        assert!(matches!(
            AppError::from(StorageError::Poisoned),
            AppError::Internal(_)
        ));
        assert!(matches!(
            AppError::from(AccountError::Invalid("x".into())),
            AppError::Invalid(_)
        ));
        assert!(matches!(
            AppError::from(DownloadError::InvalidConcurrency(0)),
            AppError::Invalid(_)
        ));
        assert!(matches!(
            AppError::from(DownloadError::Http(500)),
            AppError::Internal(_)
        ));
    }
}
