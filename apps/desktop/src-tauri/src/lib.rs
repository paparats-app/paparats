//! Paparats desktop client — Tauri entry point: plugins, commands, events, window setup.

mod commands;
mod error;

pub use error::{AppError, AppResult};

use tauri_specta::{Builder, collect_commands};

/// Where `export_bindings` writes the generated TypeScript, relative to this crate.
pub const BINDINGS_PATH: &str = "../src/bindings.ts";

/// The single registry of commands and events shared by the app and the bindings exporter.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![commands::app_info])
}

/// Writes `apps/desktop/src/bindings.ts`.
pub fn export_bindings() -> Result<(), String> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(BINDINGS_PATH);
    specta_builder()
        .export(
            specta_typescript::Typescript::default().header("// Regenerate with `pnpm specta`.\n"),
            path,
        )
        .map_err(|e| e.to_string())
}

pub fn run() {
    let builder = specta_builder();

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(err) = result {
        eprintln!("Paparats failed to start: {err}");
        std::process::exit(1);
    }
}
