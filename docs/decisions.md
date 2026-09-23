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

## D5 — Developer-mode tools replace the prototype's demo toolbar (M1)
The prototype has a toolbar above the window (Replay first launch, Offline, Language, View as
user/developer) that is not part of the product. In the app these become rows in
Settings › Advanced that appear only while Developer mode (`settings.dev`) is on: **View as
developer** (`viewAsDeveloper`), **Simulate offline** (`simulateOffline`), **Replay first launch**
and **Component gallery** (opens `/dev`). Language lives in Settings › General and the first
launch. The two toggles are persisted settings; `useViewAs()` requires both `dev` and
`viewAsDeveloper`, and `useOffline()` is real connectivity OR `simulateOffline`. The offline
banner's Retry ends a simulated outage; during a real one it answers with the "You're offline"
toast. "Back online" is toasted whenever connectivity (real or simulated) returns.

## D6 — Tauri adapters delegate to the mock services until their commands exist (M1)
Only `app_info` exists on the Rust side. Every `services/tauri/*` adapter except `system`
delegates to an in-memory mock instance; `system` uses the real local date, `tauri-plugin-opener`
and the WebView's connectivity and clipboard. In Tauri mode the delegated mock is created with
`today = localToday()` so installs, ideas and renewals carry the same date as `system.today()`
(captured at startup: a session that crosses midnight keeps the start date until real commands
land). Each milestone replaces its services' delegation with `unwrap(commands.x())` and removes
the line here: catalog (M2), install + downloads (M3), account + settings (M4), channels + ideas
(M5).

## D7 — "Updated just now" clears when leaving Updates (M1)
The README says an updated app shows "Updated just now" "until you leave the screen"; the
prototype kept the marker until the app was uninstalled. We follow the README: `useNav().go()`
clears `useDownloadsStore.justUpdated` whenever it navigates away from `/updates` (opening an app
page from Updates counts as leaving). Uninstalling also clears the app's marker (Library, M3).

## D8 — "All updates installed" toast only ends an Update-all batch (M1)
The toast fires once, when the last item of an "Update all" batch installs. The prototype also
toasted when a single update finished with an empty queue; a lone update is already confirmed by
its row. If the batch's last item is cancelled or fails, the batch ends without a toast. A failed
download removes the item silently (there is no failure copy in the handoff yet).

## D9 — Shell spacing follows the prototype markup, not the README prose (M1)
Where the two disagree, the prototype's inline styles win (they are the tested layout): top bar
padding 40px 30px 16px (README: 20px 30px 0), content padding 8px 30px 40px with page banners
bleeding by −8px −30px (README: −24px), sidebar padding-top 35px (README: 22px). The top 32px of
the window left of the controls is the Tauri drag region, and the top bar is a drag region too.
The window itself has no CSS border or radius: Windows 11 draws them (D4).

## D10 — Navigation: return path in router state, back() is a navigation (M1)
Detail screens (app, channel, idea) receive `{ from: <path> }` as router location state. Storing
the full path (not just the section) restores Settings › Sources when returning from a channel
page. Like the prototype's `goBack = go(from)`, `back()` is a new navigation to that path, not a
history pop, so it shows the skeleton and clears the search like any navigation. The navigation
skeleton is skipped when "Subtle animations" is off (the prototype had a separate `skeletons`
flag). Browse keeps the prototype's two entries: the sidebar resets every filter; other entries
without a preset keep the filters and drop only the source filter.

