//! The native shell around the WebView: tray, "Minimize to system tray", start on login, one
//! running instance, `paparats://` links and showing the window once the UI has painted.
//!
//! [`Shell`] holds the decisions and is plain Rust (unit-tested with a recording host); the Tauri
//! side — the tray, the window, events — sits behind [`ShellHost`] (`window.rs`, `lib.rs`).

use std::path::Path;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use paparats_core::{Locale, Settings, ThemePreference};
use serde_json::Value;

use crate::deep_link::{self, AuthCallback, DeepLink, DeepLinkTarget};
use crate::tray::{TrayAction, TrayItem, TrayLabels};

/// Argument the login entry passes (tauri-plugin-autostart): start hidden in the tray.
pub const AUTOSTART_ARG: &str = "--minimized";

/// Links kept for the UI until it listens (a cold start from a link, or links during startup).
const MAX_PENDING_LINKS: usize = 8;

/// What the shell does to the outside world.
pub trait ShellHost: Send + Sync + 'static {
    /// Shows, restores and focuses the main window.
    fn reveal(&self);
    fn relabel_tray(&self, labels: &TrayLabels);
    fn emit_deep_link(&self, target: &DeepLinkTarget);
    fn emit_tray_action(&self, action: TrayAction);
    /// Hands the browser sign-in's return link to the account flow (real sign-in only).
    fn sign_in_callback(&self, callback: AuthCallback);
    /// Exits the app (tray › Quit).
    fn quit(&self);
}

/// How this process started and what the stored settings say.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellStart {
    /// Launched by the login entry: stay in the tray until asked.
    pub hidden: bool,
    pub minimize_to_tray: bool,
    pub locale: Locale,
    /// Real sign-in is on (`PAPARATS_REAL=account`): `paparats://auth/callback` links finish it.
    pub sign_in_callbacks: bool,
}

#[derive(Default)]
struct LinkQueue {
    /// The UI has taken the queue once: later links go out as events.
    listening: bool,
    pending: Vec<DeepLinkTarget>,
}

/// The shell's state, managed by Tauri.
pub struct Shell {
    host: Box<dyn ShellHost>,
    start_hidden: bool,
    minimize_to_tray: AtomicBool,
    locale: Mutex<Locale>,
    ui_ready: AtomicBool,
    shown: AtomicBool,
    links: Mutex<LinkQueue>,
    sign_in_callbacks: bool,
}

impl Shell {
    pub fn new(host: impl ShellHost, start: &ShellStart) -> Self {
        Self {
            host: Box::new(host),
            start_hidden: start.hidden,
            minimize_to_tray: AtomicBool::new(start.minimize_to_tray),
            locale: Mutex::new(start.locale),
            ui_ready: AtomicBool::new(false),
            shown: AtomicBool::new(false),
            links: Mutex::new(LinkQueue::default()),
            sign_in_callbacks: start.sign_in_callbacks,
        }
    }

    /// Whether closing the window hides it (Settings › General › Minimize to system tray).
    pub fn minimize_to_tray(&self) -> bool {
        self.minimize_to_tray.load(Ordering::Relaxed)
    }

    pub fn set_minimize_to_tray(&self, enabled: bool) {
        self.minimize_to_tray.store(enabled, Ordering::Relaxed);
    }

    /// The UI language changed: relabel the tray.
    pub fn set_locale(&self, locale: Locale) {
        let changed = match self.locale.lock() {
            Ok(mut current) => std::mem::replace(&mut *current, locale) != locale,
            Err(_) => true,
        };
        if changed {
            self.host.relabel_tray(&TrayLabels::for_locale(locale));
        }
    }

    /// The UI painted its first frame: show the window, unless the login entry started us.
    pub fn window_ready(&self) {
        if !self.ui_ready.swap(true, Ordering::Relaxed) && !self.start_hidden {
            self.show();
        }
    }

    /// Safety net when the UI never reports its first frame (a broken bundle, a dev server that
    /// is still compiling): show the window anyway. Returns whether it did.
    pub fn reveal_if_still_waiting(&self) -> bool {
        let waiting = !self.start_hidden && !self.shown.load(Ordering::Relaxed);
        if waiting {
            self.show();
        }
        waiting
    }

