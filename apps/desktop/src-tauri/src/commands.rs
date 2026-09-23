//! Tauri commands: one per method of the TypeScript service contracts
//! (`apps/desktop/src/services/contracts.ts`), named `<service>_<method>`, plus the native shell's
//! `shell_*` commands. Every command is
//! `async` (runs on the async runtime, never on the UI thread), returns `AppResult<T>` and is
//! registered in `crate::specta_builder`. The logic lives in `crate::services`.

use paparats_core::{
    Account, Catalog, ChannelInfo, ChannelLookup, ChannelSubscription, DownloadRequest,
    DownloadSnapshot, Idea, IdeaActor, IdeaDraft, IsoDate, Library, Locale, PlanId, PlatformInfo,
    ProfilePatch, ReportReceipt, ReportTarget, SyncOutcome,
};
use serde::Serialize;
use tauri::State;

use crate::deep_link::DeepLinkTarget;
use crate::error::AppResult;
use crate::services::AppState;
use crate::shell::Shell;

type St<'a> = State<'a, AppState>;
type Sh<'a> = State<'a, Shell>;

/// Build information shown in Settings › About.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[tauri::command]
#[specta::specta]
pub fn app_info() -> AppResult<AppInfo> {
    Ok(AppInfo {
        name: paparats_core::PRODUCT_NAME.to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
    })
}

// --- catalog -------------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn catalog_get_catalog(state: St<'_>) -> AppResult<Catalog> {
    state.get_catalog()
}

#[tauri::command]
#[specta::specta]
pub async fn catalog_get_platform(state: St<'_>) -> AppResult<PlatformInfo> {
    state.get_platform()
}

// --- install (library) ---------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn install_get_library(state: St<'_>) -> AppResult<Library> {
    state.get_library()
}

#[tauri::command]
#[specta::specta]
pub async fn install_set_favorite(
    state: St<'_>,
    app_id: String,
    favorite: bool,
) -> AppResult<Library> {
    state.set_favorite(&app_id, favorite)
}

