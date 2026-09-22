# Decisions

Product and engineering decisions taken where the handoff was silent or where we diverged from it.
Newest last. Each entry: context → decision → consequence.

## D1 — Toolchain versions (M0)
Tauri 2.11, React 19.1, TypeScript 6.0, Vite 8, ESLint 10, Vitest 5, react-router 8, i18next 26,
Zustand 5, TanStack Query 5, lucide-react 1.x. tauri-specta and specta are pinned to the same
release candidate (`=2.0.0-rc.25`) because the RCs are not semver-compatible with each other.

## D2 — Package layout (M0)
The repository root is both the pnpm workspace and the Cargo workspace. The Tauri crate is named
`paparats-desktop` (lib `paparats_desktop_lib`); the bindings exporter is a second binary
(`export-bindings`) so `pnpm specta` does not need to start the app.

## D3 — Mock switch (M0)
`PAPARATS_MOCK=1` is read by Vite at dev/build time (`__PAPARATS_MOCK__`). The UI also falls back to
the mock services automatically when it is not running inside Tauri (plain browser, Vitest).

## D4 — Frameless window chrome (M0)
`decorations: false` with `shadow: true`, so Windows 11 still draws the native rounded corners and
1 px border. No community title-bar plugin is used yet, so the maximise button has no Snap Layouts
hover flyout (accepted loss, as allowed by STACK.md).

## Rust core (M2–M3)

### D5 — Command surface
One `async` Tauri command per method of `services/contracts.ts`, named `<service>_<method>`
(`catalog_get_catalog`, `downloads_set_concurrency`, …); `async` because Tauri runs sync
commands on the main thread. The logic sits in a Tauri-free `services` layer
(`apps/desktop/src-tauri/src/services/`) that mirrors the TypeScript mocks and is unit-tested,
plus IPC tests on Tauri's mock runtime. Errors cross as `AppError` `{kind: notFound | invalid |
internal, message}`. `SettingsService` has no Rust side (settings stay in the UI store, STACK.md
decision 4).

### D6 — Download events and cadence
Events are named `download://progress` and `download://state` (as documented on the model
types); the bindings expose them as `events.downloadProgress` / `events.downloadState` with
`DownloadProgress` / `DownloadStateChange` payloads. The simulated transfer reports once per
prototype tick (110 ms ≈ 9 Hz — the prototype's timing wins over the "≥ 10 Hz" budget, which
`HttpTransfer` meets with a 100 ms cadence).

### D7 — Queue semantics = the TypeScript mock
Pause/resume only touch `downloading`/`paused` items; offline also freezes the 8-tick
"Installing…" hold (as in the prototype); cancel works in every state; any concurrency ≥ 1 is
accepted (0 → `invalid`). The engine starts at 2 parallel downloads and online — the UI pushes
`settings.parallel` and connectivity with `downloads_set_concurrency` / `downloads_set_online`
at startup. A finished item is recorded (inventory, activity dated today,
`usage.updatesInstalled + 1` when `request.kind` is `update`) before `installed` is emitted; if
recording fails the item ends `failed`.

### D8 — "Today" on the Rust side is the local clock
Not `fixtures/meta.json › today`. Renewals, the idea gift (today + `IDEA_BONUS_MONTHS`, where the
mock uses the fixed `meta.ideaBonusUntil`), activity and sync dates and outage days use the real
date — e.g. FOSS Friends (outage 2026-08-30) is already stale in the app. The seeded data itself
stays anchored at 2026-09-15.

### D9 — Persistence layout
One SQLite file, `app_data_dir()/paparats.db` (rusqlite, bundled, WAL, `PRAGMA user_version`
migrations): `installed`, `favorites`, `library_collections`, `activity` (newest first),
`channel_subscriptions` (in follow order), `channel_sync` (local "Sync now" dates, which
override the published `synced`), `ideas` and `account` (JSON rows; activity lives in its own
table), `meta`. The mock world is seeded once (meta `seeded`); later fixture edits do not reach an
existing database — delete it to reseed during development.

### D10 — HTTP transfer rules
HTTPS only (plain HTTP to loopback hosts, for tests); the host of the URL and of every redirect
must be on `paparats_core::hosts::Allowlist`; the manifest SHA-256 is mandatory; partial files
survive pause/offline for `Range` resume and are deleted on cancel or any failure. reqwest uses
`native-tls` (Schannel, no OpenSSL/aws-lc build) and `Response::chunk` instead of the `stream`
feature; `sha2` is 0.11, the version ed25519-dalek 3 already brings.

### D11 — Placeholders until M6/M7
`install_open` / `install_open_folder` do nothing yet; `channels_report` returns the routing
receipt without sending (the text is neither stored nor logged); sign-in accepts any password and
drops it; `system_check_for_app_update` keeps the prototype's 1.2 s and answers `upToDate`;
`catalog_get_platform` reports this binary's version in `about.version` (the build number still
comes from the data set until CI stamps one).

### D12 — Windows manifest embedded by the linker
`build.rs` embeds the Common-Controls v6 manifest (same content as tauri-build's default) with
`/MANIFEST:EMBED` for every target instead of tauri-build's resource, which only reaches `bins`:
test binaries on Tauri's mock runtime otherwise fail to load (`STATUS_ENTRYPOINT_NOT_FOUND`).