    pub fn show(&self) {
        self.shown.store(true, Ordering::Relaxed);
        self.host.reveal();
    }

    /// A tray menu entry was clicked.
    pub fn tray_item(&self, item: TrayItem) {
        match item {
            TrayItem::Open => self.show(),
            TrayItem::CheckForUpdates => {
                self.show();
                self.host.emit_tray_action(TrayAction::CheckForUpdates);
            }
            TrayItem::Quit => self.host.quit(),
        }
    }

    /// A second launch (its arguments, the executable first). Its `paparats://` link — if any —
    /// arrives separately through the deep-link plugin; here the window comes forward, unless the
    /// login entry started it while we already run.
    pub fn second_instance(&self, args: &[String]) {
        if !launched_by_autostart(args) {
            self.show();
        }
    }

    /// A `paparats://` link: the first launch argument or one handed over by a second launch.
    pub fn open_url(&self, url: &tauri::Url) {
        match deep_link::parse(url) {
            Ok(DeepLink::Open(target)) => {
                tracing::info!(?target, "opening a paparats:// link");
                self.deliver(target);
                self.show();
            }
            // The browser sign-in comes back: the account flow finishes it and the window comes
            // forward. Never log the link (its query holds the authorization code).
            Ok(DeepLink::AuthCallback(callback)) if self.sign_in_callbacks => {
                tracing::info!("sign-in callback received");
                self.host.sign_in_callback(callback);
                self.show();
            }
            Ok(DeepLink::AuthCallback(_)) => {
                tracing::info!("sign-in callback ignored: real sign-in is off");
            }
            Err(e) => tracing::warn!(error = %e, "ignored a link"),
        }
    }

    fn deliver(&self, target: DeepLinkTarget) {
        let Ok(mut links) = self.links.lock() else {
            return;
        };
        if links.listening {
            drop(links);
            self.host.emit_deep_link(&target);
        } else if links.pending.len() < MAX_PENDING_LINKS {
            links.pending.push(target);
        }
    }

    /// The UI listens for links from now on; returns the ones that arrived before.
    pub fn take_deep_links(&self) -> Vec<DeepLinkTarget> {
        match self.links.lock() {
            Ok(mut links) => {
                links.listening = true;
                std::mem::take(&mut links.pending)
            }
            Err(_) => Vec::new(),
        }
    }
}

/// Whether the arguments (the executable first) come from the login entry.
pub fn launched_by_autostart<S: AsRef<str>>(args: &[S]) -> bool {
    args.iter().skip(1).any(|a| a.as_ref() == AUTOSTART_ARG)
}

/// The settings the core needs before the UI has loaded, read from the UI's `settings.json`
/// (tauri-plugin-store, one key per changed setting). Like the UI's reader, a missing or unreadable
/// file means defaults, and a value of the wrong type is ignored — the file is user-editable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredSettings {
    pub locale: Locale,
    pub tray: bool,
    pub startup: bool,
    pub theme: ThemePreference,
}

impl Default for StoredSettings {
    fn default() -> Self {
        let defaults = Settings::default();
        Self {
            locale: defaults.locale,
            tray: defaults.tray,
            startup: defaults.startup,
            theme: defaults.theme,
        }
    }
}

impl StoredSettings {
    pub fn from_json(text: &str) -> Self {
        let mut stored = Self::default();
        let Ok(Value::Object(map)) = serde_json::from_str::<Value>(text) else {
            return stored;
        };
        fn pick<T: serde::de::DeserializeOwned>(value: Option<&Value>, into: &mut T) {
            if let Some(v) = value.and_then(|v| serde_json::from_value(v.clone()).ok()) {
                *into = v;
            }
        }
        pick(map.get("locale"), &mut stored.locale);
        pick(map.get("tray"), &mut stored.tray);
        pick(map.get("startup"), &mut stored.startup);
        pick(map.get("theme"), &mut stored.theme);
        stored
    }

    pub fn read(path: &Path) -> Self {
        std::fs::read_to_string(path)
            .map(|text| Self::from_json(&text))
            .unwrap_or_default()
    }
}

#[cfg(test)]
pub mod testing {
    use std::sync::{Arc, Mutex};

    use super::*;

    /// What the shell asked the host to do, in order.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub enum Call {
        Reveal,
        Relabel(&'static str),
        DeepLink(DeepLinkTarget),
        TrayAction(TrayAction),
        SignInCallback(String),
        Quit,
    }

