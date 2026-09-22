//! Tauri commands. Every command returns `AppResult<T>` and is registered in `crate::specta_builder`.

use crate::error::AppResult;
use serde::Serialize;

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
