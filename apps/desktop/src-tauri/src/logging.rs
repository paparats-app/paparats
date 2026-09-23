//! `tracing` to a local rolling file (`<app log dir>/paparats.<date>.log`, 7 days kept). Nothing
//! leaves the machine. Never log tokens, passwords, e-mail addresses, names or user-written text.

use std::path::Path;

use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};

/// Keeps the background writer alive for the lifetime of the app (managed by Tauri).
pub struct LogGuard(#[allow(dead_code)] WorkerGuard);

/// Installs the global subscriber writing to `dir`.
pub fn init(dir: &Path) -> Result<LogGuard, String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("paparats")
        .filename_suffix("log")
        .max_log_files(7)
        .build(dir)
        .map_err(|e| e.to_string())?;
    let (writer, guard) = tracing_appender::non_blocking(appender);
    tracing_subscriber::fmt()
        .with_writer(writer)
        .with_ansi(false)
        .with_max_level(tracing::Level::INFO)
        .try_init()
        .map_err(|e| e.to_string())?;
    Ok(LogGuard(guard))
}