    #[derive(Clone, Default)]
    pub struct Recorder(pub Arc<Mutex<Vec<Call>>>);

    impl Recorder {
        pub fn calls(&self) -> Vec<Call> {
            self.0.lock().map(|c| c.clone()).unwrap_or_default()
        }

        pub fn clear(&self) {
            if let Ok(mut c) = self.0.lock() {
                c.clear();
            }
        }

        fn push(&self, call: Call) {
            if let Ok(mut c) = self.0.lock() {
                c.push(call);
            }
        }
    }

    impl ShellHost for Recorder {
        fn reveal(&self) {
            self.push(Call::Reveal);
        }
        fn relabel_tray(&self, labels: &TrayLabels) {
            self.push(Call::Relabel(labels.open));
        }
        fn emit_deep_link(&self, target: &DeepLinkTarget) {
            self.push(Call::DeepLink(target.clone()));
        }
        fn emit_tray_action(&self, action: TrayAction) {
            self.push(Call::TrayAction(action));
        }
        fn sign_in_callback(&self, callback: AuthCallback) {
            self.push(Call::SignInCallback(callback.url().as_str().to_owned()));
        }
        fn quit(&self) {
            self.push(Call::Quit);
        }
    }

    pub fn start(hidden: bool) -> ShellStart {
        ShellStart {
            hidden,
            minimize_to_tray: true,
            locale: Locale::En,
            sign_in_callbacks: false,
        }
    }

    pub fn shell(hidden: bool) -> (Shell, Recorder) {
        let recorder = Recorder::default();
        (Shell::new(recorder.clone(), &start(hidden)), recorder)
    }
}

#[cfg(test)]
mod tests {
    use super::testing::{Call, shell};
    use super::*;

    fn url(raw: &str) -> tauri::Url {
        raw.parse().unwrap()
    }

    fn app(id: &str) -> DeepLinkTarget {
        DeepLinkTarget::App(id.into())
    }

    #[test]
    fn the_window_appears_after_the_first_frame() {
        let (s, rec) = shell(false);
        assert!(rec.calls().is_empty(), "hidden until the UI has painted");
        s.window_ready();
        assert_eq!(rec.calls(), [Call::Reveal]);
        // A reload of the page does not pull a window back out of the tray.
        s.window_ready();
        assert_eq!(rec.calls(), [Call::Reveal]);
        assert!(!s.reveal_if_still_waiting());
    }

    #[test]
    fn autostart_stays_in_the_tray() {
        let (s, rec) = shell(true);
        s.window_ready();
        assert!(!s.reveal_if_still_waiting());
        assert!(rec.calls().is_empty());
        s.tray_item(TrayItem::Open);
        assert_eq!(rec.calls(), [Call::Reveal]);
    }

    #[test]
    fn a_ui_that_never_paints_still_gets_a_window() {
        let (s, rec) = shell(false);
        assert!(s.reveal_if_still_waiting());
        assert_eq!(rec.calls(), [Call::Reveal]);
    }

    #[test]
    fn tray_menu() {
        let (s, rec) = shell(false);
        s.tray_item(TrayItem::CheckForUpdates);
        s.tray_item(TrayItem::Quit);
        assert_eq!(
            rec.calls(),
            [
                Call::Reveal,
                Call::TrayAction(TrayAction::CheckForUpdates),
                Call::Quit
            ]
        );
    }

    #[test]
    fn locale_changes_relabel_the_tray_once() {
        let (s, rec) = shell(false);
        s.set_locale(Locale::En); // already English
        s.set_locale(Locale::Be);
        s.set_locale(Locale::Be);
        s.set_locale(Locale::Ru);
        assert_eq!(
            rec.calls(),
            [
                Call::Relabel("Адкрыць Paparats"),
                Call::Relabel("Открыть Paparats")
            ]
        );
    }

    #[test]
    fn minimize_to_tray_follows_the_ui() {
        let (s, _) = shell(false);
        assert!(s.minimize_to_tray());
        s.set_minimize_to_tray(false);
        assert!(!s.minimize_to_tray());
    }

