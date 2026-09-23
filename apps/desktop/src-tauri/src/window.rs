//! The main window: hidden until the UI has painted (no white flash), the saved size, position
//! and maximized state (tauri-plugin-window-state), and the Tauri side of the shell
//! ([`TauriShellHost`]).
//!
//! tao 0.35 shows a hidden window when it is maximized, so the plugin restores only size and
//! position at startup (while the window is hidden) and the saved maximized state is applied when
//! the window is first shown. The first run starts centred at 1440×920 (tauri.conf.json), or
//! maximized when that does not fit the screen.

use std::path::PathBuf;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};

use paparats_core::ThemePreference;
use serde_json::Value;
use tauri::window::Color;
use tauri::{AppHandle, Manager, Runtime, Theme, WebviewWindow};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};
use tauri_specta::Event;

use crate::deep_link::DeepLinkTarget;
use crate::events::{DeepLinkEvent, TrayActionEvent};
use crate::shell::{ShellHost, StoredSettings};
use crate::tray::{Tray, TrayAction, TrayLabels};

/// Label of the only window (tauri.conf.json).
pub const MAIN_WINDOW: &str = "main";

/// What the window-state plugin saves (and restores, see the module docs).
pub fn saved_state() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

/// `--bg` of `tokens.css` per theme: the window and WebView background before the first paint.
pub const DARK_BG: (u8, u8, u8) = (0x0b, 0x17, 0x1b);
pub const LIGHT_BG: (u8, u8, u8) = (0xee, 0xf2, 0xf1);

/// The background for the stored theme ("System" follows Windows).
pub fn background(theme: ThemePreference, os: Theme) -> (u8, u8, u8) {
    let light = match theme {
        ThemePreference::Light => true,
        ThemePreference::Dark => false,
        ThemePreference::System => os == Theme::Light,
    };
    if light { LIGHT_BG } else { DARK_BG }
}

/// The main window's startup state, managed by Tauri.
pub struct MainWindow {
    shown: AtomicBool,
    /// Saved maximized, or the first run does not fit 1440×920: maximize when first shown.
    maximize_on_first_show: bool,
    saved_maximized: bool,
    state_file: Option<PathBuf>,
}

impl MainWindow {
    /// Runs in `setup`, before anything is visible: saved size and position, background colour.
    pub fn prepare<R: Runtime>(app: &AppHandle<R>, stored: &StoredSettings) -> Self {
        let state_file = app
            .path()
            .app_config_dir()
            .ok()
            .map(|dir| dir.join(app.filename()));
        let saved = state_file
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path).ok())
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .and_then(|mut all| all.get_mut(MAIN_WINDOW).map(Value::take));
        let saved_maximized = saved
            .as_ref()
            .and_then(|s| s.get("maximized"))
            .and_then(Value::as_bool)
            .unwrap_or(false);

        let mut too_big = false;
        if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
            let (r, g, b) = background(stored.theme, window.theme().unwrap_or(Theme::Dark));
            if let Err(e) = window.set_background_color(Some(Color(r, g, b, 255))) {
                tracing::debug!(error = %e, "could not set the window background");
            }
            if saved.is_some() {
                if let Err(e) = window.restore_state(StateFlags::SIZE | StateFlags::POSITION) {
                    tracing::warn!(error = %e, "could not restore the window position");
                }
            } else {
                too_big = does_not_fit(&window);
            }
        }
        Self {
            shown: AtomicBool::new(false),
            maximize_on_first_show: saved_maximized || too_big,
            saved_maximized,
            state_file,
        }
    }

    /// Shows, restores and focuses the window.
    pub fn reveal<R: Runtime>(&self, app: &AppHandle<R>) {
        let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
            return;
        };
        let first = !self.shown.swap(true, Ordering::Relaxed);
        let result = (|| {
            if first && self.maximize_on_first_show {
                window.maximize()?;
            }
            if window.is_minimized()? {
                window.unminimize()?;
            }
            window.show()?;
            window.set_focus()
        })();
        if let Err(e) = result {
            tracing::warn!(error = %e, "could not show the window");
        }
    }

    /// On exit, after the plugin has saved: a window that was never shown (started by the login
    /// entry, quit from the tray) was never maximized either — keep the saved maximized state.
    pub fn keep_saved_maximized(&self) {
        if self.shown.load(Ordering::Relaxed) || !self.saved_maximized {
            return;
        }
        let Some(path) = &self.state_file else {
            return;
        };
        let patched = std::fs::read_to_string(path)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .and_then(|mut all| {
                *all.get_mut(MAIN_WINDOW)?.get_mut("maximized")? = Value::Bool(true);
                serde_json::to_vec_pretty(&all).ok()
            });
        if let Some(bytes) = patched
            && let Err(e) = std::fs::write(path, bytes)
        {
            tracing::debug!(error = %e, "could not keep the maximized state");
        }
    }
}

