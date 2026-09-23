//! The notification-area icon (tauri `tray-icon`): the Paparats icon, a tooltip and a menu —
//! Open Paparats · Check for updates · Quit. A left click shows and focuses the window.
//!
//! The menu is native, outside the WebView, so its three labels live here rather than in the UI
//! catalogs; the UI tells the core its language (`shell_set_locale`) at startup and on every change,
//! and before that the language stored in `settings.json` is used.

use paparats_core::{Locale, PRODUCT_NAME};
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Runtime};

/// Id of the tray icon.
pub const TRAY_ID: &str = "main";

/// The tray menu's entries.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayItem {
    Open,
    CheckForUpdates,
    Quit,
}

impl TrayItem {
    pub const ALL: [TrayItem; 3] = [TrayItem::Open, TrayItem::CheckForUpdates, TrayItem::Quit];

    /// The menu item id.
    pub fn id(self) -> &'static str {
        match self {
            TrayItem::Open => "open",
            TrayItem::CheckForUpdates => "check-for-updates",
            TrayItem::Quit => "quit",
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|item| item.id() == id)
    }
}

/// What the tray asks the UI to do (`shell://tray-action`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum TrayAction {
    /// "Check for updates": the UI opens Settings › About and checks for a new Paparats version.
    CheckForUpdates,
}

/// The tray's copy in one language.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayLabels {
    pub tooltip: &'static str,
    pub open: &'static str,
    pub check_for_updates: &'static str,
    pub quit: &'static str,
}

impl TrayLabels {
    /// The labels for a UI language ("Check for updates" is the About button's copy,
    /// `about.checkUpdates`).
    pub fn for_locale(locale: Locale) -> Self {
        match locale {
            Locale::En => Self {
                tooltip: PRODUCT_NAME,
                open: "Open Paparats",
                check_for_updates: "Check for updates",
                quit: "Quit",
            },
            Locale::Be => Self {
                tooltip: PRODUCT_NAME,
                open: "Адкрыць Paparats",
                check_for_updates: "Праверыць абнаўленні",
                quit: "Выйсці",
            },
            Locale::Ru => Self {
                tooltip: PRODUCT_NAME,
                open: "Открыть Paparats",
                check_for_updates: "Проверить обновления",
                quit: "Выйти",
            },
        }
    }

    /// The label of a menu entry.
    pub fn label(&self, item: TrayItem) -> &'static str {
        match item {
            TrayItem::Open => self.open,
            TrayItem::CheckForUpdates => self.check_for_updates,
            TrayItem::Quit => self.quit,
        }
    }
}

/// The live tray: the icon and its menu items, relabelled when the UI language changes.
pub struct Tray<R: Runtime> {
    icon: TrayIcon<R>,
    items: Vec<(TrayItem, MenuItem<R>)>,
}

impl<R: Runtime> Tray<R> {
    /// Creates the icon. `on_item` runs for menu clicks, `on_click` for a left click on the icon.
    pub fn create(
        app: &AppHandle<R>,
        labels: &TrayLabels,
        on_item: impl Fn(&AppHandle<R>, TrayItem) + Send + Sync + 'static,
        on_click: impl Fn(&AppHandle<R>) + Send + Sync + 'static,
    ) -> tauri::Result<Self> {
        let items = TrayItem::ALL
            .into_iter()
            .map(|item| {
                MenuItem::with_id(app, item.id(), labels.label(item), true, None::<&str>)
                    .map(|entry| (item, entry))
            })
            .collect::<tauri::Result<Vec<_>>>()?;
        let menu = Menu::new(app)?;
        for (item, entry) in &items {
            if *item == TrayItem::Quit {
                menu.append(&PredefinedMenuItem::separator(app)?)?;
            }
            menu.append(entry)?;
        }

        let mut builder = TrayIconBuilder::with_id(TRAY_ID)
            .tooltip(labels.tooltip)
            .menu(&menu)
            // Left click opens the window; the menu is on the right button (Windows convention).
            .show_menu_on_left_click(false)
            .on_menu_event(move |app: &AppHandle<R>, event: MenuEvent| {
                if let Some(item) = TrayItem::from_id(event.id().as_ref()) {
                    on_item(app, item);
                }
            })
            .on_tray_icon_event(move |tray: &TrayIcon<R>, event: TrayIconEvent| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    on_click(tray.app_handle());
                }
            });
        if let Some(icon) = app.default_window_icon() {
            builder = builder.icon(icon.clone());
        }
        let icon = builder.build(app)?;
        Ok(Self { icon, items })
    }

    /// Applies the labels of another language.
    pub fn relabel(&self, labels: &TrayLabels) -> tauri::Result<()> {
        for (item, entry) in &self.items {
            entry.set_text(labels.label(*item))?;
        }
        self.icon.set_tooltip(Some(labels.tooltip))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOCALES: [Locale; 3] = [Locale::En, Locale::Be, Locale::Ru];

    #[test]
    fn labels_per_language() {
        let en = TrayLabels::for_locale(Locale::En);
        assert_eq!(
            [en.open, en.check_for_updates, en.quit],
            ["Open Paparats", "Check for updates", "Quit"]
        );
        let be = TrayLabels::for_locale(Locale::Be);
        assert_eq!(
            [be.open, be.check_for_updates, be.quit],
            ["Адкрыць Paparats", "Праверыць абнаўленні", "Выйсці"]
        );
        let ru = TrayLabels::for_locale(Locale::Ru);
        assert_eq!(
            [ru.open, ru.check_for_updates, ru.quit],
            ["Открыть Paparats", "Проверить обновления", "Выйти"]
        );
    }

    #[test]
    fn every_language_labels_every_item() {
        for locale in LOCALES {
            let labels = TrayLabels::for_locale(locale);
            assert_eq!(labels.tooltip, "Paparats");
            for item in TrayItem::ALL {
                assert!(!labels.label(item).trim().is_empty(), "{locale:?} {item:?}");
            }
        }
        // Each language has its own copy (nothing left in English by mistake).
        let open: Vec<_> = LOCALES
            .map(|l| TrayLabels::for_locale(l).open)
            .into_iter()
            .collect();
        assert_eq!(open.len(), 3);
        assert!(open[0] != open[1] && open[1] != open[2] && open[0] != open[2]);
    }

    #[test]
    fn menu_ids_map_back_to_items() {
        for item in TrayItem::ALL {
            assert_eq!(TrayItem::from_id(item.id()), Some(item));
        }
        assert_eq!(TrayItem::from_id("settings"), None);
        assert_eq!(TrayItem::from_id(""), None);
    }

    #[test]
    fn check_for_updates_matches_the_about_button() {
        // The same words as Settings › About (`about.checkUpdates` in the UI catalogs).
        let catalogs = [
            (
                Locale::En,
                include_str!("../../src/i18n/locales/en/about.ts"),
            ),
            (
                Locale::Be,
                include_str!("../../src/i18n/locales/be/about.ts"),
            ),
            (
                Locale::Ru,
                include_str!("../../src/i18n/locales/ru/about.ts"),
            ),
        ];
        for (locale, source) in catalogs {
            let label = TrayLabels::for_locale(locale).check_for_updates;
            assert!(
                source.contains(&format!("checkUpdates: \"{label}\"")),
                "{locale:?}: {label}"
            );
        }
    }

    #[test]
    fn tray_action_wire_shape() {
        assert_eq!(
            serde_json::to_value(TrayAction::CheckForUpdates).unwrap(),
            serde_json::json!("checkForUpdates")
        );
    }
}