    #[test]
    fn links_wait_for_the_ui_then_go_out_as_events() {
        let (s, rec) = shell(false);
        s.open_url(&url("paparats://app/obs"));
        s.open_url(&url("paparats://channel/nilesoft"));
        assert_eq!(rec.calls(), [Call::Reveal, Call::Reveal]);
        assert_eq!(
            s.take_deep_links(),
            [app("obs"), DeepLinkTarget::Channel("nilesoft".into())]
        );
        assert!(s.take_deep_links().is_empty());

        rec.clear();
        s.open_url(&url("paparats://app/vlc"));
        assert_eq!(rec.calls(), [Call::DeepLink(app("vlc")), Call::Reveal]);
        assert!(s.take_deep_links().is_empty());
    }

    #[test]
    fn ignored_links_do_nothing() {
        let (s, rec) = shell(false);
        s.open_url(&url("paparats://auth/callback?code=secret"));
        s.open_url(&url("paparats://settings/about"));
        s.open_url(&url("https://paparats.app/app/obs"));
        assert!(rec.calls().is_empty());
        assert!(s.take_deep_links().is_empty());
    }

    #[test]
    fn sign_in_callbacks_go_to_the_account_flow_when_real_sign_in_is_on() {
        let recorder = testing::Recorder::default();
        let start = ShellStart {
            sign_in_callbacks: true,
            ..testing::start(false)
        };
        let s = Shell::new(recorder.clone(), &start);
        let raw = "paparats://auth/callback?code=secret&state=xyz";
        s.open_url(&url(raw));
        assert_eq!(
            recorder.calls(),
            [Call::SignInCallback(raw.into()), Call::Reveal]
        );
        assert!(s.take_deep_links().is_empty(), "never handed to the UI");
    }

    #[test]
    fn the_queue_is_bounded() {
        let (s, _) = shell(false);
        for i in 0..20 {
            s.open_url(&url(&format!("paparats://app/a{i}")));
        }
        assert_eq!(s.take_deep_links().len(), MAX_PENDING_LINKS);
    }

    #[test]
    fn second_launches() {
        let (s, rec) = shell(true);
        s.second_instance(&["paparats.exe".into(), AUTOSTART_ARG.into()]);
        assert!(
            rec.calls().is_empty(),
            "the login entry never pulls the window out"
        );
        s.second_instance(&["paparats.exe".into()]);
        s.second_instance(&["paparats.exe".into(), "paparats://app/obs".into()]);
        assert_eq!(rec.calls(), [Call::Reveal, Call::Reveal]);
    }

    #[test]
    fn autostart_argument() {
        assert!(launched_by_autostart(&[
            "C:\\Paparats\\Paparats.exe",
            "--minimized"
        ]));
        assert!(!launched_by_autostart(&["C:\\Paparats\\Paparats.exe"]));
        assert!(
            !launched_by_autostart(&["--minimized"]),
            "argv[0] is the executable"
        );
        assert!(!launched_by_autostart(&["x", "paparats://app/obs"]));
    }

    #[test]
    fn stored_settings() {
        assert_eq!(StoredSettings::from_json(""), StoredSettings::default());
        assert_eq!(
            StoredSettings::from_json("[1, 2]"),
            StoredSettings::default()
        );
        let defaults = StoredSettings::default();
        assert_eq!(defaults.locale, Locale::En);
        assert!(defaults.tray && defaults.startup);
        assert_eq!(defaults.theme, ThemePreference::Dark);

        let s = StoredSettings::from_json(
            r#"{"locale":"be","tray":false,"startup":false,"theme":"light","parallel":4}"#,
        );
        assert_eq!(
            s,
            StoredSettings {
                locale: Locale::Be,
                tray: false,
                startup: false,
                theme: ThemePreference::Light
            }
        );
        // Wrong types and unknown values fall back to the defaults, key by key.
        let s = StoredSettings::from_json(r#"{"locale":"de","tray":"no","theme":"system"}"#);
        assert_eq!(
            s,
            StoredSettings {
                theme: ThemePreference::System,
                ..StoredSettings::default()
            }
        );
    }

    #[test]
    fn stored_settings_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        assert_eq!(StoredSettings::read(&path), StoredSettings::default());
        std::fs::write(&path, r#"{"locale":"ru"}"#).unwrap();
        assert_eq!(StoredSettings::read(&path).locale, Locale::Ru);
    }
}
