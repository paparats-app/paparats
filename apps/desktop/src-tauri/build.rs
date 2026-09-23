use std::path::Path;

// `APP_COMMANDS`: the app's own commands, shared with the crate (src/app_commands.rs).
include!("src/app_commands.rs");

fn main() {
    println!("cargo:rerun-if-changed=src/app_commands.rs");
    // An app manifest: tauri-build generates `allow-<command>` for every app command, and only
    // the ones capabilities/default.json grants can be invoked.
    let mut attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS));

    // On Windows/MSVC the application manifest (Common Controls v6, same content as tauri-build's
    // default) is embedded by the linker for every target of this package — the app, the
    // bindings exporter and the unit-test harness. tauri-build's resource manifest only reaches
    // `bins`, and tests on Tauri's mock runtime fail to load without comctl32 v6
    // (STATUS_ENTRYPOINT_NOT_FOUND).
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os == "windows" && target_env == "msvc" {
        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
        let dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let manifest = Path::new(&dir).join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }

    if let Err(e) = tauri_build::try_build(attributes) {
        panic!("tauri-build failed: {e:#}");
    }
}
