//! Paparats desktop client — Tauri entry point: plugins, commands, events, window setup.

mod commands;
mod error;
mod events;
mod logging;
mod services;

#[cfg(test)]
mod ipc_tests;

pub use error::{AppError, AppResult};
pub use events::{DownloadProgressEvent, DownloadStateEvent};

use std::sync::Arc;

use paparats_core as core;
use tauri::Manager;
use tauri_specta::{Builder, collect_commands, collect_events};

/// Where `export_bindings` writes the generated TypeScript, relative to this crate.
pub const BINDINGS_PATH: &str = "../src/bindings.ts";

/// File name of the local database inside the app data directory.
pub const DATABASE_FILE: &str = "paparats.db";

/// The single registry of commands, events and domain types shared by the app and the bindings
/// exporter. Domain types are registered explicitly so the UI can import every one of them from
/// `bindings.ts`, even before a command returns it.
pub fn specta_builder<R: tauri::Runtime>() -> Builder<R> {
    Builder::<R>::new()
        .commands(collect_commands![
            commands::app_info,
            // catalog
            commands::catalog_get_catalog,
            commands::catalog_get_platform,
            // install (library)
            commands::install_get_library,
            commands::install_set_favorite,
            commands::install_uninstall,
            commands::install_open,
            commands::install_open_folder,
            // downloads
            commands::downloads_snapshot,
            commands::downloads_enqueue,
            commands::downloads_pause,
            commands::downloads_resume,
            commands::downloads_cancel,
            commands::downloads_pause_all,
            commands::downloads_resume_all,
            commands::downloads_cancel_all,
            commands::downloads_set_concurrency,
            commands::downloads_set_online,
            // channels
            commands::channels_get_channels,
            commands::channels_get_subscriptions,
            commands::channels_lookup,
            commands::channels_subscribe,
            commands::channels_unsubscribe,
            commands::channels_set_paused,
            commands::channels_acknowledge_stale,
            commands::channels_sync,
            commands::channels_report,
            // ideas
            commands::ideas_get,
            commands::ideas_vote,
            commands::ideas_propose,
            commands::ideas_comment,
            commands::ideas_take,
            commands::ideas_release,
            commands::ideas_dismiss_release_note,
            // account
            commands::account_get,
            commands::account_update_profile,
            commands::account_remove_device,
            commands::account_set_two_factor,
            commands::account_purchase,
            commands::account_cancel_plan,
            commands::account_claim_idea_bonus,
            commands::account_sign_in,
            commands::account_sign_out,
            // system
            commands::system_today,
            commands::system_check_for_app_update,
        ])
        .events(collect_events![DownloadProgressEvent, DownloadStateEvent])
        .typ::<core::Catalog>()
        .typ::<core::ChannelInfo>()
        .typ::<core::ChannelSubscription>()
        .typ::<core::ChannelLookup>()
        .typ::<core::SyncOutcome>()
        .typ::<core::ReportTarget>()
        .typ::<core::ReportReceipt>()
        .typ::<core::Idea>()
        .typ::<core::IdeaDraft>()
        .typ::<core::IdeaActor>()
        .typ::<core::Account>()
        .typ::<core::ProfilePatch>()
        .typ::<core::PlatformInfo>()
        .typ::<core::Library>()
        .typ::<core::DownloadRequest>()
        .typ::<core::DownloadSnapshot>()
        .typ::<core::DownloadProgress>()
        .typ::<core::DownloadStateChange>()
        .typ::<core::Settings>()
        .typ::<core::SelfUpdateCheck>()
        .typ::<core::Locale>()
}

/// Writes `apps/desktop/src/bindings.ts`.
pub fn export_bindings() -> Result<(), String> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(BINDINGS_PATH);
    specta_builder::<tauri::Wry>()
        .export(
            specta_typescript::Typescript::default().header("// Regenerate with `pnpm specta`.\n"),
            path,
        )
        .map_err(|e| e.to_string())
}

/// Logging, database, catalog and download engine. Runs once in `setup`, after the event
/// registry is mounted (the engine emits typed events).
fn init_state(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    match app
        .path()
        .app_log_dir()
        .map_err(|e| e.to_string())
        .and_then(|dir| logging::init(&dir))
    {
        Ok(guard) => {
            app.manage(guard);
        }
        Err(e) => eprintln!("Paparats: file logging is disabled: {e}"),
    }
    let db_path = app.path().app_data_dir()?.join(DATABASE_FILE);
    let runtime = tauri::async_runtime::handle().inner().clone();
    let ui = Arc::new(events::TauriEvents::new(app.handle().clone()));
    let state = services::AppState::open(&db_path, ui, runtime, services::system_clock())?;
    app.manage(state);
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "Paparats started");
    Ok(())
}

pub fn run() {
    let builder = specta_builder::<tauri::Wry>();

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            init_state(app)
        })
        .run(tauri::generate_context!());

    if let Err(err) = result {
        tracing::error!(error = %err, "Paparats failed to start");
        eprintln!("Paparats failed to start: {err}");
        std::process::exit(1);
    }
}