## D11 — Download engine semantics (M1, mock)
- Pause applies to `downloading` items only; an item in the 8-tick `installing` hold finishes
  (the prototype's Pause all also froze the hold).
- Offline does not change item states: running items stay `downloading` and stop advancing, as in
  the prototype; the UI shows offline through `useOffline()`, not a `paused` event.
- `useInstallState` reports `paused` as its own state (the prototype showed it as downloading);
  `isBusy()` counts it as busy.
- The concurrency starts from the stored `settings.parallel`; the bridge follows later changes.

## D12 — Stricter service validation than the prototype (M1, mock)
Mock services reject with `ServiceError("invalid" | "notFound")` where the prototype accepted
anything: empty comments, release versions, sign-in email and profile fields; taking an idea that
is not open; removing the current device or an unknown one; a concurrency that is not an integer
≥ 1; pausing or acknowledging a channel that is not followed; subscribing to an unknown channel.
`openExternal` accepts only `https:` and `mailto:` (a bare host gets `https://`), so no `file:` or
custom protocol handler can be reached. The Rust commands must keep these rules.

## D13 — i18n conventions (M1)
- The English catalog is `as const`, so i18next types every key and interpolation variable (a
  wrong variable is a compile error). Side effect: `t()` returns the English literal type;
  annotate `: string` when one variable takes several strings.
- be/ru plurals use `_one/_few/_many/_other` from the prototype's `pl()`; `_other` (fractions)
  repeats `_few`. A key is plural in every language or in none, so en gained plurals for
  `ratingsCount`, `helpful`, `releasedMsg`, `releaseNote`, `subscribersCount`, `unreachableFor`,
  `staleTitle`.
- Every number inside a string is `{{x, number}}` (grouping per language); dates, sizes, prices
  (`narrowSymbol`, so be/ru show "$") and lists come preformatted from `useFormat()`.
- "Also in" lists channels with `Intl.ListFormat` ("Nilesoft and Winaero") where the prototype
  joined them with ", ".
- `sources.staleTitle` ends with a period in the catalog (the prototype appended it in markup).
- Labels may be joined with " · " (e.g. `NN% · Pause`, `version · date`); sentences never are.

## D14 — Token scoping and additions (M1)
Theme blocks in `tokens.css` use bare `[data-theme]` selectors so a subtree can switch theme (the
`/dev` gallery renders dark and light side by side). Added tokens for literals the handoff used
without naming: `--on-tint` (white text on tint tiles), `--knob` (switch knob), `--promo-ground`,
`--glow-peach` (hero / first-launch glow core), `--on-image-lead`, and the content padding parts
`--content-pad-top/-x/-bottom`. Hover and ground shades the handoff derived by eye are written as
`color-mix()` of existing tokens (needs Chromium 111+, which WebView2 has).

## D15 — Component judgement calls (M1)
- `Button` has two sizes beyond the README (`compact` 32px for card/row actions, `field` 38px for
  the channel page) and two variants (`primaryOnImage` on heroes, `link`).
- Text inputs show focus as the `--mint` border (README), every other control as the 2px ring.
- Busy or disabled row actions (Queued, Installing…, Updated just now, the current plan) keep full
  opacity in the tone colour, as in the prototype.
- `AppCard` uses the prototype's 48px icon on action cards (the README table says 44px); the Pro
  pill is pinned bottom-right only on the action-less link card.
- `Modal` renders in place (fixed) unless `portalTo` is given; `Popover` and `Menu` are absolutely
  positioned without a portal or collision detection, so their containers must not clip them.
- `PageBanner` lives in `components/` (the architecture first listed it under `app/`).

## D16 — Sidebar badges and avatar (M1)
The Ideas item shows the number of the user's own released ideas whose "Your idea became an app"
note is not dismissed (`domain/ideas.ts › releaseNotes`), as the prototype does; the developer
view shows none. The avatar shows the profile initials. The prototype's developer-view avatar
(the acting channel's monogram and tint) waits for M5, when the developer channel is exposed
through the services. Claiming the idea bonus only sets `giftUntil`; the Ideas screen (M5) must
also dismiss the notes it showed (the prototype marked them seen in the same action).

## D17 — Startup hydrates settings before the first render (M1)
`bootstrap()` loads the stored settings, applies theme and motion to `<html>` and switches i18n
before React renders, so there is no flash of the default theme or language and no race between
a hydrate and an early `update()`. Stores never touch the DOM; `app/documentSettings.ts` does.

## Rust core (M2–M3)

### D18 — Command surface
One `async` Tauri command per method of `services/contracts.ts`, named `<service>_<method>`
(`catalog_get_catalog`, `downloads_set_concurrency`, …); `async` because Tauri runs sync
commands on the main thread. The logic sits in a Tauri-free `services` layer
(`apps/desktop/src-tauri/src/services/`) that mirrors the TypeScript mocks and is unit-tested,
plus IPC tests on Tauri's mock runtime. Errors cross as `AppError` `{kind: notFound | invalid |
internal, message}`. `SettingsService` has no Rust side (settings stay in the UI store, STACK.md
decision 4).

### D19 — Download events and cadence
Events are named `download://progress` and `download://state` (as documented on the model
types); the bindings expose them as `events.downloadProgress` / `events.downloadState` with
`DownloadProgress` / `DownloadStateChange` payloads. The simulated transfer reports once per
prototype tick (110 ms ≈ 9 Hz — the prototype's timing wins over the "≥ 10 Hz" budget, which
`HttpTransfer` meets with a 100 ms cadence).