#[tauri::command]
#[specta::specta]
pub async fn install_uninstall(state: St<'_>, app_id: String) -> AppResult<Library> {
    state.uninstall(&app_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn install_open(state: St<'_>, app_id: String) -> AppResult<()> {
    state.open_app(&app_id)
}

#[tauri::command]
#[specta::specta]
pub async fn install_open_folder(state: St<'_>, app_id: String) -> AppResult<()> {
    state.open_install_folder(&app_id)
}

// --- downloads -----------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn downloads_snapshot(state: St<'_>) -> AppResult<DownloadSnapshot> {
    Ok(state.download_snapshot())
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_enqueue(state: St<'_>, requests: Vec<DownloadRequest>) -> AppResult<()> {
    state.enqueue_downloads(requests);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_pause(state: St<'_>, app_id: String) -> AppResult<()> {
    state.pause_download(&app_id);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_resume(state: St<'_>, app_id: String) -> AppResult<()> {
    state.resume_download(&app_id);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_cancel(state: St<'_>, app_id: String) -> AppResult<()> {
    state.cancel_download(&app_id);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_pause_all(state: St<'_>) -> AppResult<()> {
    state.pause_all_downloads();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_resume_all(state: St<'_>) -> AppResult<()> {
    state.resume_all_downloads();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_cancel_all(state: St<'_>) -> AppResult<()> {
    state.cancel_all_downloads();
    Ok(())
}

/// "Parallel downloads": any whole number ≥ 1 (the UI offers 1, 2 and 4; values above 255 run
/// 255 at a time); 0 is `invalid`, like the TypeScript mock.
#[tauri::command]
#[specta::specta]
pub async fn downloads_set_concurrency(state: St<'_>, limit: u32) -> AppResult<()> {
    state.set_download_concurrency(u8::try_from(limit).unwrap_or(u8::MAX))
}

#[tauri::command]
#[specta::specta]
pub async fn downloads_set_online(state: St<'_>, online: bool) -> AppResult<()> {
    state.set_downloads_online(online);
    Ok(())
}

// --- channels ------------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn channels_get_channels(state: St<'_>) -> AppResult<Vec<ChannelInfo>> {
    state.get_channels()
}

#[tauri::command]
#[specta::specta]
pub async fn channels_get_subscriptions(state: St<'_>) -> AppResult<Vec<ChannelSubscription>> {
    state.get_subscriptions()
}

#[tauri::command]
#[specta::specta]
pub async fn channels_lookup(state: St<'_>, address: String) -> AppResult<ChannelLookup> {
    state.lookup_channel(&address)
}

#[tauri::command]
#[specta::specta]
pub async fn channels_subscribe(
    state: St<'_>,
    channel_id: String,
) -> AppResult<Vec<ChannelSubscription>> {
    state.subscribe_channel(&channel_id)
}

#[tauri::command]
#[specta::specta]
pub async fn channels_unsubscribe(
    state: St<'_>,
    channel_id: String,
) -> AppResult<Vec<ChannelSubscription>> {
    state.unsubscribe_channel(&channel_id)
}

#[tauri::command]
#[specta::specta]
pub async fn channels_set_paused(
    state: St<'_>,
    channel_id: String,
    paused: bool,
) -> AppResult<Vec<ChannelSubscription>> {
    state.set_channel_paused(&channel_id, paused)
}

#[tauri::command]
#[specta::specta]
pub async fn channels_acknowledge_stale(
    state: St<'_>,
    channel_id: String,
) -> AppResult<Vec<ChannelSubscription>> {
    state.acknowledge_stale(&channel_id)
}

#[tauri::command]
#[specta::specta]
pub async fn channels_sync(state: St<'_>, channel_id: String) -> AppResult<SyncOutcome> {
    state.sync_channel(&channel_id)
}

#[tauri::command]
#[specta::specta]
pub async fn channels_report(
    state: St<'_>,
    target: ReportTarget,
    text: String,
) -> AppResult<ReportReceipt> {
    state.report_problem(&target, &text)
}

// --- ideas ---------------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn ideas_get(state: St<'_>) -> AppResult<Vec<Idea>> {
    state.get_ideas()
}

#[tauri::command]
#[specta::specta]
pub async fn ideas_vote(state: St<'_>, idea_id: String) -> AppResult<Idea> {
    state.vote_idea(&idea_id)
}

#[tauri::command]
#[specta::specta]
pub async fn ideas_propose(state: St<'_>, draft: IdeaDraft) -> AppResult<Idea> {
    state.propose_idea(&draft)
}

#[tauri::command]
#[specta::specta]
pub async fn ideas_comment(
    state: St<'_>,
    idea_id: String,
    text: String,
    actor: IdeaActor,
) -> AppResult<Idea> {
    state.comment_idea(&idea_id, &text, &actor)
}

#[tauri::command]
#[specta::specta]
pub async fn ideas_take(state: St<'_>, idea_id: String, channel_id: String) -> AppResult<Idea> {
    state.take_idea(&idea_id, &channel_id)
}

#[tauri::command]
#[specta::specta]
pub async fn ideas_release(
    state: St<'_>,
    idea_id: String,
    app_id: String,
    version: String,
) -> AppResult<Idea> {
    state.release_idea(&idea_id, &app_id, &version)
}

#[tauri::command]
#[specta::specta]
pub async fn ideas_dismiss_release_note(state: St<'_>, idea_id: String) -> AppResult<Idea> {
    state.dismiss_release_note(&idea_id)
}

// --- account -------------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn account_get(state: St<'_>) -> AppResult<Account> {
    state.get_account()
}

#[tauri::command]
#[specta::specta]
pub async fn account_update_profile(state: St<'_>, patch: ProfilePatch) -> AppResult<Account> {
    state.update_profile(&patch)
}

#[tauri::command]
#[specta::specta]
pub async fn account_remove_device(state: St<'_>, device_id: String) -> AppResult<Account> {
    state.remove_device(&device_id)
}

#[tauri::command]
#[specta::specta]
pub async fn account_set_two_factor(state: St<'_>, enabled: bool) -> AppResult<Account> {
    state.set_two_factor(enabled)
}

#[tauri::command]
#[specta::specta]
pub async fn account_purchase(state: St<'_>, plan: PlanId) -> AppResult<Account> {
    state.purchase_plan(plan)
}

#[tauri::command]
#[specta::specta]
pub async fn account_cancel_plan(state: St<'_>) -> AppResult<Account> {
    state.cancel_plan()
}

#[tauri::command]
#[specta::specta]
pub async fn account_claim_idea_bonus(state: St<'_>) -> AppResult<Account> {
    state.claim_idea_bonus()
}

#[tauri::command]
#[specta::specta]
pub async fn account_sign_in(state: St<'_>, email: String, password: String) -> AppResult<Account> {
    state.sign_in(&email, &password)
}

#[tauri::command]
#[specta::specta]
pub async fn account_sign_out(state: St<'_>) -> AppResult<Account> {
    state.sign_out()
}

// --- system --------------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn system_today(state: St<'_>) -> AppResult<IsoDate> {
    Ok(state.system_today())
}

// Settings › About › Check for updates runs in the UI through tauri-plugin-updater's `check()`
// (`services/tauri/system.ts`); the core has no command for it.

// --- native shell (tray, window, links) ----------------------------------------------------
// Not service methods: the UI's `platform/shell.ts` tells the shell what it needs to know.

/// The UI language, for the tray menu. Called at startup and on every change.
#[tauri::command]
#[specta::specta]
pub async fn shell_set_locale(shell: Sh<'_>, locale: Locale) -> AppResult<()> {
    shell.set_locale(locale);
    Ok(())
}

/// Settings › General › Minimize to system tray. Called at startup and on every change.
#[tauri::command]
#[specta::specta]
pub async fn shell_set_minimize_to_tray(shell: Sh<'_>, enabled: bool) -> AppResult<()> {
    shell.set_minimize_to_tray(enabled);
    Ok(())
}

/// The UI has painted its first frame: the window may appear.
#[tauri::command]
#[specta::specta]
pub async fn shell_window_ready(shell: Sh<'_>) -> AppResult<()> {
    shell.window_ready();
    Ok(())
}

/// The `paparats://` links that arrived before the UI listened; later ones come as
/// `shell://deep-link` events.
#[tauri::command]
#[specta::specta]
pub async fn shell_take_deep_links(shell: Sh<'_>) -> AppResult<Vec<DeepLinkTarget>> {
    Ok(shell.take_deep_links())
}
