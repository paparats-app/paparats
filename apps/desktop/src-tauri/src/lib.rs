//! Paparats desktop client — Tauri entry point: plugins, commands, events, window setup.

#[cfg(test)]
mod app_commands;
mod autostart;
mod commands;
mod deep_link;
mod error;
mod events;
mod flags;
mod logging;
mod services;
mod shell;
mod tray;
mod window;

#[cfg(test)]
mod ipc_tests;

pub use error::{AppError, AppResult};
pub use events::{
    CatalogChangedEvent, DeepLinkEvent, DownloadProgressEvent, DownloadStateEvent, TrayActionEvent,
};

use std::sync::Arc;
use std::time::Duration;

use paparats_core as core;
use paparats_core::UpdateSchedule;
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use tauri_specta::{Builder, Event, collect_commands, collect_events};

use crate::flags::{CatalogEnv, RealFlags};
use crate::services::{Browser, RealPaths, Strategies};
use crate::shell::{Shell, ShellStart, StoredSettings};
use crate::tray::{Tray, TrayLabels};
use crate::window::{MAIN_WINDOW, MainWindow, TauriShellHost};

/// Where `export_bindings` writes the generated TypeScript, relative to this crate.
pub const BINDINGS_PATH: &str = "../src/bindings.ts";

/// File name of the local database inside the app data directory.
pub const DATABASE_FILE: &str = "library.db";

/// The demo world's database (`--demo`), the one 0.0.1 seeded from the mock data set.
pub const DEMO_DATABASE_FILE: &str = "paparats.db";

/// Folder of real downloads (partial and verified packages) in the app's local data directory.
pub const DOWNLOADS_DIR: &str = "downloads";

/// File name of the UI's settings store in the app data directory (`services/tauri/settings.ts`).
pub const SETTINGS_FILE: &str = "settings.json";

/// How long the window may stay hidden waiting for the UI's first frame before it is shown anyway.
const FIRST_FRAME_TIMEOUT: Duration = Duration::from_secs(5);

/// The single registry of commands, events and domain types shared by the app and the bindings
/// exporter. Domain types are registered explicitly so the UI can import every one of them from
/// `bindings.ts`, even before a command returns it. Every command is also listed in
/// `app_commands.rs` (its permission) — a test keeps the two in sync.
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
            // native shell
            commands::shell_set_locale,
            commands::shell_set_minimize_to_tray,
            commands::shell_window_ready,
            commands::shell_take_deep_links,
        ])
        .events(collect_events![
            DownloadProgressEvent,
            DownloadStateEvent,
            DeepLinkEvent,
            TrayActionEvent,
            CatalogChangedEvent
        ])
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

/// The system browser (tauri-plugin-opener): the account API's sign-in page.
struct SystemBrowser(AppHandle);

impl Browser for SystemBrowser {
    fn open(&self, url: &str) -> Result<(), String> {
        self.0
            .opener()
            .open_url(url, None::<&str>)
            .map_err(|e| e.to_string())
    }
}

/// Logging, database, the strategies `PAPARATS_REAL` asks for (catalog, inventory, installer,
/// sign-in) and the download engine. Runs once in `setup`, after the event registry is mounted
/// (the engine emits typed events). Returns the real strategies actually running.
fn init_state(app: &mut tauri::App) -> Result<RealFlags, Box<dyn std::error::Error>> {
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
    // Read here and nowhere else, once logging runs (unknown names are logged).
    let args: Vec<String> = std::env::args().collect();
    let flags = RealFlags::from_env(&args);
    // The demo world keeps its own database (0.0.1 wrote the demo data to it), so switching
    // between the two never mixes made-up apps into the real library.
    let db_file = if flags.is_simulated() {
        DEMO_DATABASE_FILE
    } else {
        DATABASE_FILE
    };
    let db_path = app.path().app_data_dir()?.join(db_file);
    let paths = RealPaths {
        downloads: app.path().app_local_data_dir()?.join(DOWNLOADS_DIR),
    };
    let runtime = tauri::async_runtime::handle().inner().clone();
    let ui = Arc::new(events::TauriEvents::new(app.handle().clone()));
    let browser = Arc::new(SystemBrowser(app.handle().clone()));
    let state =
        services::AppState::open(&db_path, ui, runtime, services::system_clock(), |storage| {
            Strategies::from_flags(flags, &CatalogEnv::from_env(), storage, &paths, browser)
        })?;
    let running = state.flags();
    tauri::async_runtime::spawn(state.startup());
    if running.catalog {
        refresh_on_schedule(
            app.handle().clone(),
            app.path().app_data_dir()?.join(SETTINGS_FILE),
        );
    }
    app.manage(state);
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "Paparats started");
    Ok(running)
}

