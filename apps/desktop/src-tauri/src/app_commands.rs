// The app's own IPC commands by name. `build.rs` includes this file so tauri-build generates an
// `allow-<command>` permission for each of them (an app manifest: without one every app command
// would be callable from any window). `capabilities/default.json` grants exactly these; a test in
// `lib.rs` keeps this list, `specta_builder()` (through bindings.ts) and the capability in sync.

/// Every command registered in `specta_builder()`, in the same order.
pub const APP_COMMANDS: &[&str] = &[
    "app_info",
    // catalog
    "catalog_get_catalog",
    "catalog_get_platform",
    // install (library)
    "install_get_library",
    "install_set_favorite",
    "install_uninstall",
    "install_open",
    "install_open_folder",
    // downloads
    "downloads_snapshot",
    "downloads_enqueue",
    "downloads_pause",
    "downloads_resume",
    "downloads_cancel",
    "downloads_pause_all",
    "downloads_resume_all",
    "downloads_cancel_all",
    "downloads_set_concurrency",
    "downloads_set_online",
    // channels
    "channels_get_channels",
    "channels_get_subscriptions",
    "channels_lookup",
    "channels_subscribe",
    "channels_unsubscribe",
    "channels_set_paused",
    "channels_acknowledge_stale",
    "channels_sync",
    "channels_report",
    // ideas
    "ideas_get",
    "ideas_vote",
    "ideas_propose",
    "ideas_comment",
    "ideas_take",
    "ideas_release",
    "ideas_dismiss_release_note",
    // account
    "account_get",
    "account_update_profile",
    "account_remove_device",
    "account_set_two_factor",
    "account_purchase",
    "account_cancel_plan",
    "account_claim_idea_bonus",
    "account_sign_in",
    "account_sign_out",
    // system
    "system_today",
    // native shell
    "shell_set_locale",
    "shell_set_minimize_to_tray",
    "shell_window_ready",
    "shell_take_deep_links",
];