/// Whether the configured first-run size overflows the work area of the window's monitor.
fn does_not_fit<R: Runtime>(window: &WebviewWindow<R>) -> bool {
    let (Ok(size), Ok(Some(monitor))) = (window.outer_size(), window.current_monitor()) else {
        return false;
    };
    let area = monitor.work_area().size;
    size.width > area.width || size.height > area.height
}

/// The Tauri side of the shell: the window, the tray and the UI events.
pub struct TauriShellHost<R: Runtime> {
    app: AppHandle<R>,
    tray: OnceLock<Tray<R>>,
}

impl<R: Runtime> TauriShellHost<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self {
            app,
            tray: OnceLock::new(),
        }
    }

    /// Hands over the tray once it exists (it needs the managed shell for its callbacks).
    pub fn set_tray(&self, tray: Tray<R>) {
        let _ = self.tray.set(tray);
    }
}

impl<R: Runtime> ShellHost for std::sync::Arc<TauriShellHost<R>> {
    fn reveal(&self) {
        if let Some(window) = self.app.try_state::<MainWindow>() {
            window.reveal(&self.app);
        }
    }

    fn relabel_tray(&self, labels: &TrayLabels) {
        if let Some(tray) = self.tray.get()
            && let Err(e) = tray.relabel(labels)
        {
            tracing::warn!(error = %e, "could not relabel the tray");
        }
    }

    fn emit_deep_link(&self, target: &DeepLinkTarget) {
        if let Err(e) = DeepLinkEvent(target.clone()).emit(&self.app) {
            tracing::warn!(error = %e, "could not hand a link to the UI");
        }
    }

    fn emit_tray_action(&self, action: TrayAction) {
        if let Err(e) = TrayActionEvent(action).emit(&self.app) {
            tracing::warn!(error = %e, "could not hand a tray action to the UI");
        }
    }

    fn quit(&self) {
        self.app.exit(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `--bg` in `tokens.css`, per theme block.
    fn token_bg(css: &str, theme: &str) -> (u8, u8, u8) {
        let block = css
            .split(&format!("[data-theme=\"{theme}\"]"))
            .nth(1)
            .unwrap();
        let hex = block
            .split("--bg:")
            .nth(1)
            .unwrap()
            .trim_start()
            .trim_start_matches('#');
        let byte = |i: usize| u8::from_str_radix(&hex[i..i + 2], 16).unwrap();
        (byte(0), byte(2), byte(4))
    }

    #[test]
    fn backgrounds_match_the_tokens() {
        let css = include_str!("../../src/styles/tokens.css");
        assert_eq!(token_bg(css, "dark"), DARK_BG);
        assert_eq!(token_bg(css, "light"), LIGHT_BG);
    }

    #[test]
    fn the_config_starts_hidden_on_the_dark_background() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let window = &config["app"]["windows"][0];
        assert_eq!(window["label"], MAIN_WINDOW);
        assert_eq!(window["visible"], false);
        assert_eq!(window["center"], true);
        assert_eq!(
            (window["width"].as_u64(), window["height"].as_u64()),
            (Some(1440), Some(920))
        );
        let (r, g, b) = DARK_BG;
        assert_eq!(window["backgroundColor"], format!("#{r:02x}{g:02x}{b:02x}"));
    }

    #[test]
    fn background_per_theme() {
        assert_eq!(background(ThemePreference::Dark, Theme::Light), DARK_BG);
        assert_eq!(background(ThemePreference::Light, Theme::Dark), LIGHT_BG);
        assert_eq!(background(ThemePreference::System, Theme::Light), LIGHT_BG);
        assert_eq!(background(ThemePreference::System, Theme::Dark), DARK_BG);
    }
}