/// How long the catalog waits between background refreshes ("Check for updates" in Settings).
fn refresh_period(schedule: UpdateSchedule) -> Duration {
    const HOUR: u64 = 60 * 60;
    Duration::from_secs(match schedule {
        UpdateSchedule::Hourly => HOUR,
        UpdateSchedule::Daily => 24 * HOUR,
        UpdateSchedule::Weekly => 7 * 24 * HOUR,
    })
}

/// Refreshes the remote catalog in the background, as often as the stored "Check for updates"
/// setting says (read again before every wait), and tells the UI when it did, so the Updates
/// badge and the library follow without a restart.
fn refresh_on_schedule(handle: AppHandle, settings: std::path::PathBuf) {
    tauri::async_runtime::spawn(async move {
        loop {
            let schedule = StoredSettings::read(&settings).schedule;
            tokio::time::sleep(refresh_period(schedule)).await;
            let Some(state) = handle.try_state::<services::AppState>() else {
                continue;
            };
            if state.refresh().await
                && let Err(e) = CatalogChangedEvent.emit(&handle)
            {
                tracing::warn!(error = %e, "could not tell the UI about the new catalog");
            }
        }
    });
}

/// The native shell: window, tray, login entry and `paparats://` links. The window stays hidden
/// until the UI reports its first frame (`shell_window_ready`), or until asked when the login
/// entry started us; the stored settings give the tray its language and the close button its
/// meaning before the UI has loaded. `flags` are the real strategies running (sign-in callbacks
/// go to the account flow only with real sign-in).
fn init_shell(app: &mut tauri::App, flags: RealFlags) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    let stored = StoredSettings::read(&app.path().app_data_dir()?.join(SETTINGS_FILE));
    let args: Vec<String> = std::env::args().collect();
    let start = ShellStart {
        hidden: shell::launched_by_autostart(&args),
        minimize_to_tray: stored.tray,
        locale: stored.locale,
        sign_in_callbacks: flags.account,
    };

    app.manage(MainWindow::prepare(&handle, &stored));
    let host = Arc::new(TauriShellHost::new(handle.clone()));
    app.manage(Shell::new(host.clone(), &start));
    host.set_tray(Tray::create(
        &handle,
        &TrayLabels::for_locale(stored.locale),
        |app, item| app.state::<Shell>().tray_item(item),
        |app| app.state::<Shell>().show(),
    )?);

    autostart::reconcile(&handle, stored.startup);

    // Development builds register paparats:// for themselves; installs get it from the installer.
    #[cfg(debug_assertions)]
    if let Err(e) = app.deep_link().register_all() {
        tracing::warn!(error = %e, "could not register the paparats:// scheme");
    }
    // The link that started this process, then the ones later launches hand over.
    if let Ok(Some(urls)) = app.deep_link().get_current() {
        for url in &urls {
            app.state::<Shell>().open_url(url);
        }
    }
    let links = handle.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            links.state::<Shell>().open_url(&url);
        }
    });

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FIRST_FRAME_TIMEOUT).await;
        if handle.state::<Shell>().reveal_if_still_waiting() {
            tracing::warn!("the UI did not report its first frame; showing the window anyway");
        }
    });
    Ok(())
}

