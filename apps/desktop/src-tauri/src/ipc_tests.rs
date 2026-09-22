//! The real IPC path on Tauri's mock runtime: the same `specta_builder()` registry, camelCase
//! argument names as the generated bindings send them, `{ kind, message }` errors, and the typed
//! download events reaching listeners.

use std::sync::{Arc, mpsc};
use std::time::Duration;

use paparats_download::SimulatedTransfer;
use paparats_install::SimulatedInstaller;
use paparats_storage::Storage;
use serde_json::{Value, json};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{
    INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder, mock_context, noop_assets,
};
use tauri::webview::InvokeRequest;
use tauri::{App, Listener, Manager, WebviewWindow, WebviewWindowBuilder};

use crate::events::TauriEvents;
use crate::services::AppState;
use crate::services::testing::{TODAY, fixed_clock};

/// A mock app with the full command/event registry and a fast simulated world (2 ms ticks).
fn app() -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let builder = crate::specta_builder::<MockRuntime>();
    let app = mock_builder()
        .invoke_handler(builder.invoke_handler())
        .build(mock_context(noop_assets()))
        .unwrap();
    builder.mount_events(&app);
    let tick = Duration::from_millis(2);
    let state = AppState::new(
        Arc::new(Storage::open_in_memory().unwrap()),
        Arc::new(TauriEvents::new(app.handle().clone())),
        tauri::async_runtime::handle().inner().clone(),
        fixed_clock(TODAY),
        Arc::new(SimulatedTransfer::with_random(|| 1.0).with_tick(tick)),
        Arc::new(SimulatedInstaller::with_timing(tick, 8)),
    )
    .unwrap();
    app.manage(state);
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    (app, webview)
}

fn invoke(webview: &WebviewWindow<MockRuntime>, cmd: &str, args: Value) -> Result<Value, Value> {
    get_ipc_response(
        webview,
        InvokeRequest {
            cmd: cmd.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: InvokeBody::Json(args),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    )
    .map(|body| body.deserialize::<Value>().unwrap())
}

#[test]
fn commands_round_trip_through_ipc() {
    let (_app, w) = app();

    assert_eq!(invoke(&w, "system_today", json!({})).unwrap(), json!(TODAY));
    let catalog = invoke(&w, "catalog_get_catalog", json!({})).unwrap();
    assert_eq!(catalog["apps"].as_array().map(Vec::len), Some(32));

    let lib = invoke(
        &w,
        "install_set_favorite",
        json!({"appId": "krita", "favorite": true}),
    )
    .unwrap();
    assert!(
        lib["favorites"]
            .as_array()
            .unwrap()
            .contains(&json!("krita"))
    );

    let err = invoke(&w, "channels_unsubscribe", json!({"channelId": "paparats"})).unwrap_err();
    assert_eq!(err["kind"], "invalid");
    let err = invoke(&w, "ideas_vote", json!({"ideaId": "ghost"})).unwrap_err();
    assert_eq!(err["kind"], "notFound");

    let found = invoke(
        &w,
        "channels_lookup",
        json!({"address": "https://winaero.com/"}),
    )
    .unwrap();
    assert_eq!(found, json!({"kind": "found", "channel": found["channel"]}));
    assert_eq!(found["channel"]["id"], "winaero");

    let draft = json!({"kind": "new", "appId": null, "category": "utilities",
                       "title": "Tray timer", "body": "Counts down."});
    let idea = invoke(&w, "ideas_propose", json!({ "draft": draft })).unwrap();
    assert_eq!(idea["id"], "u1");
    assert_eq!(idea["title"], "Tray timer");
    let short = json!({"kind": "new", "appId": null, "category": null, "title": "Hi", "body": ""});
    let err = invoke(&w, "ideas_propose", json!({ "draft": short })).unwrap_err();
    assert_eq!(err["kind"], "invalid");

    let actor = json!({"kind": "developer", "channelId": "nilesoft"});
    let idea = invoke(
        &w,
        "ideas_comment",
        json!({"ideaId": "clip", "text": "On it", "actor": actor}),
    )
    .unwrap();
    let last = idea["comments"]
        .as_array()
        .unwrap()
        .last()
        .cloned()
        .unwrap();
    assert_eq!(last["dev"], "nilesoft");

    let account = invoke(&w, "account_purchase", json!({"plan": "monthly"})).unwrap();
    assert_eq!(account["subscription"]["renewsOn"], "2026-10-15");
    let err = invoke(&w, "account_purchase", json!({"plan": "free"})).unwrap_err();
    assert_eq!(err["kind"], "invalid");

    let sync = invoke(&w, "channels_sync", json!({"channelId": "fossfriends"})).unwrap();
    assert_eq!(sync, json!({"kind": "unreachable", "days": 16}));

    let err = invoke(&w, "downloads_set_concurrency", json!({"limit": 0})).unwrap_err();
    assert_eq!(err["kind"], "invalid");
    invoke(&w, "downloads_set_concurrency", json!({"limit": 4})).unwrap();
    let snapshot = invoke(&w, "downloads_snapshot", json!({})).unwrap();
    assert_eq!(
        snapshot,
        json!({"items": [], "concurrency": 4, "online": true})
    );
}

#[test]
fn download_events_arrive_after_the_library_is_updated() {
    let (app, w) = app();
    let (tx, rx) = mpsc::channel::<(Value, Option<String>)>();
    let handle = app.handle().clone();
    // Runs synchronously inside `emit`: what the library says at the moment `installed` arrives.
    app.listen_any("download://state", move |event| {
        let payload: Value = serde_json::from_str(event.payload()).unwrap();
        let version = handle
            .state::<AppState>()
            .get_library()
            .unwrap()
            .installed
            .into_iter()
            .find(|a| a.app_id == "obsidian")
            .map(|a| a.version);
        let _ = tx.send((payload, version));
    });
    let (ptx, prx) = mpsc::channel::<Value>();
    app.listen_any("download://progress", move |event| {
        let _ = ptx.send(serde_json::from_str(event.payload()).unwrap());
    });

    let request =
        json!({"appId": "obsidian", "version": "1.8.10", "sizeMb": 12.0, "kind": "update"});
    invoke(&w, "downloads_enqueue", json!({"requests": [request]})).unwrap();

    let mut phases = Vec::new();
    let installed_version = loop {
        let (payload, version) = rx
            .recv_timeout(Duration::from_secs(10))
            .expect("download state event");
        assert_eq!(payload["appId"], "obsidian");
        phases.push(
            payload["phase"]["kind"]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
        );
        if payload["phase"]["kind"] == "installed" {
            assert_eq!(
                payload["phase"],
                json!({"kind": "installed", "version": "1.8.10", "update": true})
            );
            break version;
        }
    };
    assert_eq!(phases, ["queued", "downloading", "installing", "installed"]);
    assert_eq!(
        installed_version.as_deref(),
        Some("1.8.10"),
        "recorded before the event"
    );

    let progress: Vec<Value> = prx.try_iter().collect();
    assert_eq!(progress.len(), 10);
    assert_eq!(
        progress[0],
        json!({"appId": "obsidian", "progress": 10.0, "receivedMb": 1.2, "sizeMb": 12.0})
    );
    let account = invoke(&w, "account_get", json!({})).unwrap();
    assert_eq!(account["activity"][0]["appId"], "obsidian");
    assert_eq!(account["activity"][0]["kind"], "updated");
}
