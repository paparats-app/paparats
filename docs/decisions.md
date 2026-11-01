# Decisions

Product and engineering decisions taken where the handoff was silent or where we diverged from it.
Newest last. Each entry: context → decision → consequence.

Every entry that departs from the handoff says so and names the prototype or README behaviour it
replaces. D58 and D62 list what the parity pass restored and what it kept on purpose. D64 collects
the divergences from `STACK.md` that were still unrecorded at release. A superseded bullet stays
in place, marked with the entry that replaced it.

## Index

| # | Decision | Milestone | Later changes |
| --- | --- | --- | --- |
| [D1](#d1--toolchain-versions-m0) | Toolchain versions | M0 | |
| [D2](#d2--package-layout-m0) | Package layout | M0 | `export-bindings` became a Cargo example in M6 |
| [D3](#d3--mock-switch-m0) | Mock switch | M0 | |
| [D4](#d4--frameless-window-chrome-m0) | Frameless window chrome | M0 | |
| [D5](#d5--developer-mode-tools-replace-the-prototypes-demo-toolbar-m1) | Developer-mode tools replace the prototype's demo toolbar | M1 | |
| [D6](#d6--tauri-adapters-delegate-to-the-mock-services-until-their-commands-exist-m1) | Tauri adapters delegate to the mock services until their commands exist | M1 | superseded by D26 |
| [D7](#d7--updated-just-now-clears-when-leaving-updates-m1) | "Updated just now" clears when leaving Updates | M1 | |
| [D8](#d8--all-updates-installed-toast-only-ends-an-update-all-batch-m1) | "All updates installed" toast only ends an Update-all batch | M1 | |
| [D9](#d9--shell-spacing-follows-the-prototype-markup-not-the-readme-prose-m1) | Shell spacing follows the prototype markup, not the README prose | M1 | |
| [D10](#d10--navigation-return-path-in-router-state-back-is-a-navigation-m1) | Navigation: return path in router state, back() is a navigation | M1 | |
| [D11](#d11--download-engine-semantics-m1-mock) | Download engine semantics (mock) | M1 | |
| [D12](#d12--stricter-service-validation-than-the-prototype-m1-mock) | Stricter service validation than the prototype (mock) | M1 | |
| [D13](#d13--i18n-conventions-m1) | i18n conventions | M1 | |
| [D14](#d14--token-scoping-and-additions-m1) | Token scoping and additions | M1 | |
| [D15](#d15--component-judgement-calls-m1) | Component judgement calls | M1 | |
| [D16](#d16--sidebar-badges-and-avatar-m1) | Sidebar badges and avatar | M1 | avatar part closed by D46 |
| [D17](#d17--startup-hydrates-settings-before-the-first-render-m1) | Startup hydrates settings before the first render | M1 | |
| [D18](#d18--command-surface) | Command surface | M2–M3 (Rust core) | |
| [D19](#d19--download-events-and-cadence) | Download events and cadence | M2–M3 (Rust core) | |
| [D20](#d20--queue-semantics--the-typescript-mock) | Queue semantics = the TypeScript mock | M2–M3 (Rust core) | |
| [D21](#d21--today-on-the-rust-side-is-the-local-clock) | "Today" on the Rust side is the local clock | M2–M3 (Rust core) | |
| [D22](#d22--persistence-layout) | Persistence layout | M2–M3 (Rust core) | |
| [D23](#d23--http-transfer-rules) | HTTP transfer rules | M2–M3 (Rust core) | |
| [D24](#d24--placeholders-until-m6m7) | Placeholders until M6/M7 | M2–M3 (Rust core) | the update check replaced by the updater (D48) |
| [D25](#d25--windows-manifest-embedded-by-the-linker) | Windows manifest embedded by the linker | M2–M3 (Rust core) | |
| [D26](#d26--tauri-adapters-over-the-core-m2) | Tauri adapters over the core | M2 | |
| [D27](#d27--store-cards-one-connected-card-prototype-colours) | Store cards: one connected card, prototype colours | M2 | category chip: D58 |
| [D28](#d28--entries-into-browse-from-home) | Entries into Browse from Home | M2 | |
| [D29](#d29--browse-hero-call-to-action) | Browse hero call to action | M2 | |
| [D30](#d30--loading-and-missing-data) | Loading and missing data | M2 | |
| [D31](#d31--app-page-and-report-dialog-details) | App page and report dialog details | M2 | paused size, star, Send: D58 |
| [D32](#d32--accessibility-beyond-the-prototype) | Accessibility beyond the prototype | M2 | |
| [D33](#d33--library-banner-subtitle) | Library banner subtitle | M3 | |
| [D34](#d34--one-download-status-three-places) | One download status, three places | M3 | paused size: D58 |
| [D35](#d35--updates-screen) | Updates screen | M3 | |
| [D36](#d36--library-behaviour) | Library behaviour | M3 | menu animation, star: D58 |
| [D37](#d37--parity-fixes-at-integration-m3) | Parity fixes at integration | M3 | |
| [D38](#d38--subscription-and-the-plan-dialog) | Subscription and the plan dialog | M4 | plan pills: D58 |
| [D39](#d39--settings) | Settings | M4 | last section: D58; Sign in after sign-out: D61 |
| [D40](#d40--profile) | Profile | M4 | |
| [D41](#d41--parity-fixes-and-shared-changes-at-integration-m4) | Parity fixes and shared changes at integration | M4 | |
| [D42](#d42--settings--sources-and-the-channel-dialogs) | Settings › Sources and the channel dialogs | M5 | never-synced text: D58 |
| [D43](#d43--channel-page) | Channel page | M5 | glyphs: D59 |
| [D44](#d44--ideas-board-and-suggest-an-idea) | Ideas board and Suggest an idea | M5 | |
| [D45](#d45--idea-page-and-the-release-dialog) | Idea page and the release dialog | M5 | inert Release / Post: D58 |
| [D46](#d46--the-developer-channel-and-the-developer-view-avatar) | The developer channel and the developer-view avatar | M5 | |
| [D47](#d47--shared-pieces-and-parity-fixes-at-integration-m5) | Shared pieces and parity fixes at integration | M5 | |
| [D48](#d48--tray-start-on-login-single-instance-links-window-updater-signing) | Tray, start on login, single instance, links, window, updater, signing | M6 | `auth/callback`: D56 |
| [D49](#d49--keyboard-focus-disabled-and-loading-states-m6) | Keyboard, focus, disabled and loading states | M6 | inert buttons: D58 |
| [D50](#d50--the-first-launch-scene-and-onboarding) | The first-launch scene and onboarding | M6 | |
| [D51](#d51--reconciling-the-m6-changes) | Reconciling the M6 changes | M6 | |
| [D52](#d52--paparats_real-one-variable-read-once-wired-in-one-place) | `PAPARATS_REAL`: one variable, read once, wired in one place | M7 | |
| [D53](#d53--the-real-inventory-paparats_realinventory) | The real inventory (`PAPARATS_REAL=inventory`) | M7 | |
| [D54](#d54--signed-manifests-and-the-remote-catalog-paparats_realcatalog) | Signed manifests and the remote catalog (`PAPARATS_REAL=catalog`) | M7 | |
| [D55](#d55--real-installers-paparats_realinstall) | Real installers (`PAPARATS_REAL=install`) | M7 | |
| [D56](#d56--sign-in-in-the-browser-paparats_realaccount) | Sign-in in the browser (`PAPARATS_REAL=account`) | M7 | |
| [D57](#d57--integration-m7) | Integration | M7 | |
| [D58](#d58--parity-pass-the-prototypes-look-and-behaviour-restored) | Parity pass: the prototype's look and behaviour restored | M8 | |
| [D59](#d59--icon-glyph-parity) | Icon glyph parity | M8 | `layout-grid`: D62 |
| [D60](#d60--integration-m8-the-mock-world-off-the-startup-path-build-chunks) | Integration: the mock world off the startup path, build chunks | M8 | |
| [D61](#d61--functional-acceptance-focus-rescue-sign-in-after-sign-out-row-icon-tiles) | Functional acceptance: focus rescue, Sign in after sign-out, row icon tiles | M8 | |
| [D62](#d62--visual-acceptance-method-fixes-differences-kept) | Visual acceptance: method, fixes, differences kept | M8 | |
| [D63](#d63--one-native-resize-listener-for-the-window-controls-m9) | One native resize listener for the window controls | M9 | |
| [D64](#d64--divergences-from-stackmd-found-at-release) | Divergences from `STACK.md` found at release | Release | |
| [D65](#d65--fictional-developers-in-the-demo-world) | Fictional developers in the demo world | Publication | |
| [D66](#d66--releases-from-tags-and-the-clients-own-update) | Releases from tags and the client's own update | Publication | |

## D1 — Toolchain versions (M0)
Tauri 2.11, React 19.1, TypeScript 6.0, Vite 8, ESLint 10, Vitest 5, react-router 8, i18next 26,
Zustand 5, TanStack Query 5, lucide-react 1.x. tauri-specta and specta are pinned to the same
release candidate (`=2.0.0-rc.25`) because the RCs are not semver-compatible with each other.

## D2 — Package layout (M0)
The repository root is both the pnpm workspace and the Cargo workspace. The Tauri crate is named
`paparats-desktop` (lib `paparats_desktop_lib`); the bindings exporter is a second binary
(`export-bindings`) so `pnpm specta` does not need to start the app. **Changed in M6:**
`export-bindings` is a Cargo example (`src-tauri/examples/export_bindings.rs`), so the installer
carries one executable; `pnpm specta` and `pnpm specta:check` run it with `--example`.

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
**Superseded in M2 by D26:** the Rust core branch landed every command at once, so no adapter
delegates to the mock any more.

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
- "Also in" lists channels with `Intl.ListFormat` ("Kvetka and Vitrazh") where the prototype
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

### D26 — Tauri adapters over the core (M2)
- Every `services/tauri/*` method calls its command through `unwrap(commands.x(…))`; there is no
  mock instance in Tauri mode (D6 is superseded). A rejection that is not an `AppError` — Tauri
  answers arguments that do not deserialize, unknown commands and denied permissions with a plain
  string — becomes `ServiceError("internal")`.
- `DownloadService.subscribe` listens to `download://progress` / `download://state` and maps them
  onto `DownloadEvent`; `getSnapshot()` first waits for pending listener registrations, so the
  downloads bridge (subscribe, then snapshot) cannot miss an event that follows the snapshot.
  `setConcurrency` rejects a non-integer or a value below 1 with `invalid` before invoking, like
  the mock; the command takes a `u32` and runs values above 255 at 255 at a time, so any whole
  number ≥ 1 is accepted as D20 says.
- `SystemService.today()` stays synchronous: it returns the core's `system_today` answer for the
  local day it was asked on and asks again when the local date changes; until the answer arrives
  (or if the call fails) the local date stands in — both read the same Windows clock (D21).
  `setAutostart` has no Rust side yet and resolves without doing anything, like the mock.
- Settings persist through `tauri-plugin-store` in `app_data_dir()/settings.json`, one key per
  changed setting, saved explicitly before `updateSettings` resolves (no auto-save debounce). Reads
  merge the file over `DEFAULT_SETTINGS` with the mock's sanitising rules (unknown keys and values
  of the wrong type are ignored — the file is user-editable). Calls are serialised; a failed save
  reloads the store from disk so a later read cannot return the rejected change. Settings stored
  in WebView2 `localStorage` by M1 builds are not migrated (there were no users).

## Discovery screens (M2)

### D27 — Store cards: one connected card, prototype colours
- Every store grid card (Home, Browse, Categories, search, the app page's "More in"; the channel
  page next) is `screens/shared › StoreAppCard`: `useAppAction()` for the action, category and
  source-channel chips (off on Categories › "Featured in …", as in the prototype), and a
  `chevron-down` "Details" part (the prototype's glyph on every store card; `SplitButton` draws
  it at 14 px, the app page's star at 16 px, both at stroke 2). Screens keep no local copies.
- `useAppAction().tone` is `quiet` (`--text2`) for Queued and `muted` (`--text3`) for Offline,
  as the prototype's `actColor`; M1 had both muted.
- Store cards show download progress only in the action label (`43% · Pause`), never as the 2 px
  bar: the prototype's store cards have none. The app page shows the 4 px bar and status line.
- Category chips truncate with an ellipsis where the prototype let a long label ("Development",
  "Продуктивность") run past the card's text column (**superseded by D58**: they wrap and overflow
  as there). A wrapped channel chip keeps the prototype's 4 px indent.
- Editorial lists (featured, notable, collections, "More in", search suggestions) skip apps that
  are not visible (`domain/apps.ts › pickByIds`, the prototype's `byIds`). A Browse hero whose
  app is hidden is skipped; the prototype showed an empty slide. "Try one of these" is hidden
  when no featured app is visible.

### D28 — Entries into Browse from Home
Home's "See all" links and the hero's "Explore apps" open Browse with every filter reset
(`{to:'browse', filters:{}}`, like the sidebar); the prototype's `go('browse')` kept earlier
filters, so "See all" under Featured apps could open a filtered list. Browse's own "See all"
links apply their sort (A–Z, Newest), the Collections cards their collection, Categories tiles
their category — each resetting the other filters (D10's preset rule).

### D29 — Browse hero call to action
"Get <App>" runs the app's action (download, subscribe/trust flow, or the offline notice) while
the app has no install state; once it is installed, updatable or in the download queue, the
button opens the app page (the prototype always opened the app page). A button labelled
"Get Obsidian" therefore never pauses a download or launches the app.

### D30 — Loading and missing data
- Home and the app page render nothing until the catalog (Home: also library and channels) has
  loaded; the 420 ms navigation skeleton covers it, so no card shows a wrong action for a frame.
- Search shows its skeleton and "Searching…" while the catalog, library or channels are still
  loading, not only for 340 ms after a keystroke, so "Nothing found" never flashes. Offline wins.
- An unknown `/app/:appId` shows "App not found" with Back; the prototype fell back to the first
  app. There is no catalog error state yet (the handoff has no copy for one).

### D31 — App page and report dialog details
- The status line reads "Downloading… 43% · 12 MB of 87 MB", "Paused · 43%" (README; the
  prototype also appended the size while paused), "Queued", "Installing…". **Superseded by D58**
  (paused keeps the size).
- The favourite star shows its pressed state (`aria-pressed`, `--mint2`); the prototype never
  showed it (**superseded by D58**: `--text2` in both states). The average rating is formatted per
  language ("4,4" in ru/be).
- The Pro card's button is "Learn more" → Subscription (the prototype's copy).
- Report a problem: Send is disabled while the text is blank (**superseded by D58**: always
  enabled) and the text is trimmed; if sending fails the dialog keeps the text and shows no toast (no failure copy in the handoff). The
  receipt is toasted: "Sent to <Channel> · copy to Paparats" or "Sent to Paparats".

### D32 — Accessibility beyond the prototype
Text links shorter than 32 px ("See all", "Clear all", "Categories →", Back, Cancel, the header
channel chip, "N ideas for this app") get an invisible `::before` hit area of at least 32 px
without moving the layout; they also get the focus ring and the 1 px pressed nudge the M1
components have. Card grids are named `ul`/`li` lists or `section`s labelled by their heading;
result counts are `role="status"`, so a changed count is announced. The page has no favicon
(`<link rel="icon" href="data:,">`): the window icon is native, and WebView2 no longer logs a
`/favicon.ico` 404.

## Library, Updates, download engine (M3)

### D33 — Library banner subtitle
The prototype's markup shows the tagline "Your apps, all in one place." (`t.librarySub`); its
logic computes "14 apps installed" (`libSubtitle`) but never renders it. The markup wins
(strict parity): the banner shows `library.librarySub`. The count is on the Installed tab and in
Library stats; `library.installedCount` stays in the catalogs, unused.

### D34 — One download status, three places
`screens/shared › useDownloadStatus` (pure `downloadStatus()`) builds what a queued app says
about its download, for the app page, the Updates rows and the Library rows and grid cards:
- `line`: "Downloading… 43%", "Paused · 43%", "Queued", "Installing…" (the prototype's `dlLine`);
- `size`: "12 MB of 87 MB" while downloading or paused, from the queued item's size (an update
  downloads its manifest's size), else the full install size (the prototype's `dlSize`);
- `text`, the one-line form: "Downloading… 43% · 12 MB of 87 MB"; every other state is `line`.
The app page and the Updates rows use `text`, so a paused one-line status drops the size (README;
D31 — the prototype kept it; **superseded by D58**: `text` keeps it). The Library row keeps the prototype's two lines: `line` on top and
`size` under it, also while paused. Row and card actions keep the prototype's `card()` labels
(`43% · Pause`, Resume, Queued, Installing… in `--mint2`), not the README's "Installing… NN%".

### D35 — Updates screen
- Rows: every pending update plus the apps marked "Updated just now", in catalog order; a row
  goes when the app is uninstalled or its source channel is switched off or unreachable (the
  prototype's `updateRows`). "Updated just now" rows show the new version and a disabled
  `--text2` button.
- The batch line follows the prototype's markup: "Updating X of N" on the left, where X counts
  the items that already landed (so a batch starts at "Updating 0 of 6"), and the percentage on
  the right, above the 6 px bar (the README wrote "Updating 2 of 5 · 43 %"). Update all is hidden
  while a batch runs, while offline and with nothing to update.
- The toast is `updates.allUpdated` "All updates installed" (README §4, D8), not v2's "All apps
  updated".
- Release notes fall back to the catalog's generic notes when an app has no update manifest (the
  prototype showed an empty list; every fixture app has one).
- The screen renders nothing until the catalog, library and channels have loaded, so "Everything
  is up to date" never flashes (like D30).
- "Updated just now" is cleared by `useNav().go()` when leaving `/updates` (D7) and also when the
  screen unmounts (any other way out). The unmount clear waits one microtask so React's dev-only
  StrictMode remount keeps the markers of a screen that is still open. An update that lands while
  another screen is open still shows "Updated just now" when Updates is opened next.
- Update history lists `activity` entries of kind `updated` for visible apps, newest first (the
  prototype's `history`); activity for an app that is neither installed nor offered by a followed
  channel is skipped.

### D36 — Library behaviour
- The Collections tab pill counts the collections with their own app list (3; "All apps" is every
  installed app), as the prototype; Library stats count every collection (4).
- Clicking the tab that is already selected resets it, as the prototype's `pick`: Installed drops
  the quick filter, Collections closes the open collection (`Tabs.onReselect`).
- The "Updates available" quick filter counts `useUpdates().count` (the prototype's
  `updatesCount`) but lists installed apps in state `update`; the two differ only while a source
  channel is paused or unreachable.
- Uninstall toasts "<App> uninstalled" and clears the app's "Updated just now" marker after the
  service resolves; a failure shows nothing (no failure copy). An app still in the download queue
  is not cancelled (prototype), so it comes back when the download lands.
- "Open install folder" calls `install.openInstallFolder` (a no-op on the Rust side for
  now, D24); the prototype only closed the menu.
- The + button and the "New collection" row are focusable and do nothing: creating collections
  is not designed yet (prototype).
- A Collections tab with no collections at all shows "Nothing found" (the prototype would show an
  empty grid; the fixtures always have collections).
- The ⋯ menu keeps the M1 pop-in animation; the grid card's favourite button keeps its pressed
  state (mint, `aria-pressed`), like the app page's star (D31). The prototype showed neither.
  **Superseded by D58** (no animation, `--text2` in both states).

### D37 — Parity fixes at integration (M3)
- Library and Updates row names, and the Updates version line, wrap in a narrow window as the
  prototype's markup does; M1 had truncated them with an ellipsis. At the default 1440 px window
  nothing wraps, so the layout is unchanged there.
- `PromoCard` text is `--on-image-strong` (#f2f4f2, both prototype cards); M1 used `--on-image`.
- The on-image `ProgressBar` track is white at 14 % (`--on-image-bright`), the prototype's
  `rgba(255,255,255,.14)`; M1 mixed `--on-image`.
- The 30 px `SegmentedControl` options (Settings › Theme, the Library list/grid toggle) get an
  invisible 32 px hit area reaching into the track's padding (D32); nothing moves.

## Account surfaces (M4)

### D38 — Subscription and the plan dialog
- A plan card shows either its promo pill ("Most popular", "Save 18%") or, on the plan in effect,
  "Current plan" (README §6: "… or 'Current plan'"). The prototype rendered both in the Pro state;
  the second pill ran out of the monthly card, was clipped by the yearly one and wrapped the plan
  name. So in the Pro state our cards are 8–18 px shorter than the prototype's; the Free state is
  identical. The `/dev` gallery follows the same rule. **Superseded by D58** (both pills).
- The confirmation names the charge and the renewal date: today + 1 month or 1 year, clamped to
  the month's last day (31 January → 28 February), formatted per language. The status cards show
  the account's `renewsOn`, which the core computes from the same local today (D21), so the two
  agree (the prototype hard-coded 2026-10-15 / 2027-09-15).
- Confirm is disabled until the plans have loaded, shows a spinner while buying and ignores
  repeated clicks; a failed purchase keeps the dialog open without a toast, and a failed cancel
  leaves the plan as it was (no failure copy in the handoff).
- As in the prototype: "Cancel plan" (Free card) cancels at once, without a confirmation or a
  toast; "Learn more" opens Settings › About (`goAbout`); the idea gift shows "Paparats Pro · gift"
  both as the plan name and on the price line (`proStatus.price = t.proGift`).
- The ecosystem numbers use `format.plus` ("10 000+" in ru/be); the prototype showed "10,000+" in
  every language (D13).
- One view of the plan in effect, `screens/shared › useProStatusView()`, feeds the banner status
  chip, the Subscription status card and the Profile Pro card; the sidebar Pro pill reads
  `usePro()`. The banner chip's mint text and ground are the on-image tokens `--on-image-mint` and
  `--on-image-mint-ground` (prototype line 684).
- Subscription and Profile render nothing until their queries have loaded (like D30), so no plan
  state or count changes a frame later.

### D39 — Settings
- Picking a section replaces the route (`/settings/<id>`) without `go()`: no skeleton, enter
  animation or scroll reset, like the prototype's `setState({section})`. `/settings` always opens
  General; the prototype remembered the last section across navigation (**superseded by D58**:
  Settings from the sidebar reopens the last section).
- The section nav shows `--hover` on hover even on the active item, and the link rows (Profile,
  Subscription, Component gallery) have no hover ground: both are the prototype's styles (its
  hover styles are `!important`). The app sidebar keeps its own active ground on hover.
- Kept as no-ops, as in the prototype: Downloads › Install location › "Change…" (no folder
  picker yet) and Advanced › Network proxy › "Configure…".
- Privacy › Clear calls `clearSearchHistory()` and toasts "Search history cleared" once it
  resolves (the prototype toasted at once); a failure shows nothing. Search history is not stored
  yet on either side.
- Account › Sign out (a no-op in the prototype) calls `account.signOut()`, toasts "Signed out" and
  the row then reads "Not signed in" with the button disabled. Nothing else reacts: the prototype
  has no signed-out state, and signing in again arrives with first launch (M6) and PKCE (M7). In
  the real app the signed-out flag persists in `paparats.db`; until M6, reseed the data set (D22)
  to sign back in.
- Start on Windows login also calls `system.setAutostart(value)` (a no-op on both sides until
  tauri-plugin-autostart lands) and switches back if it rejects.
- Parallel downloads stores a number (`1 | 2 | 4`); the downloads bridge passes it to
  `DownloadService.setConcurrency` at once, so a running queue grows or shrinks live.
- Settings › About:
  - Check for updates ignores clicks while "Checking…" (the prototype restarted its 1.2 s timer).
    A newer version toasts "Version X is available" and replaces "You're up to date!" under the
    version; a failed check returns quietly.
  - Website, Documentation, Get support, Report an issue and the footer's Terms of Service /
    Privacy Policy / Licenses open in the default browser through `system.openExternal`
    (`href="#"` in the prototype). The addresses are placeholders on `https://paparats.app/`
    (`/`, `/docs`, `/support`, `/issues`, `/terms`, `/privacy`, `/licenses`) until the site
    exists; middle-click is blocked so no link opens inside the WebView.
  - The version line joins labels like the prototype's `versionLine` (D13); "Paparats" is an
    `<h2>` (a div in the prototype) so the panel has a heading.
- Advanced › Replay first launch only bumps `useFirstLaunchStore.replayRequested`; the M6 scene
  plays when it changes.

### D40 — Profile
- Devices › Remove calls `account.removeDevice` (no handler in the prototype); no toast (no copy);
  on a failure the row stays. The Security › Active sessions hint counts the devices still signed
  in (`profile.sessionsHint` became a plural key): the prototype's fixed "2 devices signed in." is
  the same string for its two devices, but went stale after a removal.
- Focusable no-ops, as in the prototype: the camera badge (Change photo), Password › Change…,
  Sign out everywhere, Export… and Delete… (never destructive).
- Save with a blank name or email shows "Enter your name" / "Enter your email" under the field
  and does not call the service (the service rejects blank values, D12); the message goes when
  that field is edited. Any other failed save keeps the form open without a toast.
- Keyboard focus follows the header's mode switch (Enter/Space on Edit profile or an Account row →
  the Name field; Save/Cancel → back to Edit profile). Mouse clicks move no focus, which keeps the
  prototype's look (the input's focus border).
- The two-factor switch shows the requested value until the account carries it; on a failure it
  reverts.
- The tab, edit mode and draft live in `useProfileStore` and survive navigation, like the
  prototype's `profileTab` / `editing` / `draft`.
- Profile tab labels may wrap (ru "Данные и приватность" wraps as in the prototype; `Tabs` keeps
  `nowrap` elsewhere).
- Recent activity lists the five newest entries whose app is visible; the activity grows with
  every install and update (the prototype showed five static entries). Updates installed reads
  `account.usage.updatesInstalled`.
- Accessible names added: the tab list is "Profile sections", the camera badge "Change photo".

### D41 — Parity fixes and shared changes at integration (M4)
- `--font-mono` lists Consolas first, the prototype's stack (lines 781, 1129): the install path
  now measures 178.69 px, as in the prototype (190.4 px with Cascadia Mono first).
- Component fixes found by the screen comparisons, all per the prototype markup: `BenefitStrip`
  cells are blocks with an inline 26 px glyph (5.5 px taller); the `SubscriptionPlan` button has a
  1 px `--line2` border on every variant and weight 600, and the mint one keeps `--mint` on hover;
  the link `AppCard` (Pro apps) wraps its note instead of clamping it to 2 lines and draws its
  44 px tile at radius 10 without monogram tracking; the `StatTile` tile icon is inline (values
  5.6 px lower); `ProfileHeader` inputs render 40 px at radius 8 and Save/Cancel have 18 px
  padding.
- Additive component props: `SettingsRow` `disabled` (action rows) and
  `selectedMark: 'check' | 'code'` (language rows; Profile keeps the ISO code on the selected
  option, prototype line 915); `ProfileHeader` `editButtonRef` / `nameInputRef` (keyboard focus
  without DOM queries).
- `useProfileStore` and `useFirstLaunchStore` live in `stores/` and are reset by the test
  `resetStores()` like every other store.
- The top bar's avatar keeps Onest. The prototype's avatar `<button>` has no `font: inherit`, so
  its initials render in Chrome's default Arial; the caps sit within ≈ 0.6 px of the prototype's.
- `subscription.testimonialBy` carries the dash ("— A happy user"), which the prototype's markup
  prepended (like `sources.staleTitle`'s period, D13).

## Channels and Ideas (M5)

### D42 — Settings › Sources and the channel dialogs
- The trust confirmation's button reads "Add channel" (`sources.addChannel`, prototype line 1512),
  not "Confirm" as the README wrote.
- A followed channel that never synced shows "Not synced yet" (`sources.neverSynced`, README); the
  prototype left the sync text empty (e.g. Vitrazh right after subscribing). **Superseded by D58**
  (empty, as in the prototype).
- The trust confirmation opened from Add channel is rendered inside `AddChannelDialog`, which hides
  its own modal meanwhile and keeps its state (the prototype's `hasChannelDialog = chDialog &&
  !chPending`): Cancel or Escape return to it with the address still typed and focus in the field
  (`cancelTrust`); confirming closes both. `useDialogStore` keeps `{kind:'addChannel'}` while it
  shows. `{kind:'trustConfirm', channelId}` opened from a card's or the channel page's Subscribe
  stands alone; Cancel just closes it.
- Lookup accepts the full address (scheme, `www.`, case and a trailing `/` ignored), the host, the
  `@handle` or the bare handle. A blank address or a bare `https://` does nothing. The two inline
  errors are one catalog string each (`sources.notFoundError`, `sources.alreadySubscribed`; no
  `notFound + '. ' + notFoundHint` join, D13 — the old keys stay as keymap targets); typing clears
  them. A lookup call that fails shows nothing.
- Toasts, and closing a dialog, happen after the service resolves; a failed call shows nothing and
  keeps the dialog (no failure copy, D38–D40). The prototype toasted at once. The pause switches
  (Sources rows and the channel page's Enabled/Paused) show the requested state at once and revert
  if the call fails.
- `useBrowseStore.dropSource` runs on pause, on resume (the prototype's `toggleChannel` filtered
  `fSources` both ways) and on unsubscribe.
- Unsubscribing removes the whole subscription, including `staleAcknowledged`: re-following a
  channel that is still unreachable shows the stale callout again (the prototype kept `staleAck`
  across unsubscribing).
- The address field is the shared `Field` around the dialog's own `<input>`: `TextField` cannot
  put Add beside the input with the message spanning the row, has a hover border the prototype's
  input lacks, and its inner `Field` would override the outer `aria-invalid`/`aria-describedby`.
  With an error the border is `--danger`; the mint focus border wins while focused (prototype
  `style-focus`).
- Both dialogs, and the Sources list card, render nothing until channels and the catalog have
  loaded, so no "0 channels" / "0 apps" flashes (like D30). The header and the trust-level cards
  render at once.
- The modal body scrolls as a whole when the column is shorter than the dialog; the prototype
  scrolled only the catalog list. A backdrop click closes (the shared `Modal` default); the
  prototype's backdrops had no handler. Repeated Add / Subscribe / confirm clicks while a call is
  in flight are ignored, with no spinner (the prototype has none).
- The trust-level cards are a list labelled by the "Trust levels" overline (D32); visually the
  prototype's divs.

### D43 — Channel page
- An unknown channel id shows "Channel not found" with Back (`EmptyState`, rss icon; like D30);
  the prototype fell back to the first channel.
- Copy address copies `channel.addr` exactly as the Address row shows it (`kvetka.example/paparats`,
  no scheme), which the add-channel lookup accepts. "Address copied" is toasted after the
  clipboard write resolves; a failed write shows nothing. The browser Clipboard API needs the
  window focused (a click gives it focus).
- Every toast (subscribe, unsubscribe, pause/resume, sync, copy) follows the service result (D42).
  Sync now: "Channel synced" and Last sync → today, or "<Channel> is still unreachable".
- Only a followed channel reports an outage (the prototype's `down = isSub ? downDays(c) : 0`).
  The stale callout stays while the channel is down; Keep and Unsubscribe show only while it is
  stale and not kept. Last sync reads the outage date, then the synced date, then "Not synced yet".
- An empty Support value shows `channel.notProvided` ("—"), the prototype's `c.support || '—'`.
- The apps grid uses `StoreAppCard` with `channelChip={false}` (category chip only, line 1166);
  the header badge is `TrustBadge` `size="lg"` `iconSize={12}` (line 1126).
- Accessibility additions with no visual change: the Details overline is an `<h2>` naming the
  `<aside>`, its rows a `<dl>`; Enabled/Paused is `role="switch"`; the `·` separators are
  `aria-hidden`; the apps grid is a list named by its heading.
- lucide `info` and `rotate-ccw` differ slightly from the prototype's hand-drawn info and sync
  glyphs (superseded by D59: both now draw the prototype's glyphs).

### D44 — Ideas board and Suggest an idea
- The status chips and the numbered "How it works" circles are local to `screens/ideas` (only
  Ideas uses them), so no shared `ToggleChip` was added (M1 note closed).
- Tabs follow the view (user: All / New apps / Existing apps / My ideas; developer: All / New
  apps / For my apps / My work); a stored tab the view lacks falls back to All.
- Take (developer view, only on ideas `canTake` allows) pins the idea to the developer channel and
  toasts "Pinned to Kvetka · author notified" (`screens/shared › useTakeIdea`, shared with the
  idea page); a refusal (someone took it first) changes nothing.
- Activate 3 months of Pro claims the thank-you, then dismisses every release note on screen (the
  prototype marked them seen, D16) and toasts "Paparats Pro is active until <date>" with the
  account's returned `giftUntil` (mock `meta.ideaBonusUntil`, Rust today + 3 months, D21), not the
  prototype's constant. Repeated presses while it runs are ignored. "Bonus claimed" (hides the
  Your ideas rail) is `subscription.giftUntil !== null`; the prototype had a separate flag.
- A released idea whose app is not in the catalog: the note hides "Open <App>" and draws a mint
  tile; the card hides its developer line (the prototype drew an inert "Open " and an empty line).
  Never happens with the fixtures.
- Suggest an idea:
  - "Which app?" lists the visible apps A–Z; from an app page whose channel is not followed (mpv)
    that app is added and selected (the prototype showed the first option while publishing for
    the hidden app). From the board the default is the first catalog app among the options
    (Obsidian, the prototype's `D.apps[0]`), not the first A–Z.
  - The title gets focus on open, Enter submits (a form; Publish is `type=submit`), and Publish
    shows the shared spinner while the call runs (like ReportDialog). A title under 6 characters
    after trimming, or a service `invalid` rejection, shows `ideas.ideaTitleShort`; any edit
    clears it. Any other failure keeps the dialog and the text.
  - Publishing puts the idea on top as mine/Open with the author's vote, opens its page and toasts.
- Accessibility additions with no visual change: the status chips are toggle buttons
  (`aria-pressed`) in a group named "Filter by status"; the sort select is "Sort by"; the 28 px app
  filter chip has `aria-description` "Remove filter" and a 34 px hit area; the Your ideas rows are
  buttons; the aside cards and the note are sections named by their `<h2>`.

### D45 — Idea page and the release dialog
- An unknown idea id shows "Idea not found" with Back (`EmptyState`, lightbulb; like D30); the
  prototype fell back to the first idea.
- Release is disabled while the version is blank or no app is chosen (the service rejects blank
  versions, D12); the prototype accepted anything (**superseded by D58**: inert, not disabled).
  The version is prefilled with the app's next patch version and recomputed when another app is
  picked (a typed version is dropped, as in the prototype); Release trims it. A failed release
  keeps the dialog without a toast.
- The release dialog renders nothing until ideas, catalog, channels and account have loaded (so
  the prefill is never "1.0.0" with an empty picker); an unknown `ideaId` closes it.
- Take, Post and Release ignore repeated clicks while their call runs, without a spinner; a failed
  comment keeps its text. Post stays disabled while the text is blank (existing `CommentThread`
  behaviour; the prototype's button was clickable and did nothing) and keeps full opacity
  (**superseded by D58**: inert, not disabled).
- In the developer view comments go out as the channel (author = the channel's author, Developer
  badge, the channel monogram in the composer); the user's own comments read "You" in the user
  view and the profile name in the developer view (prototype line 2086).
- "Version 1.9.15" joins `common.version` and the version (D13, like About); the released hint
  passes "<App> <version>" as `{{app}}`, as the prototype's `relName`.
- Accessibility additions: the discussion is a region named by its heading, the timeline an `<ol>`
  named "Progress"; Open is named "Open <App>" and gets a 32 px hit area (the prototype's button
  is 30 px). The 36 px app tiles drop `AppIcon`'s monogram tracking (the prototype has none).

### D46 — The developer channel and the developer-view avatar
- No service exposes the catalog meta yet, so the channel the developer view acts as is
  `hooks/useDeveloperChannel › DEVELOPER_CHANNEL_ID` (`kvetka`), in one place; it mirrors
  `fixtures/meta.json › developerChannel` and paparats-catalog's embedded `developer_channel`.
  Its apps are `domain/ideas › myApps` once the channel is loaded (until then only the apps
  published on the channel itself).
- In the developer view the top bar avatar shows that channel's monogram on its tint with
  `--on-tint` text (the prototype's `avatarText` / `avatarBg` / `avatarColor`); the user view keeps
  the profile initials. This closes the avatar part of D16.

### D47 — Shared pieces and parity fixes at integration (M5)
- One implementation per flow: `hooks/useChannelFollow` (follow with the community confirmation,
  subscribe, unsubscribe, pause, keep — toasts and `dropSource`) serves Settings › Sources, both
  channel dialogs, the channel page and `useAppAction`'s Subscribe. The channel labels
  (`KIND_KEY`, `HOST_KEY`, `TRUST_LEVELS`), `channelIcon` and `useChannelMeta` live in
  `screens/shared/channels.ts`; the trust level names are `components/TrustBadge › TRUST_KEY`
  (`ChannelRow` uses it too). `useIdeaView` (board, idea page, release dialog) and `useTakeIdea`
  (board and idea page) moved to `screens/shared`, and the app, channel and idea pages share
  `screens/shared › BackLink`. `app/dialogs` import only `screens/shared`, not another screen.
- Additive component props: `StoreAppCard.channelChip` (default true), `TrustBadge.iconSize`
  (default 11).
- Component parity fixes, each per the prototype markup: `WarnCallout` actions are 12 px apart at
  the default size (Sources, line 847) and 8 px at `md` (channel page, line 1149), and its 30 px
  buttons get an invisible 32 px hit area; the catalog `ChannelRow` name uses line-height 1.4
  (line 1392); the × of form-layout dialogs is radius 8 (lines 1373, 1423); the `CommentThread`
  Post button has 16 px sides, no border and a 1.1 brightness hover (line 1342); the `IdeaCard`
  Take button (30 px, line 1231) gets a 32 px hit area.
- Token `--r-17` for the developer-view pill (34 px high, prototype line 1190).
- New catalog keys, none with variables: `sources.notFoundError`; `channel.notFound`,
  `channel.notFoundHint`, `channel.notProvided`; `ideas.dismissNote`, `ideas.statusFilter`,
  `ideas.removeFilter`, `ideas.filtersLabel` (keeps the prototype's colon), `ideas.ideaKind`;
  `idea.progress`, `idea.notFound`, `idea.notFoundHint`.

## Windows integration (M6)

### D48 — Tray, start on login, single instance, links, window, updater, signing
- **Native shell** (`src-tauri/src/shell.rs`, `window.rs`, `tray.rs`, `deep_link.rs`,
  `autostart.rs`): the decisions live in a Tauri-free `Shell` (unit-tested with a recording host);
  the UI talks to it through four commands that are not service methods, `shell_set_locale`,
  `shell_set_minimize_to_tray`, `shell_window_ready`, `shell_take_deep_links`, and two typed events,
  `shell://deep-link` and `shell://tray-action`. On the UI side `platform/shell.ts › nativeShell`
  wraps them (no-ops outside Tauri, also active with `PAPARATS_MOCK=1`); `app/useNativeShell`
  (providers) pushes the language and the tray setting at startup and on change and reports the
  first frame; `app/useDeepLinks` and `app/useTrayActions` (layout) navigate.
- **Tray**: always shown; the app icon, tooltip "Paparats", menu Open Paparats · Check for updates ·
  (separator) · Quit; a left click shows and focuses the window. The menu is native and exists
  before the UI loads, so its labels are Rust (`TrayLabels::for_locale`, en/be/ru); before the UI
  reports its language the core reads `locale` from `settings.json`. "Check for updates" is the
  About button's copy (a test compares it with `about.checkUpdates`). Tray › Check for updates shows
  the window, opens Settings › About and runs the same check with the same toasts; the About
  button's own "Checking…" state does not reflect a check started from the tray.
- **Minimize to system tray** (`settings.tray`, default on): the close button and Alt+F4 (both
  `CloseRequested`) hide the window; Quit in the tray exits. Minimise stays a taskbar minimise. The
  core reads the stored value at startup, then follows the UI.
- **Start on login**: tauri-plugin-autostart, value `Paparats` under `HKCU\…\Run` =
  `<exe> --minimized` (the NSIS uninstaller removes the same value); `--minimized` starts hidden in
  the tray. The Settings toggle → `SystemService.setAutostart` → the JS plugin, only when the entry
  differs (the plugin fails to disable a missing entry). At startup, in release builds only, the
  core brings the entry in line with the stored `startup`: missing (fresh install — the default is
  on) or pointing at another executable → registered; `startup` off → removed; an entry turned off
  in Task Manager is left alone. Development builds never register themselves at startup.
- **Single instance**: a second launch forwards its arguments and exits; the running window comes
  forward (not for a second `--minimized` launch); a `paparats://` argument goes through the
  deep-link plugin.
- **Links**: scheme `paparats` (`plugins.deep-link.desktop.schemes`), registered by the NSIS
  installer and, in debug builds, at runtime (`register_all` points `HKCU\Software\Classes\paparats`
  at the dev executable). Parsed in Rust: `app/<id>` and `channel/<id>` (ids: ASCII letters,
  digits, `._-`, start alphanumeric, ≤ 64, lowercased; one segment; query/fragment ignored) open
  that page — `go()` with the current page as the return path, any open dialog closed, the window
  shown; `auth/callback` is recognised and ignored until PKCE (M7), never logged with its query;
  anything else is ignored. Links wait in the core (at most 8) until the UI has listened and taken
  them, so the link that started the app is not lost; later ones arrive as events.
- **Window**: created hidden (`visible: false`) on `backgroundColor` = the dark `--bg`; the core
  switches to the light `--bg` before anything shows when the stored theme is light (or System on a
  light Windows). The UI reports its first frame (two animation frames, or 120 ms — WebView2 may not
  run frames for a hidden window) and the core shows and focuses it; 5 s without that report shows
  it anyway. window-state saves size, position and maximized; size and position are restored while
  hidden, maximized when the window is first shown (tao 0.35 shows a hidden window it maximizes), and
  a session that never showed the window keeps the saved maximized state on exit. First run: centred
  1440×920, or maximized when that does not fit the monitor's work area. Snap Layouts: D4 stands.
- **Capabilities**: an app manifest (`build.rs` + `src/app_commands.rs`) gives every app command an
  `allow-<command>` permission, and `capabilities/default.json` grants exactly those plus the
  single plugin commands the UI calls (events, the six window-chrome commands, `resources:close`,
  opener open-url with its default URL scope, five store commands, autostart, `updater:check`); no
  `*:default` sets. Tests keep `bindings.ts`, `app_commands.rs` and the capability in sync.
  Dropped as unused: `core:window:allow-theme`, `window-state:default`, the opener's
  reveal-in-folder.
- **Updater**: tauri-plugin-updater (native-tls like D23, no zip), endpoint
  `https://updates.paparats.app/latest.json` (first-party, `paparats-core::hosts`; a test checks
  every endpoint). `SystemService.checkForAppUpdate` in Tauri mode is the JS `check()` (15 s
  timeout), never before 1.2 s, and any failure reads as up to date; the core's placeholder command
  `system_check_for_app_update` (D24) is gone. Nothing downloads or installs an update yet.
  `plugins.updater.pubkey` is a marked placeholder: generate the real pair with
  `pnpm tauri signer generate -w ~/.tauri/paparats-updater.key`, put the public key there and the
  private key and its password into the CI secrets `TAURI_SIGNING_PRIVATE_KEY` /
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. `createUpdaterArtifacts` lives in
  `src-tauri/tauri.updater.conf.json`, merged only when that key is present (CI:
  `pnpm tauri build --config src-tauri/tauri.updater.conf.json`), because the Tauri CLI fails a
  build that creates updater artifacts without the private key — a plain `pnpm tauri build` must
  keep working on any machine.
- **Code signing**: `bundle.windows.signCommand` runs `node scripts/sign-windows.mjs %1` for the
  app, the installer and the uninstaller. It signs with Azure Trusted Signing
  (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `TRUSTED_SIGNING_ENDPOINT`,
  `TRUSTED_SIGNING_ACCOUNT`, `TRUSTED_SIGNING_PROFILE`; `trusted-signing-cli` on PATH) or with a PFX
  through signtool (`WINDOWS_CERTIFICATE_PFX`, `WINDOWS_CERTIFICATE_PASSWORD`, optional
  `WINDOWS_TIMESTAMP_URL`, `SIGNTOOL_PATH`); with none it leaves the file unsigned and succeeds;
  a half-configured method fails; `PAPARATS_REQUIRE_SIGNING=1` turns "unsigned" into a failure.
  CI maps the same names from secrets (the PFX as `WINDOWS_CERTIFICATE_PFX_BASE64`), installs
  `trusted-signing-cli` only when Azure is configured, and fails when the installer reaches 15 MB.

### D49 — Keyboard, focus, disabled and loading states (M6)

- **Rings.** Everything interactive has the 2px `--mint` `:focus-visible` ring at 2px offset,
  except where that ring would be clipped or would contradict the design: controls inside a
  clipping container (menu items, settings link rows, underline tabs, the Profile info rows — the
  first one 1px further in, its top rule is clipped — the Update history header, the version
  history toggle, the window controls at the window edge) draw it inset; text fields keep the prototype's
  mint border (a text field matches `:focus-visible` on a mouse click too, so a ring would show on
  every click); buttons and arrows on photographic banners use `--cta-mint` (in the light theme
  `--mint` is a dark green that disappears on the dark photos). The modal body scrolls, so it keeps
  4px of padding (taken back by a negative margin) for edge-to-edge fields' rings. The content
  column takes focus after a navigation but draws no ring (it is not a control).
- **Hit targets.** The prototype's 30px buttons (Recently updated, Take, Open, Retry) keep their
  size and get a 32px target from `Button`'s `xs` size (the per-screen `::before` rules they had
  were 30px on bordered buttons: an absolutely placed pseudo-element sits in the padding box).
  Filter panel "Clear all" got a `::before` hit area. Carousel dots stay 6px with a 32px-tall,
  gap-wide (14px) target: a 32px-wide one would cover the neighbouring dots; the prev/next arrows
  are the full-size targets. Idea cards open from anywhere by mouse; their 20px title button is the
  keyboard route.
- **Disabled.** Inert states are native `disabled` (out of the tab order): Free/Windows filters,
  the current plan, Post/Send while empty, Queued, Installing…. (**Superseded by D58** for the
  current plan, Post, Send and Release: the prototype's enabled no-ops are `aria-disabled`.) "Offline" keeps answering a press
  with the offline toast (prototype), so it is `aria-disabled` and stays focusable.
- **Loading.** `Button loading` = `aria-busy` + presses ignored at once; the spinner replaces the
  leading icon, or — without one — fades in over the label after 150 ms (the label turns
  transparent but stays the accessible name), so the mock services' 40 ms calls show no flicker
  and no button changes width. Busy now: Confirm purchase, Send, Publish (already), Release, Add
  channel (trust), Add (lookup) and catalog Subscribe, the channel page's Subscribe / Unsubscribe /
  Sync now, Post, Save (profile), Take this idea, Activate 3 months of Pro, Remove (device), Sign
  out; Check for updates keeps "Checking…" as its progress with `aria-busy` (prototype copy, no
  spinner). There is no Sign in outside the first-launch scene.
- **Focus management.** Dialogs trap Tab, pull back focus that leaves them (the sidebar is not
  covered by the scrim, so a press there still works), close on Escape from anywhere and return the
  focus to the opener; the add-channel dialog, back from a cancelled trust confirmation, focuses
  the Subscribe that asked. A navigation from inside the content focuses the content column; from
  the sidebar or the top bar the focus stays put. Keyboard presses (click `detail` 0) on buttons
  that are replaced by their own result hand the focus on: Update all → Pause all, Cancel all →
  Update all, Subscribe ↔ the Enabled switch / Unsubscribe, Take this idea → Mark as released
  (Edit profile ↔ Name already did). The window controls moved to the end of the DOM (absolutely
  placed, nothing moves): the tab order is sidebar → search → avatar → screen → window controls.
- **Names.** Repeated short labels are described by their context without new copy: settings row
  buttons by the row title, the catalog's Learn more / Subscribe by the channel, the plans'
  Choose plan by the plan name and price. The toast host keeps one polite live region mounted.

## First launch (M6)

### D50 — The first-launch scene and onboarding
- **When it plays.** `app/bootstrap.ts` calls `useFirstLaunchStore.launch()` after `initI18n`: the
  scene plays unless `localStorage › paparats.firstRun` holds `{seen: true, …}` (FIRST_LAUNCH_SPEC
  "Persistence"; read and written through `platform/storage › localStore`, which never throws).
  The record is `{seen, locale, theme, at}`; a seen record skips the scene but does not restore
  locale and theme from it — the settings service already persists both (in Tauri,
  `settings.json`). In the app the record lives in the WebView2 profile
  (`%LOCALAPPDATA%\com.paparats.desktop\EBWebView`; the dev server's origin has its own).
  Settings › Advanced › Replay first launch (developer mode) starts a new run from `seed`. Tests never auto-play it (only `bootstrap()` launches).
- **Scene.** The prototype's per-phase values (`renderVals` "// first launch") are data in
  `screens/first-launch/scene.ts`; the component sets them as unitless custom properties and the
  CSS module transitions them (seed → fern 120 ms → part 1400 → bloom 2800 → logo 4300 → lang
  5400). Authored for 1440 × 920 and scaled by one factor `s = min(W/1440, H/920)`: the flower,
  fireflies, logo and panel sit in a centred 1440 × 920 stage, the fern walls are pinned to the
  bottom corners, the skip button and the step indicator keep their distance from the edges. The
  exit target is x = +122 (half the sidebar) and y = 287 − H/2 (a fixed distance under the top
  bar), which is the spec's (+122, −173) at 1440 × 920. Its night palette is the `--fl-*` group in
  `tokens.css` (the same in both themes; gradient stops stay legacy `rgba()` — a `color-mix()`
  stop would switch the gradient to Oklab interpolation).
- **Finish.** Later / Sign in writes the record, turns the Home hero glow on (off at 1.7 s; its
  gradient stops are legacy `rgba()` tokens `--fl-hero-glow-*`, like the scene's, so it blends in
  sRGB as in the prototype) and
  hands over to Home like the prototype's `finishIntro`: `beginNavigation({skeleton:false})` +
  `navigate('/home')` (no skeleton; the 340 ms enter animation plays under the still-opaque
  overlay), not `go()` — so "Updated just now" markers are not cleared (replay is only reachable
  from Settings). The overlay fades after .4 s and unmounts at 1.5 s. The focus, still on the
  finishing button, moves to the content column (as after a navigation from inside the content).
  Sign in with a typed email calls `signIn(email, password)` and toasts "Signed in as <email>"
  1.6 s later; with no email it names the current account only if one is signed in (the prototype
  always named the profile email); a refused sign-in shows no toast. The account step is a
  `<form noValidate>`, so Enter signs in (the prototype had no form). "No account? Create one"
  opens `https://paparats.app/signup`. Replay remounts the scene at once (the prototype showed the
  app for ≈ 40 ms first).
- **No motion.** Reduced motion (the OS) or Subtle animations off starts at the language step with
  every scene animation and transition off and no shock ring; the prototype kept the sway,
  fireflies, glow and spin running. The OS setting is read once per run.
- **Accessibility (no visual change).** The overlay is `role="dialog"` with `aria-modal` and a
  label (`firstLaunch.sceneLabel`); the rest of the window is `inert` until the exit begins; the
  focus enters the overlay, then each step's container; language and theme cards carry
  `aria-pressed`; the indicator is an `<ol>` with `aria-current="step"`; `››` has a translated
  label and title (the prototype's title was English only) and is disabled and hidden from
  assistive tech once a step shows; the mark is `alt=""` (the name follows it). Back (30 px) and
  "No account? Create one" (13 px text) keep their size and get an invisible 32 px hit area. In a
  window smaller than 1440 × 920 (`s` < 1, down to 0.87 at the 1280 × 800 minimum) these hit
  areas and one on `››` grow by 1/`s`, so they stay 32 px on screen; nothing changes at `s` ≥ 1.
- **Frameless window.** As in the prototype the scene (z-index 40) covers the window controls. The
  window must still move: an invisible `data-tauri-drag-region` strip covers the scene's top 32 px
  (nothing interactive lives there; a click on it no longer skips). Closing and minimising during
  onboarding go through Alt+F4 (with Minimize to system tray on, that hides the window like the ×
  does) and the taskbar.
- **Links during the scene.** A `paparats://` link that arrives while the scene covers the shell
  (a fresh install opened from a link) waits; the page opens when the exit begins, after the
  finish's own hand-over to Home, so Back returns to Home. Only the latest waiting link opens.

## Integration (M6)

### D51 — Reconciling the M6 changes
- **Shared files edited by several engineers.** `app/Layout.tsx` carries all three: the
  first-launch overlay as the frame's last child, `useDeepLinks` / `useTrayActions`, and the
  keyboard work (window controls last in the column, the content column taking focus after a
  navigation). The layout also moves the focus to the content column when the first-launch exit
  begins — a passive effect, so it runs after the scene has lifted `inert`. `Modal`'s focus
  containment ignores other `aria-modal` dialogs, the first-launch overlay included; no dialog can
  be open while the scene plays (links close dialogs, Replay is a Settings row).
- **Rules.** The first-launch module defined its night palette as literal custom properties on the
  overlay; the group moved to `tokens.css` (`--fl-*`, theme-independent), so modules keep only
  `var(--*)`. The hero carousels' `aria-roledescription` was a hard-coded English "carousel"; it is
  `common.carousel` in en/be/ru now.
- **Numbering.** The keyboard/focus decision kept D49; the first launch is D50 (its engineer wrote
  no decision).

## Real strategies (M7)

M7 puts real implementations behind the simulated ones without changing the UI. The engineers of
the install strategies and of the first integration left no notes; D52–D57 were written at
integration from the code's behaviour.

### D52 — `PAPARATS_REAL`: one variable, read once, wired in one place
- **Parsing** (`src-tauri/src/flags.rs › RealFlags`): read once in `init_state`, after file logging
  starts. Names `inventory`, `install`, `catalog`, `account`, `all`, in any case, separated by
  `,` `;` `+` or whitespace. Unknown names are logged as a warning and ignored; unset (or not
  Unicode) = nothing real. There is no setting, command or event for it: the UI cannot tell which
  strategies run (M7 = no UI change).
- **Wiring** (`src-tauri/src/services/wiring.rs › Strategies::from_flags`) builds, in this order:
  the catalog backend; the inventory, over the catalog's apps; the installer (`StrictTrust`, D55);
  the transfer (`RoutedTransfer`: the simulated transfer unless the job carries a URL and a real
  strategy; `HttpTransfer` only when the remote catalog runs, sharing its allowlist and proxy
  rule); the sign-in. `AppState::open` takes the builder, `AppState::new` the built `Strategies`.
- **A strategy that cannot start falls back** to its simulated counterpart and the app starts:
  the catalog (no pinned key, a bad override, a storage error) → the embedded catalog; the
  installer (no known folders, i.e. not Windows) → simulated; sign-in (not Windows) → local. The
  log says why at `error`, and `Strategies.flags` = what actually runs: it is logged once as
  `real strategies (PAPARATS_REAL) real=[…]` (absent in the default run) and decides whether
  `paparats://auth/callback` links go to the account flow (D56). The inventory has no failure
  path (a failing scan source is logged and skipped, D53). One gap: when `HttpTransfer` cannot be
  built the catalog still counts as running and real packages fail to download.
- **The default run is M6's**: embedded catalog, stored inventory, simulated transfer and
  installer, local sign-in (`no_flags_is_the_mock_world`: 14 seeded apps, nothing written).
  Under real flags the mock world is still seeded, and favorites, collections, subscriptions,
  ideas, activity, plans and devices stay local.
- **Async commands.** The commands that read the catalog or the inventory became `async` (catalog,
  platform, library, favorite, channels, sync, sign-in, sign-out); the bindings did not change.
  Inventory reads run on the blocking pool. `AppState::startup()` (spawned after `setup`)
  refreshes the remote catalog, hands its apps to the inventory and syncs the active channels,
  warms the inventory scan and refreshes the signed-in profile — nothing in the default run.
- **Combinations.** `install` alone changes nothing visible: without the remote catalog every job
  is a simulated package, which the real installer runs with the simulated hold. `inventory`
  without `install`: a simulated install is journaled, but the next scan does not find it, so the
  app leaves the library again.

### D53 — The real inventory (`PAPARATS_REAL=inventory`)
- **Sources** (`paparats-inventory › RegistryInventory`): the Uninstall keys of HKCU and of HKLM's
  64- and 32-bit views; the current user's MSIX main packages
  (`PackageManager.FindPackagesByUserSecurityIdWithPackageTypes(current user, Main)`); Paparats'
  portable folder `%LOCALAPPDATA%\Paparats\apps\<app-id>\<version>\` (folders starting with `.` —
  the installer's staging — and links are skipped). Entries Windows hides are hidden here too: no
  `DisplayName`, `SystemComponent` = 1, a `ParentKeyName`, an update `ReleaseType`. Read-only, no
  elevation, no `unsafe` (`winreg`, the `windows` crate's WinRT projection).
- **Only catalog apps are reported**, through detection rules that travel with the catalog:
  `App.detection` (`AppDetection`: `displayNames`, `displayNameRegex`, `publisher`,
  `productCodes`, `msixFamilyNames`; every field on the wire, like the rest of the model). All 32
  fixture apps carry rules (`scripts/port-fixtures.mjs › DETECTION`). Matching, strongest first:
  an Uninstall key name in `productCodes` (no publisher check); a display name, compared in three
  forms (as is, architecture tags stripped, trailing versions stripped); the regex (anchored,
  case-insensitive, 1 MiB). `publisher` is a substring the entry's publisher must contain for name
  and regex matches. An entry belongs to one app (strongest match, then catalog order); an MSIX
  package matches by family name, a portable folder by app id. A regex that does not compile is
  logged and dropped; the app keeps its other rules.
- **Versions**: `DisplayVersion`'s first version-like token, else `VersionMajor.VersionMinor`,
  else the packed MSI `Version`, else a version in the `DisplayName`; the highest of all copies
  wins (per-user and per-machine, x64 and x86, portable). A version equal to the catalog's
  (`5.2.9.0`, `24.09`) is reported in the catalog's spelling; none at all → the version Paparats
  recorded, else `0` (which reads as an update).
- **The UI compares versions, not strings** (`domain/versions.ts`, a port of
  `paparats_inventory::version` with mirrored tests): "Update" only when the catalog's version is
  newer — a self-updated app newer than the catalog reads "installed", never a downgrade — and the
  version history marks the installed release by numeric equality. On the mock data set nothing
  changes (6 updates, 8 installed).
- **Last used** is a best-effort estimate — Windows keeps no reliable per-app "last used": the
  newest of Explorer's UserAssist runs (ROT13 names, a FILETIME at offset 60 — a program inside
  the install folder, a shortcut named like the entry or the app, the MSIX family), the newest
  write in the install folder two levels deep (at most 256 entries; MSIX:
  `%LOCALAPPDATA%\Packages\<family>`), the `InstallDate` and the Uninstall key's last write; never
  after today, today with no evidence. The install folder is `InstallLocation`, else the folder of
  `DisplayIcon` or of the uninstaller outside `%windir%`, Package Cache and `Windows\Installer`.
  Prefetch would be better but needs administrator rights. UserAssist is read in memory and never
  logged; only `{appId, version, lastUsed}` of catalog apps crosses IPC.
- **Cache and journal.** Scans are cached for 10 s (one scan at a time; `record`, `remove`,
  `refresh` and a new catalog drop the cache); a source that fails is logged and the others still
  count. On the development PC a scan answered `install_get_library` in ≈ 0.26 s. `record` and
  `remove` go to the stored inventory as a journal (activity, the updates counter, the recorded
  version); a journal row never makes an app installed. The UI caches the library, so apps
  installed or removed outside Paparats appear after the next library change or a restart.
- **Uninstall** asks the installer (D55) to remove what its receipt names, then scans again: an
  app still found is refused with `invalid` "`<id>` was not installed by Paparats; remove it in
  Windows Settings", and nothing is forgotten. The Library does not show that error yet (its menu
  ignores failures — no UI change in M7). `Inventory::locate` (where an app was found, with the
  uninstall commands Windows keeps) is the hook for uninstalling other installs later.

### D54 — Signed manifests and the remote catalog (`PAPARATS_REAL=catalog`)
- **Envelope** (`paparats-catalog › envelope`): `{payload, signature, keyId, publicKey?}` — the
  payload is the manifest JSON in base64, the signature Ed25519 (`verify_strict`, 64 bytes) over
  exactly those bytes. The key is chosen by `keyId` (default id: hex of the first 8 bytes of the
  key's SHA-256); keys are 32 bytes in hex or base64, weak keys refused. No expiry or threshold:
  rotation = several ids, revocation = removing a key (cached copies that no longer verify are
  deleted when loaded). Payloads carry a `generated` date that may never go back (the same day is
  accepted) — the rollback guard.
- **Files** under `https://cdn.paparats.app/v1/`: `channels.json` (the channel directory: channel
  data, each channel's `manifestUrl` and, for verified channels, their keys), `catalog.json`,
  `platform.json` — all signed with the pinned official keys — then each channel's manifest
  (`{channelId, generated, packages}`). Official channels: official keys; verified channels: their
  keys from the signed directory (or an official key); community channels: unsigned or
  self-signed manifests are accepted as **unverified** (warnings in the log), a bad self-signature
  is refused. Every manifest's `channelId` must match; package URLs must be HTTPS (plain HTTP to
  loopback), without credentials, with a 64-hex SHA-256.
- **Cache** (`paparats-storage › manifest_cache`, schema 2): the raw verified envelope per URL
  with its ETag, re-verified on every load; only verified envelopes are stored. `If-None-Match` →
  304 reuses the copy; a bad signature, rollback or malformed answer keeps the previous copy;
  offline the cache serves without an age limit. `channel_health` counts failures: a channel is in
  outage after 2 failed syncs in a row (`outage` = the first one), and a success ends it.
- **Refresh**: at startup only — the three official files one after another (each on its own),
  then the manifests of the active subscriptions; "Sync now" fetches that channel's manifest (any
  failure is "unreachable"). Catalog, platform and channel reads wait up to 45 s for the first
  refresh when nothing is cached; after it (even a failed one) they answer from what exists, with
  no retry during the session.
- **Network**: HTTPS only (HTTP to loopback), at most 5 redirects each checked, 16 MiB per
  manifest, 10 s connect / 30 s per request, the environment's proxy. One allowlist, shared with
  the downloads, grows during the session: first-party hosts, the manifest hosts the directory
  lists, the download hosts of verified manifests, and a community channel's download hosts once
  it is followed (on follow, after the startup sync, after a successful "Sync now" — the follow
  went through the community confirmation).
- **Downloads**: a queued app gets the package its **source channel's** manifest lists (the
  install-source rule: the most trusted active channel offering it); the manifest's version is
  installed. An app that channel does not list, or before it was synced, stays a simulated
  download. Real transfers go to `app_local_data_dir()/downloads` (SHA-256 checked, the size
  capped at `sizeBytes`, the file named for its strategy — D57) and are deleted after the install.
- **Keys and overrides.** No release key is pinned yet (`OFFICIAL_KEYS` is empty), so `catalog`
  alone falls back to the embedded catalog (D52). `PAPARATS_CATALOG_URL` / `PAPARATS_CATALOG_KEYS`
  point a **development build** at a CDN signed with a development key (the keys replace the
  pinned ones; a loopback base URL is allowlisted and turns the environment's proxy off for the
  catalog and the downloads). Release builds ignore both with a warning — decided at integration:
  there the compiled-in keys are the only root of trust. `sign-manifest` (a bin of the catalog
  crate; `node scripts/sign-manifest.mjs` runs it) signs one JSON file with the seed in
  `PAPARATS_SIGNING_KEY` (`PAPARATS_SIGNING_KEY_ID` optional): `--generate-key`, `--public-key`,
  `--self-signed`, `--unsigned`, `--out`.
- **Known gaps.** The directory allowlists every channel's manifest host at load, so a community
  channel that serves downloads from its manifest host is not gated by the follow; the allowlist
  never shrinks within a session; a signature or rollback failure reads as "unreachable";
  `generated` has no ceiling (a far-future date blocks that source's updates); trust warnings
  reach only the log; the catalog and the directory refresh only at startup.

### D55 — Real installers (`PAPARATS_REAL=install`)
- **One `StrategyInstaller`** behind the `Installer` trait runs the strategy of the verified
  manifest (`Package.strategy`); `simulated` packages keep the simulated hold (D52).
- **Verify before trusting.** The file is opened read-only with share mode *read* (nobody may
  write, rename or delete it) and hashed against the manifest's SHA-256, which is mandatory. The
  handle stays open until the installer exits, so the bytes that were checked are the bytes that
  run. EXE/MSI then go through `verify_authenticode`: `WinVerifyTrust`
  (`WINTRUST_ACTION_GENERIC_VERIFY_V2`, no UI, revocation checked for the whole chain) on the
  embedded signature, else on the system catalogs (SHA-256, then SHA-1 member hash) — how Windows
  signs its own binaries. The signer is the verified chain's leaf certificate (CN, full subject,
  issuer).
- **Policy** (`policy::authorize`, typed errors): a signature Windows trusts is required
  (`unsigned`, `badSignature(<reason>)`); when the manifest names a `signer` (CN or full subject,
  case-insensitive) it must match (`signerMismatch`). An unsigned EXE/MSI runs only from a
  **community** channel whose unsigned-binary warning the user accepted, and never when its
  manifest names a signer; a broken signature (tampered, revoked, untrusted root, expired,
  revocation unknown) is never waived. The app passes `StrictTrust` — no UI accepts unsigned
  binaries yet. MSIX packages are verified by Windows itself, ZIPs by their hash.
- **MSI**: `%SystemRoot%\System32\msiexec.exe` (an absolute path, never a PATH lookup) with
  `/i <file> /qn /norestart` + `MSIINSTALLPERUSER=1 ALLUSERS=2`. Per user is the default and needs
  a package whose Summary Information says it installs without elevation (Word Count bit 3);
  otherwise the install fails with `needsMachineWide` — never a silent UAC prompt. Exit codes:
  0 → installed; 3010 / 1641 → installed, a restart finishes it (logged); 1602 →
  `installerCancelled` (not the queue's own `cancelled`, which would leave the item unsettled);
  1618 → `busy`; anything else → `exitCode`. The ProductCode goes into the receipt; uninstall is
  `msiexec /x {code} /qn /norestart` (1605, already gone, counts as removed).
- **Machine-wide** only when asked explicitly (`InstallTarget.per_user = false`: `ALLUSERS=1`, or
  an elevated EXE): `ShellExecuteExW` with the `runas` verb (the UAC prompt, window hidden) and the
  same argument vector quoted by the `CommandLineToArgvW` rules — the only place a vector becomes
  one string; a declined prompt is `elevationDeclined`. The app always installs per user for now
  (the Settings choice is not passed to the engine).
- **EXE silent**: the manifest's `args` verbatim — one manifest string = one argument, never a
  shell (the file must be an `.exe`: Rust would start a `.bat`/`.cmd` through `cmd.exe`) — started
  in its folder with no console window and null standard handles. An installer that demands
  administrator rights fails to start (740) → `needsMachineWide`. Exit codes as for MSI, plus
  1223 → cancelled; Inno/NSIS private codes are failures. After 30 minutes the installer is killed
  (`timedOut`; child processes are not tracked). One installer runs at a time (Windows Installer
  allows one install per machine).
- **MSIX**: the package identity (`Name`, `Publisher`) is read from its manifest for the receipt,
  then `PackageManager.AddPackageAsync(file URI, no dependencies,
  ForceTargetApplicationShutdown)`; uninstall removes the current user's packages with that name
  and publisher.
- **Portable ZIP**: extracted into a hidden staging folder `<apps>\<app-id>\.<version>.partial-…`
  and renamed to `%LOCALAPPDATA%\Paparats\apps\<app-id>\<version>\` (a failed or cancelled
  extraction leaves nothing). Zip slip: every entry name is checked before the first byte is
  written — relative, plain Windows names only (no `..`, roots, drives, `:` streams, device names,
  trailing dots or spaces, wildcards, control characters); symlink and encrypted entries are
  refused; files are created new (names differing only in case are an error, never an overwrite);
  at most 16 GiB and 200 000 entries. A Start-menu shortcut `Programs\Paparats\<program>.lnk` opens
  the main program (the `.exe` named like the app, else the only one that is not an
  uninstaller/updater/helper, else the largest; top level or the only sub-folder). An update lands
  next to the old version, which is then removed; uninstall removes the shortcut and the folders.
- **Receipts** (`%LOCALAPPDATA%\Paparats\receipts\<app-id>.json`, written atomically) record what
  a real strategy installed; uninstall reads them. No receipt → nothing to remove (simulated or
  seeded apps). EXE installs cannot be uninstalled yet (`unsupported`: that needs the app's own
  uninstaller from its Uninstall entry, D53).
- **`unsafe`** only in `src/sys/windows.rs` (`#[allow(unsafe_code)] mod sys`, a `SAFETY` comment
  per block); other platforms get stubs that answer `unsupported`. Error messages carry no paths.
- **Known gaps**: two portable apps whose programs share a name share one shortcut; a timed-out
  installer's children keep running; the install location setting is not used (installers pick
  their own folder).

### D56 — Sign-in in the browser (`PAPARATS_REAL=account`)
- **OAuth 2 authorization code with PKCE** for a public client (`paparats-desktop`, no secret)
  against `https://api.paparats.app` (first-party, `hosts::ACCOUNT_API`): `/oauth/authorize`,
  `/oauth/token`, `/oauth/revoke`, `GET /v1/me`. No scope, S256, a 64-character verifier (384
  bits) and a 256-bit state from the OS CSPRNG. The redirect is `paparats://auth/callback` through
  the M6 link path (single instance + deep link), not a loopback server; the callback is handled
  in Rust only — never queued for the UI, never logged with its query — and ignored when real
  sign-in does not run (this replaces D48's "ignored until PKCE").
- **`account_sign_in(email, password)`**: the password is dropped (never stored, sent or logged);
  the email becomes the `login_hint`. The call opens the system browser (tauri-plugin-opener) and
  resolves when the callback completes it: signed in with the API's profile; `invalid` when the
  user denied it or after 10 minutes. A link that matches no pending sign-in (stale, replayed,
  forged, from before a restart) is dropped without ending the wait; the state is compared in
  constant time and used once; at most 4 sign-ins wait (10 minutes each, in memory).
- **Tokens**: form posts, Bearer tokens only, redirects never followed, answers ≤ 64 KiB, 20 s.
  The access token is refreshed when used within 60 s of its expiry (one refresh at a time; a
  rotated refresh token is stored); only `invalid_grant` or a missing refresh token ends the
  session. They live in the **Windows Credential Manager** — a generic credential for service
  `Paparats` and the user id, `persistence=Local` (this PC, not roaming), a JSON blob of at most
  2 560 bytes (an access token that does not fit is dropped and refreshed on use) — never in the
  database or the log. The database keeps the user id (`meta account.userId`) and the profile.
- **Profile**: `/v1/me` replaces the local profile (name, email, member since, country, time
  zone); devices, activity, usage, plans and two-factor stay local. When signed in, startup
  refreshes it in the background (no event: the UI sees it on its next account read).
- **At startup the snapshot follows the stored session** (added at integration): the seeded mock
  account says "signed in", so without tokens for a remembered user it is signed out locally.
- **Sign-out** revokes the refresh and the access token (5 s, best effort — offline they are only
  deleted), deletes them and forgets the user id. Signing in as another account deletes the
  previous account's tokens.
- **Fallback**: other platforms keep the local sign-in; on Windows the Credential Manager is not
  probed at startup (a broken store fails at first use).
- **Known gaps**: no event tells the UI about account changes outside the sign-in call; an
  unreadable credential blocks sign-in and sign-out until it is removed; a sign-out while a
  sign-in waits leaves that call to time out; profile edits stay local and the next refresh
  replaces them; the UI still asks for a password (and first launch only signs in with a typed
  email).

### D57 — Integration (M7)
- **Dependencies** live in `[workspace.dependencies]` only; crates add features, and Windows-only
  crates sit under `[target.'cfg(windows)'.dependencies]`: `base64`, `url`, `regex`, `getrandom`
  (now a runtime dependency: PKCE, key generation), `winreg` 0.56, `windows` 0.62 +
  `windows-collections` 0.3, `zip` 7.2 (no default features; deflate through zlib-rs, deflate64),
  `keyring` 4 + `keyring-core` 1. MSRV 1.88 (let chains, keyring 4). Accepted duplicates in the
  lock: `windows` 0.62 next to Tauri's 0.61 (the M7 code is written against 0.62, whose core the
  tree already had; they converge when Tauri moves), `winreg` 0.56 next to auto-launch's 0.10 and
  embed-resource's 0.55 (the inventory does not build against 0.55's API).
- **Download file names follow the strategy** (`paparats-download › http › file_extension`):
  `<app>-<version>.msi|exe|zip`; MSIX keeps `.msix`/`.msixbundle`/`.appx`/`.appxbundle` from the
  URL (else `.msix`). A CDN link without the right extension no longer makes the EXE strategy
  refuse its installer.
- **Fixes at integration**: the account snapshot reconciled at startup (D56); the catalog
  overrides limited to development builds (D54); forgetting an uninstalled app runs on the
  blocking pool like the other inventory calls; `InstallError::Unsupported` reads "not supported:
  …"; stale comments corrected.
- **Tests that change this PC are `#[ignore]`d** and take their input from the environment
  (`cargo test -p paparats-install -- --ignored <name>`): `real_msi_install` and
  `real_machine_wide_msi_install` (a UAC prompt) with `PAPARATS_TEST_MSI`; `real_exe_install` with
  `PAPARATS_TEST_EXE` and `PAPARATS_TEST_EXE_ARGS`; `real_msix_install` with `PAPARATS_TEST_MSIX`.
  Also ignored: `paparats-inventory › scan_this_machine` (read-only; prints what the scan finds)
  and `paparats-account › credential_manager_round_trip` (writes a `Paparats-test` credential).
  Everything else runs in `cargo test`, including real `WinVerifyTrust` checks (notepad.exe by
  catalog, explorer.exe embedded and tampered, an unsigned copy), a signed system program as a
  stand-in EXE installer, a portable install/update/uninstall in a temp folder, and the catalog,
  OAuth and download flows against local HTTP servers.

## Parity pass (M8)

### D58 — Parity pass: the prototype's look and behaviour restored
M8 aims at an app that looks identical to the prototype. Each item below reverts an earlier
deliberate deviation (the older bullet is marked "superseded by D58"). Checked against the
prototype markup and `renderVals`, and measured side by side at 1440 × 920 (the app in a
same-origin iframe over the prototype, `getBoundingClientRect`) in en/be/ru.

- **Store-card category chip** (D27): `AppCard` renders it as `Chip wrap`, the prototype's
  inline-block chip (lines 227, 313): a label longer than the text column wraps inside the chip,
  which grows (ru "Образ жизни", be "Стыль жыцця" → two lines, 34.8 px, and the card and its grid
  row grow with it), and a single long word is not clipped — ru "Продуктивность" and be
  "Прадукцыйнасць" run past the text column and ≈ 10 px past the card border into the grid gap, as
  in the prototype. Chip boxes and positions and the Browse row heights (180 / 168 / 152 px) equal
  the prototype's in all three languages. The channel chip still ends in an ellipsis (line 227).
- **Hover affordances the prototype lacks are gone** (M1 component states): idle carousel dots keep
  their colour on hover and every dot shows the pointer, the active one too (lines 213, 300); a
  filter checkbox or radio keeps its box border when the row is hovered (only the label turns
  `--text`, lines 380–406); `TextField`, `SearchBox` and `TextArea` change their border only on
  focus (no input in the prototype has a hover style; `ProfileHeader`'s override that cancelled
  the hover went with it). Two `title` tooltips the prototype does not show were dropped where an
  `aria-label` already names the control: the Library grid card's favourite and the profile
  camera badge. Pressed states and focus rings stay.
- **Favourite toggles** (D31, D36): the app page's star (`SplitButton`'s secondary part) and the
  Library grid card's star stay `--text2` in both states, with the prototype's hovers (`--hover`
  ground, line 987; `--text`, line 627) and no fill. `aria-pressed` still carries the state; the
  favourite is shown by the mint star after the name in Library rows (line 600).
- **Report a problem** (D31): Send is always enabled, as the prototype's (line 1412; `sendReport`
  checks nothing): a blank report is sent (the text is trimmed, so possibly `""`). Both channel
  services accept it (the Rust command ignores the text, D24). Busy state and failure handling
  are unchanged.
- **Paused status** (D31, D34): the one-line status keeps the size while paused — "Paused · 61% ·
  7 MB of 12 MB" on the app page (line 992: a paused download is still `downloading` there, so
  `isDownloading` appends `dlSize`) and in the Updates rows (`range = [dlLine, dlSize].join(' · ')`).
  `downloadStatus().text`; the Library row's two lines are unchanged.
- **Overflow menu** (D36): `PopoverSurface` appears at once, without the pop-in; the prototype
  animates none of its popovers (line 606).
- **Plan cards in the Pro state** (D38): the current paid plan shows both pills, the promo pill
  ("Most popular" / "Save 18%") and then "Current plan" (`planList`: `hasBadge` and `current` are
  independent); the screen and the `/dev` gallery pass the badge on every card. The name block
  keeps the prototype's automatic minimum width, so the name and subtitle wrap exactly as there
  (monthly / yearly card heights at 1440 px: en 446.1 / 409.7, be 446.1 / 427.9, ru 483.9 /
  465.7 — the prototype's). The prototype's second pill ran 37–85 px past the card's content edge
  (14–62 px past its border) and was clipped by the next card; here the pills sit in a
  right-aligned wrapping group beside the name: when they do not fit side by side the second one
  wraps 6 px under the first, inside the card (right edges on the content edge). With room for
  both (a wider window) they stay side by side, 10 px apart, as in the prototype. The Free state
  is unchanged.
- **The current plan's button** (D38, D49): an enabled no-op in the prototype (pointer,
  `brightness(1.12)` hover on `--card2` / `--text3`). It keeps that look and is inert:
  `aria-disabled="true"`, no `onSelect`, no pressed nudge; it is now in the tab order (a native
  `disabled` button was skipped).
- **The prototype's other enabled no-ops** (D45, D49), the same way: Post with a blank comment
  (line 1342: `--card2` / `--text3`, `brightness(1.1)` hover) and Release with a blank version
  (line 1495: full mint, `--mint2` hover — it was at .5 opacity) are `aria-disabled`, focusable,
  keep the pointer and the hover, and do nothing. Release still never sends a blank version (D12).
- **Settings remembers its section** (D39): Settings opened without a section (the sidebar)
  reopens the section last shown, like the prototype's `section` state that survives navigation;
  explicit targets (Updates › Update settings, Subscription › Learn more, the tray's Check for
  updates, Back from a channel page opened from Sources) set it. The Settings screen keeps
  `useUiStore.settingsSection` (reset like every store in tests) and `go()` resolves
  `{to:'settings'}` through `app/navigation › resolveTarget`; General keeps the bare `/settings`
  path. A fresh start opens General.
- **Never-synced channels** (D42): the Settings › Sources row shows no sync text (the empty slot
  and its 14 px gap stay, like the prototype's empty div, line 838); the channel page's Last sync
  still reads "Not synced yet" (`t.neverSynced` in `ch.details`, line 2025, D43).
- **Kept on purpose**: localised number, percent, date and list formats (D13, D31, D38); Onest in
  the top-bar avatar (D41); focus rings, hit-target padding and pressed states (D32, D49); Queued,
  Installing… and "Updated just now" as native-disabled row actions with no visual change (D15,
  D35, D49 — the prototype's Queued and Installing… did nothing either; its "Updated just now"
  toasted "Opening …"); the Free / Windows filter rows (divs in the prototype); behaviour that changes no pixels
  (D12 validation, D30 loading, D42 backdrop click and in-flight guards). The idea card's comment
  count keeps its `title` (its only description for assistive tech).

### D59 — Icon glyph parity
The README asks for the platform icon library and CLAUDE.md for lucide-react only, but lucide 1.x
redrew many icons the prototype draws in their classic form (r 9 circles, sharp stars and bolts,
no tassel or ferrule, another arrow head). Each prototype glyph (`static ICONS`, line 1628, and
the inline `<svg>`s of the markup) was rendered next to its lucide candidates at every size and
stroke it is used at (1× and 2×, share of differing ink).

- **Rule**: a stock lucide glyph where it draws the same strokes and differs by at most ≈ 10 % of
  the ink (corner rounding, sub-pixel offsets); otherwise the prototype's path data, verbatim,
  through lucide-react's `createLucideIcon` (`components/Icon/glyphs.ts`, `paparats-*` class
  names), which keeps the 24 × 24 grid, the Icon's stroke and round caps/joins.
- **Stock lucide** (21 of the 56 ICONS glyphs, and 4 inline ones): rss, triangle-alert,
  layout-grid (rx 1 vs 1.5; **superseded by D62**: the prototype's rx 1.5 squares, which
  rasterise visibly rounder in the sidebar), the four chevrons, check, x, code, laptop → `LaptopMinimal` (exact),
  gamepad-2, infinity, users, bell, folder, lock, monitor, mail, refresh-cw, external-link, plus,
  minus, hard-drive, history → `RotateCcwClock`; inline: wifi-off, lightbulb, flag, the vote
  chevron (`chevron-up`).
- **Custom glyphs** (39): from ICONS — house (`home`), layers, download (an arrow onto a line:
  neither lucide `download` nor `arrow-down-to-line`), book-open (`book`), crown, settings,
  search, user, ellipsis (`more`: 0.01-long dots; lucide's r 1 circles draw bigger dots), list,
  arrow-right, badge-check, palette, play, wrench, leaf, graduation-cap, zap, heart, shield,
  sliders-horizontal, info, globe, clock, camera, star, pencil, briefcase, square, package,
  trash; inline — rotate-ccw (Sync now, lines 39/1142), git-branch (982), pen-line (1080), copy
  (1140), message-circle (1242), circle-check (1473), chevrons-right (1553) and **`info-serif`**,
  the serifed "i" of the app-header and channel notes (981, 1156), a new registry name (the
  About section keeps the prototype's plain `info`).
- **Names stay** as data and call sites use them (lucide kebab-case; fixtures and the Rust seed
  name `laptop`, `layout-grid`, `gamepad-2`, …): the registry maps each name to its glyph. The
  window-restore glyph (`copy`) now uses the prototype's copy drawing too.
- **Square ends**: the prototype draws the window controls (lines 110–112) and the Library row's
  favourite star (line 601) without round caps/joins; those call sites pass
  `strokeLinecap="butt"` / `strokeLinejoin="miter"`. `Icon.module.css` no longer forces round
  caps (lucide's attributes set them), so a call site can.
- **Pinned** by `Icon.test.tsx`, which reads the prototype file: every ICONS name and every inline
  glyph maps to a registry name and either the expected lucide component or the prototype's exact
  path data.
- **Verified** at 1440 × 920 with the app in a same-origin iframe over the prototype: the set of
  (glyph, size, stroke width, caps/joins, fill) of every rendered icon is identical on Home,
  Browse, Categories, Updates, Library (list, grid, collections, row menu), Ideas, Subscription,
  Profile (all five tabs), the ten Settings sections, app pages (obsidian, shell, mpv), channel
  pages (paparats, kvetka, vitrazh), idea pages, the Add channel, Report and Suggest an idea
  dialogs and first launch (an early phase and the language step). D43's note on lucide `info` /
  `rotate-ccw` is superseded.

### D60 — Integration (M8): the mock world off the startup path, build chunks
Written at integration from the code: the engineer who split the services left no notes.

- **The mock world is a lazy chunk.** `createServices(mode)` is async: `tauri` returns the
  adapters, `mock` runs `await import("./mock")`. Before, `services/registry.ts` imported
  `./mock` statically, and the Tauri adapters took helpers from `mock/system` and
  `mock/settings`. So every build parsed the mock services and the 78 kB fixture set before the
  first frame. The pieces both sets share moved to `services/common.ts`: WebView connectivity and
  clipboard, `externalUrl`, `sanitizeSettings` and `SELF_UPDATE_CHECK_MS`. The `@/services`
  barrel no longer re-exports mock values (only their types); tests import `@/services/mock` or
  `createTestServices` from `@/hooks/testing`. `createTauriServices()` takes no options.
  `services/startup.test.ts` walks the static imports from `main.tsx` and fails if they reach
  `services/mock/**` or `@fixtures/*`.
- **Build chunks** (`vite.config.ts › build.rolldownOptions.output.codeSplitting`): `react`
  (react, react-dom, react-router, scheduler) and `vendor` (the other `node_modules`) are tagged
  `$initial`, so a library that only a lazy chunk uses stays out of them; `fixtures` names the data
  set that the mock chunk and the `/dev` gallery share. The startup loads `index` 367 kB, `react`
  296 kB, `vendor` 122 kB and one 153 kB stylesheet; `mock` (8 kB), `fixtures` (78 kB) and `dev`
  (50 kB) load on demand. No chunk reaches Vite's 500 kB warning.
- **No top-level await.** `main.tsx` awaited `createServices` and `bootstrap` at module level.
  Rolldown turns its chunk optimizations off (common-chunk merging, redundant-load avoidance) for
  a module graph with top-level await, so the startup loaded seven scripts and two stylesheets:
  small shared chunks named after whichever module rolldown picked (`Toast`, `channels`,
  `common`). `main.tsx` now calls `void start(root)`. The order (services → bootstrap → render)
  and a startup failure (an unhandled rejection in the console) are unchanged. The startup test
  fails on any module-level `await`.
- **Offline banner Retry** moved from `app/OfflineBanner`, which read `useServices()` and two
  stores itself, into `hooks/useConnectivity` (`{ offline, retry }`, with tests). Behaviour is
  unchanged.
- **Reconciled.** D58 (parity) and D59 (icons) do not collide. The files both passes touched
  change independent things: the Library row's favourite star has butt caps (D59), and the grid
  card's and app page's stars lost their pressed colour (D58). `docs/architecture.md` now covers
  D58 (§5 `settingsSection`, §7 `resolveTarget`), D59 (§9, Icons) and this entry (§1, §2, §6,
  §11). The re-export shim in `mock/system.ts` is gone; callers import `services/common`.
  `.gitattributes` asks for LF, but `docs/decisions.md`, `docs/progress.md` and
  `paparats-install/src/error.rs` had CRLF in the working copy; they are LF again.
- **Verified**: the production build served by `vite preview` and loaded in headless Edge
  (1440 × 920, `#/library`) boots on the mock chunk and renders the Library with the fixture apps.

## Acceptance (M8)

### D61 — Functional acceptance: focus rescue, Sign in after sign-out, row icon tiles
Written at the visual acceptance from the code and its tests; the functional acceptance pass left
no notes.

- **Focus rescue** (`app/focusRescue.ts › useFocusRescue`, mounted once by the layout on the
  content column). When the control holding the focus leaves the document with its row or block
  and nothing else takes the focus, the focus goes to the nearest control where the block was: in
  the removed block's container (then the containers around it) the first control after that spot
  — a replacement rendered in its place, the next row — else the last one before it, else the
  content column. Covered: Library ⋯ → Uninstall, the stale callout's Keep / Unsubscribe (Settings
  › Sources and the channel page), the Ideas note's ×, an idea card's Take, Cancel plan. The
  screens' own hand-overs (D49) run first and win; focus let go on purpose (a press on plain text,
  another window) is not followed. `restore()` gives an overlay that ends without a navigation the
  same hand-back. `focusColumn` moved here from the layout.
- **Settings › Account › Sign in.** Signed out, the account row's action reads "Sign in"
  (`settings.signIn`, en/be/ru; it was a disabled "Sign out") and opens the first launch's Account
  step alone: `useFirstLaunchStore.openSignIn()` starts a run in mode `signIn` — no scene, motion,
  step indicator or Back; finishing writes no first-run record, turns no hero glow on, stays on the
  screen and gives the focus back (`restore()`). Signing in without a typed email signs a
  signed-out account back in with its profile email (the prototype's `signInIntro` signs in as the
  profile); a signed-in account is kept, as before.
- **Row icon tiles.** The 44/48 px icon tile of the Library and Updates rows is a `div` with the
  click handler and `aria-hidden` (it was a `button` with `tabIndex=-1` and `aria-hidden`, which a
  mouse press still focused — a focused element hidden from assistive tech). The name button beside
  it is the control. No visual change (`user-select: none` keeps the monogram unselectable, as on
  the prototype's button).

### D62 — Visual acceptance: method, fixes, differences kept
**Method.** The prototype and the app side by side in headless Chrome 153, same origin (the
prototype through Vite's `/@fs/`), at 1440 × 920 and 1280 × 800 (the prototype's window root
resized; the app's viewport), dark and light, en/be/ru. Every state was set on both sides — the
prototype's component state, the app's stores, router and mock services — and compared after
`document.fonts.ready` with finite animations finished: word by word (position, size, font,
colour), icons (geometry, stroke, fill), images and boxes (background, border, radius, shadow),
then pixel by pixel; long screens were compared again scrolled in steps of ¾ of the window;
hover states were forced with CDP mouse events. The first-launch phases were compared with
their loops frozen at 0 (pixel-identical) and by the timing of every running animation and
transition (durations, delays, easings match). 224 states: 152 (screens, filters, dialogs,
downloads, plans, overlays, first-launch steps) in all 12 combinations of theme, language and
size; 20 more (app-page interactions, developer tabs, idea composer, empty favourites) in 9 of
them; 41 hover targets and the 11 first-launch phases in English (dark and light at 1440 × 920,
dark at 1280 × 800) — 4 275 captures with the scrolled ones. Harness artefacts were re-run (a state left by the previous scenario, a page
reload by an edit during a run).

**Fixed:**
- `CountPill`: line height 1.4, the root's value the prototype's pills inherit (1 put the Library
  tab counts 0.2 px lower, a pixel row off).
- `AppIcon`: no `overflow: hidden` on the tile (the prototype has none); the rounded clip made
  Chrome draw every monogram with greyscale instead of subpixel antialiasing.
- `Modal`: `text-wrap: pretty` only on the description `<p>`s, as in the prototype; on the whole
  body it re-wrapped placeholders, fields and the channel catalog ("…Anything that comes / close
  today?" in Suggest an idea).
- `SettingsRow`: hints wrap normally; only the note row and rows with the new `prettyHint`
  (Profile › Delete account) balance the last line (prototype lines 761–790, 945). A Belarusian
  hint at 1280 px broke before "у Windows." instead of after.
- `NotableRow` (Browse › New and notable): the chips are inline content of the text column like
  the prototype's (category chip margin-top 6 on the baseline, channel chip margin 8 0 0 4
  bottom-aligned, category chip `wrap`). A flex row matched on one line only; when the channel
  chip wraps (1280 px, be) the category chip now keeps 6 px and the channel chip its 4 px indent.
- `layout-grid` draws the prototype's rx 1.5 squares (D59 kept lucide's rx 1; the Browse item in
  the sidebar rasterised visibly squarer). 24 stock lucide glyphs and 40 prototype paths now.
- **Belarusian formats in Chromium.** Chromium ships no Belarusian ICU data: WebView2 resolves
  `be` to `ru-BY` (Russian month names, "3 дня назад", "A и B") and Chrome to `en-US`
  ("September 15, 2026", "18.4 MB" — the prototype's "18,4 МБ" differed on every size). Where
  `Intl.DateTimeFormat("be")` does not resolve to `be`, `createFormat("be")` and i18next's
  `number` format apply the CLDR `be` patterns by hand (`i18n/belarusian.ts`); tests compare them
  with Node's full ICU. Plural rules have their data everywhere.
- Test selectors that assumed the row tile was a `button` (D61).

**Kept on purpose** (no change):
- Localised numbers, percents, decimals and prices in be/ru ("43 %", "4,9", "10 000+", "4,99 $";
  CLDR `be` does not group four digits: "3120" where the prototype's data string had "3 120") —
  D13, D31. Belarusian dates and relative times are Belarusian; the prototype printed them in
  English in Chrome for want of ICU data.
- Onest in the top-bar avatar (the prototype's fell back to Arial) — D41.
- Focus: dialogs focus their first field on open (Add channel address, Suggest an idea title), so
  its mint focus border shows; a failed Publish keeps the focus in the title (mint rather than the
  red error border); a menu opened from the keyboard rings its first item — D44, D49.
- The Pro-state plan cards' second pill wraps inside the card — D58.
- Developer-mode rows in Settings › Advanced and the "Back online" toast after a simulated
  outage — D5.
- The first-launch scene scales with the window (`s = min(W/1440, H/920)`, 0.87 at 1280 × 800),
  as `FIRST_LAUNCH_SPEC.md` asks; the prototype's fixed-size scene does not — D50. At 1440 × 920
  every phase is pixel-identical.
- At 1280 px the prototype's Library-row favourite star, a shrinkable flex item beside a name
  that wraps, is squeezed to 2–6 px or to nothing; the app keeps it 12 px (`flex: none`).
- Rendering-only: subpixel versus greyscale antialiasing on some surfaces with identical geometry,
  and structure-only differences (a divider drawn as a border, the split button's radius on its
  halves instead of a clipping wrapper) with no pixel difference.

### D63 — One native resize listener for the window controls (M9)
Found in the real app (`pnpm tauri dev`, M9 acceptance): 6 of 8 cold starts logged
`[TAURI] Couldn't find callback id …`. The window controls subscribe to `tauri://resize` to swap
Maximise / Restore; React's development StrictMode unmounts and remounts that effect while the
window is shown and sized for the first frame, and Tauri's `unlisten` drops the JS callback
before the core hears of it, so the resize emitted in between reached a missing callback.
`platform/window.ts › nativeWindow.onResized` now registers the native listener once, on the
first subscription, keeps it for the life of the window and fans the event out to its
subscribers (a failed registration is retried on the next subscription). Production builds did
not double-mount, but any unsubscribe during a resize had the same race. Regression test:
`platform/window.test.ts` (a fake core that keeps a listener until the unlisten reaches it); after
the fix, 0 of 6 cold starts warned.

## Release

### D64 — Divergences from `STACK.md` found at release
At release, `docs/progress.md` (known gaps and deviations) and `STACK.md` were checked against
this file. The earlier entries already covered the design deviations (D58, D62). This entry
records what no earlier entry had.

- **Tauri plugins.** `STACK.md` lists `notification`, `log` and `os`, and none of them is used.
  Nothing sends a Windows notification (see the settings below). The core logs through `tracing`
  to its own rolling file (`src-tauri/src/logging.rs`, 7 days, INFO and above; CLAUDE.md's
  logging rule), and the UI's console is not captured. No code needs `os`. The tray uses Tauri's
  `tray-icon` feature as `STACK.md` says.
- **Theme "System"** follows the WebView's `prefers-color-scheme`, which WebView2 mirrors from
  Windows live (`app/documentSettings.ts`). `STACK.md` named `window.theme()` +
  `onThemeChanged`. The core reads the Windows setting only to paint the hidden window's
  background before the first frame (D48).
- **Settings that are stored but do nothing yet.** Every row persists and reads back, like the
  prototype's switches, which also did nothing. Nothing acts on these rows yet:
  - App recommendations;
  - Automatic updates (also on the Updates screen), Check for updates (frequency), Download on
    metered networks, Notify when updates are ready;
  - Keep installers after install, Install for current user only (installs are always per user,
    D55), Create desktop shortcuts, Open apps after install, Prefer portable builds;
  - Updates installed, New apps in the catalog, Play a sound;
  - Send crash reports;
  - Install location, whose Change… is a no-op (D39).

  Settings with behaviour: theme, language, start on login, minimize to tray, subtle animations,
  parallel downloads, and the developer-mode rows.
- **CI** (`.github/workflows/ci.yml`) does not use `tauri-apps/tauri-action`. The build job runs
  `pnpm tauri build` itself and uploads the installer (and its `.sig` when the updater key
  exists) with `actions/upload-artifact`. It creates no GitHub release, update bundle or
  `latest.json`, because nothing publishes updates yet (D48). The workflow mirrors
  `pnpm check` step by step. It was validated locally (YAML parsed, every step's command run on
  the development PC) but has not run on GitHub: the repository has no remote yet.
- **CSP images.** `img-src` is `'self' asset: data: blob:` and has no catalog CDN host
  (`STACK.md` › Security posture), because no app carries an `iconUrl`: all 32 fixture apps draw
  their monogram tile. A remote icon would be blocked, and `AppIcon` falls back to the monogram on
  a load error. When the catalog starts serving icons, add its host to `img-src` together with
  the allowlist (`paparats-core::hosts`).
- **Missing WebView2 runtime.** The NSIS installer's download bootstrapper installs the runtime
  where it is missing. The first-launch check and explanation that `STACK.md` › Risks suggests
  was not built. A bare executable on a PC without WebView2 gets Tauri's own startup error.
- **i18n files.** The catalogs are `locales/<lang>/<area>.ts`, one module per screen area (20 per
  language) aggregated per language, instead of `STACK.md`'s `en.ts` / `be.ts` / `ru.ts`. The
  same keys and one namespace; smaller files keep the three languages reviewable side by side
  (`docs/i18n.md` §2).
- **NSIS languages.** The installer offers English and Russian: NSIS has no Belarusian
  translation. The app itself has all three languages.
- **Test servers.** The integration tests (catalog, OAuth, downloads, the app on a local CDN) run
  small hand-written HTTP servers on `tokio::net::TcpListener` rather than `wiremock` / `axum`
  (`STACK.md` › Testing), with no extra dependency tree. No WebdriverIO / `tauri-driver`
  end-to-end suite exists (`STACK.md`: optional, later). Instead:
  - Vitest runs the 14 end-to-end flows through the whole shell on the mock services;
  - the M9 acceptance drove the real WebView2 app over the DevTools protocol with scripts that
    are not part of the repository.
- **Budgets.** Only the installer size is measured and enforced: CI fails at 15 MB, and the
  clean-clone release build is in `docs/progress.md` › Release. Cold start under 800 ms, idle RAM
  under 130 MB, 60 fps transitions and ≥ 500 Mbps downloads (`STACK.md` › Budgets) were not
  measured.
- **Cyrillic width.** Onest is bundled from `@fontsource/onest`, because the app makes no
  runtime font requests. It renders Russian ≈ 2–3 % narrower than the prototype's Google Fonts
  build ('Образование' 87.7 vs 89.6 px, M8). English and Belarusian match, and row and card
  heights are unaffected. Kept.

## Publication

### D65 — Fictional developers in the demo world
The prototype's demo world gave three developer channels to real projects and people, and so does
the code that copies it:
- Nilesoft: a verified channel, the demo user's own developer channel and two idea comments;
- Winaero and its author by name: a channel and a comment that takes an idea;
- mpv builds under the handle of their real maintainer.

Their channel addresses sat on the real domains. Before the repository went public, these became
fictional, so no real person or company appears to run a channel or to have said something on the
ideas board:
- Nilesoft → **Kvetka** (app «Kvetka Shell», channel `kvetka`, `kvetka.example`, monogram `Kv`);
- Winaero → **Vitrazh** (app «Vitrazh Tweaker», channel `vitrazh`, `vitrazh.example`, monogram
  `Vi`, app monogram `Vt`), its author → «Andrei V.»;
- the author of mpv builds → «Yuras L.», with the address `mpvbuilds.example/paparats`, the handle
  `@mpvbuilds` and the support link `mpvbuilds.example/issues`.

The rename covers the handoff's `paparats-proto-data.js` and prototype HTML, the fixtures, the
code, the tests and the docs, so `scripts/port-fixtures.mjs` still reproduces the fixtures. Apps in
the demo catalog, including mpv, stay real: the catalog lists them under their real publishers.
`.example` is the domain that RFC 2606 reserves for documentation, so the demo addresses can never
point at someone's site.

### D66 — Releases from tags and the client's own update
- **Releases.** A tag `vX.Y.Z` runs `.github/workflows/release.yml`. The job checks that the tag
  matches the version in `Cargo.toml`, `apps/desktop/package.json` and `tauri.conf.json`
  (`scripts/version.mjs`) and that `docs/releases/vX.Y.Z.md` exists. It runs the whole gate and
  builds the NSIS installer with its minisign signature. `scripts/release-manifest.mjs` writes
  `latest.json` and `SHA256SUMS`, and the job drafts a GitHub Release with them. A person
  publishes the draft: a published release reaches every installed client.
- **Keys.** The updater key lives in the `release` environment, whose deployment policy admits
  `v*` tags only. The owner keeps an offline copy. The public key is in
  `plugins.updater.pubkey`, and the endpoint is
  `https://github.com/paparats-app/paparats/releases/latest/download/latest.json`.
  `releases/latest` skips pre-releases, so betas ship as ordinary 0.x releases.
- **Hosts.** `paparats-app.github.io`, `github.com` and the two hosts GitHub redirects release
  downloads to are first-party (`paparats-core::hosts`). The `paparats.app` hosts stay until the
  real catalog replaces them.
- **Installing an update** (not in the prototype). Once "Check for updates" has found a newer
  version, the same button reads "Install version …". It calls `downloadAndInstall()`: the
  plugin verifies the download against the pinned key, and the NSIS installer then closes the app
  and starts the new version. A failure shows "Couldn't install the update. Try again later." and
  the button can be pressed again. The tray's "Check for updates" still only reports.
- **Versions.** The first public build is 0.0.1, the demo world, so 0.1.0 with real installs
  is an update for it.

### D67 — The catalog bot and the `paparats-app/catalog` repository
- **Where.** The official catalog lives in `paparats-app/catalog`. People edit `apps/<id>.toml`,
  `editorial.toml` and `icons/<id>.png`; the bot (`crates/paparats-catalog-bot`, binary
  `catalog-bot`) writes `lock.json`. The catalog's workflows build the bot from the commit named
  in its `.github/bot-ref`, so the bot and the client share `paparats-core` types and cannot
  drift apart. GitHub Pages serves the result at `https://paparats-app.github.io/catalog/v1/`.
- **resolve** (daily, Windows runner): latest stable release (or a tag prefix, or pre-releases
  when an app file allows them), the file by the app's pattern, SHA-256 against GitHub's
  `digest`, Authenticode with the signer pinned on first sight (`signer = "auto"`), Microsoft
  Defender. A signer change, a broken or missing signature without `signer = "none"`, a digest
  mismatch or a scanner hit hold the release back and keep the shipped one.
- **Quarantine.** A newer release that passes waits 48 hours as `pending` before it ships; if a
  newer one appears meanwhile, that one starts its own wait. An app new to the catalog ships at
  once, because a person has just reviewed it. The bot commits `lock.json` itself (no pull
  request): its history is the audit log. Held releases, failures, archived repositories and
  Rising projects without a release for 120 days go to one "Bot: needs attention" issue.
- **build**: the four manifests (`channels.json`, `catalog.json`, `platform.json`,
  `official.json`) signed with the catalog key from the `catalog` environment, plus the icons.
  The platform file turns off Pro, accounts, Ideas, channels and reviews. Every package pins the
  file's hash and the signer the bot saw; `unsigned` and `machineWide` come from the lock and the
  app file. The "early" badge is shown only on the Rising shelf, so mature 0.x apps such as
  PowerToys are not called early.
- **Starter content.** 53 apps: the 30 of the starter list and 23 Rising projects, texts in
  en/be/ru, collections (rising, essential, creators, developers, private, desktop, learn-play),
  four Home slides (one leads to the Rising shelf), three Browse banners from the shelf. Icons
  are the apps' own, cropped and scaled to 256 px; 7-Zip has none in its repository and shows
  the monogram.

### D68 — Release 0.1: the real app by default, and nothing made up
- **Real by default.** Without arguments the app runs the real catalog, inventory and installer
  (`RealFlags::RELEASE`); sign-in stays off, as no account service exists. `--demo` or
  `PAPARATS_DEMO=1` runs the demo world of the design; `PAPARATS_REAL` still picks strategies one
  by one. The demo keeps the database 0.0.1 seeded (`paparats.db`); the real app starts its own
  (`library.db`) empty, following only the official catalog and signed out
  (`Storage::seed_local`), so made-up apps never mix into a real library.
- **Hosts and keys.** The catalog comes from `https://paparats-app.github.io/catalog/v1/`, and
  `OFFICIAL_KEYS` pins the primary key and an offline backup (`bcf96ab55a435d41`,
  `ab4411fc923bfada`). First-party hosts are only `paparats-app.github.io`, `github.com` and the
  two hosts GitHub redirects release downloads to; the `paparats.app` hosts are gone (we do not
  own that domain), and the account API is allowed explicitly only for the development-only real
  sign-in. About's links and the demo's sign-up link go to GitHub; `PRIVACY.md` lists every
  request. The CSP's `img-src` admits `https://paparats-app.github.io` for the catalog's icons
  (D64 foresaw this).
- **Features.** `platform.json › features` hides what has no server behind it: Pro (sidebar item,
  badges, Pro notes, Browse's price filter), the account (avatar, Settings › Account, the
  first-launch Account step), Ideas (sidebar, idea links on app pages, "Suggest an improvement"),
  channels (Settings › Sources, source chips and notes, channel pages) and reviews. Routes to a
  hidden screen land on Home (`FeatureGate`). In the mock world everything is on from the first
  frame; in the real app nothing is shown until the platform file says so, so nothing flashes.
- **App pages of the real catalog.** No placeholder screenshots; no generated version history,
  only the current release with the author's notes from GitHub; GitHub facts instead of ratings:
  repository, stars, the project's age, website, "Support the author" links from `FUNDING.yml`;
  chips for an early (0.x) version on the Rising shelf and for the author of Paparats; notes when
  the author signs nothing (the file is checked against the pinned SHA-256) and when the
  installer asks for administrator rights. "Report a problem" opens the project's issues.
- **No mirrors.** `FileHost` keeps only `author`: every file comes from its author's own
  releases. The "mirrored by Paparats" and "Paparats CDN" texts are gone in three languages,
  as are the demo's `files: mirrored` values.
- **Settings that do nothing yet** (D64) are hidden outside Developer mode, and so are sections
  left empty (Apps, Notifications) and Updates' automatic-updates switch. "Check for updates"
  now works: the core refreshes the remote catalog that often and emits `catalog://changed`,
  and the UI reloads the catalog, the platform file, the library and the channels.
- **Open and Folder** (D24) work in the real app: Open starts a portable app's Start-menu
  shortcut (from its receipt) or the program Windows lists in `DisplayIcon`, Folder shows the
  install folder; both hand one path to Explorer. When neither is known a toast says so. The
  demo world still does nothing here.
- **Deferred.** A signed catalog snapshot built into the installer for an offline first run;
  uninstalling apps installed outside Paparats; Windows notifications; automatic updates of
  other apps.