pub fn run() {
    let builder = specta_builder::<tauri::Wry>();

    let app = tauri::Builder::default()
        // First: a second launch hands its arguments (and its `paparats://` link, through the
        // deep-link plugin) to this process and exits.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(shell) = app.try_state::<Shell>() {
                shell.second_instance(&args);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window::saved_state())
                .skip_initial_state(MAIN_WINDOW)
                .build(),
        )
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name(autostart::ENTRY_NAME)
                .args([shell::AUTOSTART_ARG])
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        // Settings: `settings.json` in the app data dir, read and written by the UI's
        // SettingsService (`services/tauri/settings.ts`).
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(builder.invoke_handler())
        .on_window_event(|window, event| {
            // Minimize to system tray: the close button and Alt+F4 hide the window instead.
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.label() == MAIN_WINDOW
                && window
                    .try_state::<Shell>()
                    .is_some_and(|shell| shell.minimize_to_tray())
            {
                api.prevent_close();
                if let Err(e) = window.hide() {
                    tracing::warn!(error = %e, "could not hide the window");
                }
            }
        })
        .setup(move |app| {
            builder.mount_events(app);
            let running = init_state(app)?;
            init_shell(app, running)
        })
        .build(tauri::generate_context!());

    match app {
        Ok(app) => app.run(|app, event| {
            if let RunEvent::Exit = event
                && let Some(window) = app.try_state::<MainWindow>()
            {
                window.keep_saved_maximized();
            }
        }),
        Err(err) => {
            tracing::error!(error = %err, "Paparats failed to start");
            eprintln!("Paparats failed to start: {err}");
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use serde_json::Value;

    use super::app_commands::APP_COMMANDS;

    /// Command names the generated bindings invoke.
    fn bindings_commands() -> BTreeSet<String> {
        include_str!("../../src/bindings.ts")
            .split("__TAURI_INVOKE(\"")
            .skip(1)
            .filter_map(|rest| rest.split('"').next())
            .map(str::to_owned)
            .collect()
    }

    fn capability() -> Value {
        serde_json::from_str(include_str!("../capabilities/default.json")).unwrap()
    }

    fn granted() -> BTreeSet<String> {
        capability()["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p.as_str().unwrap().to_owned())
            .collect()
    }

    #[test]
    fn the_command_list_matches_the_registry() {
        let listed: BTreeSet<String> = APP_COMMANDS.iter().map(|c| (*c).to_owned()).collect();
        assert_eq!(
            listed.len(),
            APP_COMMANDS.len(),
            "duplicates in APP_COMMANDS"
        );
        assert_eq!(
            listed,
            bindings_commands(),
            "run `pnpm specta` and update app_commands.rs"
        );
    }

    #[test]
    fn the_capability_grants_exactly_the_app_commands() {
        let app_permissions: BTreeSet<String> =
            granted().into_iter().filter(|p| !p.contains(':')).collect();
        let expected: BTreeSet<String> = APP_COMMANDS
            .iter()
            .map(|c| format!("allow-{}", c.replace('_', "-")))
            .collect();
        assert_eq!(app_permissions, expected);
    }

    #[test]
    fn plugin_permissions_are_single_commands() {
        // No `*:default` sets: each plugin command the UI uses is granted on its own.
        for permission in granted().iter().filter(|p| p.contains(':')) {
            assert!(!permission.ends_with(":default"), "{permission}");
            assert!(permission.contains(":allow-"), "{permission}");
        }
        assert_eq!(
            capability()["windows"],
            serde_json::json!([super::MAIN_WINDOW])
        );
    }

    #[test]
    fn updater_endpoints_are_on_the_allowlist() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let endpoints = config["plugins"]["updater"]["endpoints"]
            .as_array()
            .unwrap();
        assert!(!endpoints.is_empty());
        for endpoint in endpoints {
            let url: tauri::Url = endpoint.as_str().unwrap().parse().unwrap();
            assert_eq!(url.scheme(), "https");
            let host = url.host_str().unwrap();
            assert!(paparats_core::hosts::is_first_party(host), "{host}");
        }
    }

    #[test]
    fn the_scheme_is_registered_by_the_installer() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(
            config["plugins"]["deep-link"]["desktop"]["schemes"],
            serde_json::json!([super::deep_link::SCHEME])
        );
    }
}
