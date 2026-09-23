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
  "Продуктивность") run past the card's text column. A wrapped channel chip keeps the prototype's
  4 px indent.
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
  prototype also appended the size while paused), "Queued", "Installing…".
- The favourite star shows its pressed state (`aria-pressed`, `--mint2`); the prototype never
  showed it. The average rating is formatted per language ("4,4" in ru/be).
- The Pro card's button is "Learn more" → Subscription (the prototype's copy).
- Report a problem: Send is disabled while the text is blank and the text is trimmed; if sending
  fails the dialog keeps the text and shows no toast (no failure copy in the handoff). The
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
D31 — the prototype kept it). The Library row keeps the prototype's two lines: `line` on top and
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
  identical. The `/dev` gallery follows the same rule.
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
  General; the prototype remembered the last section across navigation.
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
  prototype left the sync text empty (e.g. Winaero right after subscribing).
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
- Copy address copies `channel.addr` exactly as the Address row shows it (`nilesoft.org/paparats`,
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
  glyphs.

### D44 — Ideas board and Suggest an idea
- The status chips and the numbered "How it works" circles are local to `screens/ideas` (only
  Ideas uses them), so no shared `ToggleChip` was added (M1 note closed).
- Tabs follow the view (user: All / New apps / Existing apps / My ideas; developer: All / New
  apps / For my apps / My work); a stored tab the view lacks falls back to All.
- Take (developer view, only on ideas `canTake` allows) pins the idea to the developer channel and
  toasts "Pinned to Nilesoft · author notified" (`screens/shared › useTakeIdea`, shared with the
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
  versions, D12); the prototype accepted anything. The version is prefilled with the app's next
  patch version and recomputed when another app is picked (a typed version is dropped, as in the
  prototype); Release trims it. A failed release keeps the dialog without a toast.
- The release dialog renders nothing until ideas, catalog, channels and account have loaded (so
  the prefill is never "1.0.0" with an empty picker); an unknown `ideaId` closes it.
- Take, Post and Release ignore repeated clicks while their call runs, without a spinner; a failed
  comment keeps its text. Post stays disabled while the text is blank (existing `CommentThread`
  behaviour; the prototype's button was clickable and did nothing) and keeps full opacity.
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
  `hooks/useDeveloperChannel › DEVELOPER_CHANNEL_ID` (`nilesoft`), in one place; it mirrors
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