### D20 — Queue semantics = the TypeScript mock
Pause/resume only touch `downloading`/`paused` items; offline also freezes the 8-tick
"Installing…" hold (as in the prototype); cancel works in every state; any concurrency ≥ 1 is
accepted (0 → `invalid`). The engine starts at 2 parallel downloads and online — the UI pushes
`settings.parallel` and connectivity with `downloads_set_concurrency` / `downloads_set_online`
at startup. A finished item is recorded (inventory, activity dated today,
`usage.updatesInstalled + 1` when `request.kind` is `update`) before `installed` is emitted; if
recording fails the item ends `failed`.

### D21 — "Today" on the Rust side is the local clock
Not `fixtures/meta.json › today`. Renewals, the idea gift (today + `IDEA_BONUS_MONTHS`, where the
mock uses the fixed `meta.ideaBonusUntil`), activity and sync dates and outage days use the real
date — e.g. FOSS Friends (outage 2026-08-30) is already stale in the app. The seeded data itself
stays anchored at 2026-09-15.

### D22 — Persistence layout
One SQLite file, `app_data_dir()/paparats.db` (rusqlite, bundled, WAL, `PRAGMA user_version`
migrations): `installed`, `favorites`, `library_collections`, `activity` (newest first),
`channel_subscriptions` (in follow order), `channel_sync` (local "Sync now" dates, which
override the published `synced`), `ideas` and `account` (JSON rows; activity lives in its own
table), `meta`. The mock world is seeded once (meta `seeded`); later fixture edits do not reach an
existing database — delete it to reseed during development.

### D23 — HTTP transfer rules
HTTPS only (plain HTTP to loopback hosts, for tests); the host of the URL and of every redirect
must be on `paparats_core::hosts::Allowlist`; the manifest SHA-256 is mandatory; partial files
survive pause/offline for `Range` resume and are deleted on cancel or any failure. reqwest uses
`native-tls` (Schannel, no OpenSSL/aws-lc build) and `Response::chunk` instead of the `stream`
feature; `sha2` is 0.11, the version ed25519-dalek 3 already brings.

### D24 — Placeholders until M6/M7
`install_open` / `install_open_folder` do nothing yet; `channels_report` returns the routing
receipt without sending (the text is neither stored nor logged); sign-in accepts any password and
drops it; `system_check_for_app_update` keeps the prototype's 1.2 s and answers `upToDate`;
`catalog_get_platform` reports this binary's version in `about.version` (the build number still
comes from the data set until CI stamps one).

### D25 — Windows manifest embedded by the linker
`build.rs` embeds the Common-Controls v6 manifest (same content as tauri-build's default) with
`/MANIFEST:EMBED` for every target instead of tauri-build's resource, which only reaches `bins`:
test binaries on Tauri's mock runtime otherwise fail to load (`STATUS_ENTRYPOINT_NOT_FOUND`).
