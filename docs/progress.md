# Progress log

One entry per milestone.

## M0 — Scaffold (2026-09-23)

- pnpm workspace (`apps/desktop`) and Cargo workspace (`apps/desktop/src-tauri` + seven
  `crates/paparats-*`, empty but compiling, each with a smoke test).
- Tauri 2.11 app from the React + TypeScript template: frameless 1440×920 window (min 1280×800),
  custom window controls and a drag strip, `window-state` and `opener` plugins, strict CSP,
  NSIS per-user bundle with the WebView2 download bootstrapper, icons generated from the brand app icon.
- Typed IPC wired with tauri-specta (`pnpm specta` → `apps/desktop/src/bindings.ts`); one command
  (`app_info`) and the boundary error type `AppError`.
- React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`) + Vite 8; ESLint 10 flat config
  (typescript-eslint strict, react-hooks, no default exports, no direct `invoke` outside
  `services/`), Prettier, Vitest 5 + Testing Library (jsdom).
- Onest 400/500/600/700 bundled from `@fontsource/onest` (Latin + Cyrillic woff2, no runtime requests).
- GitHub Actions on `windows-latest`: all checks, bindings drift check, `tauri build` → NSIS artifact.
- `CLAUDE.md` copied from the handoff's `REPO_CLAUDE.md`.

## M1 — Tokens, shell, plumbing (2026-09-23)

What exists now (structure in `docs/architecture.md`, decisions D5–D17 in `docs/decisions.md`):

- **Tokens and styles.** `styles/tokens.css` holds both themes with bare `[data-theme]` selectors,
  so any subtree can switch theme. It also has brand and on-image colours, type, spacing, radius,
  shadow, layout and motion tokens. `[data-motion="off"]` and `prefers-reduced-motion` zero the
  durations. `global.css` has the base styles, focus ring, scrollbars and shared keyframes;
  `fonts.css` bundles Onest woff2 (latin, latin-ext, cyrillic, cyrillic-ext; 400–700).
- **Shell (`app/`).**
  - `main.tsx` creates the services and runs `bootstrap()` (settings hydrated, theme, motion and
    language applied) before the first render.
  - `App` = providers (TanStack Query, services, i18next, the downloads bridge, the document
    settings, the "Back online" toast) + a memory router with `Layout` around every route.
  - Sidebar: all eight items; Updates count badge; Ideas badge for released-idea notes; Pro pill;
    the active section follows detail pages; fern watermark; footer.
  - TopBar: global search and the avatar (profile initials) to Profile. Window controls with
    minimise, maximise/restore and close; drag regions.
  - Offline banner with Retry, the 420 ms navigation skeleton, the 340 ms enter animation, scroll
    to top on navigation, `ToastHost` (2.8 s) and the `DialogHost` mount point.
  - Theme Light/Dark/System (System follows `prefers-color-scheme` live) and all three languages
    apply instantly from `useSettingsStore`.
  - `useNav()` gives typed `go()`/`back()`: detail pages return to the path they were opened
    from, Browse presets, the Ideas app focus, and leaving Updates clears "Updated just now".
  - `/dev` renders the component gallery in both themes side by side. It is a lazy chunk. Today
    it opens with `#/dev` in a browser (`pnpm dev`); the developer-mode row Settings › Advanced ›
    Component gallery is in the schema and appears with the Settings screen (M4).
- **i18n.** en/be/ru catalogs ported from the data file (20 areas), CLDR plurals, typed keys and
  variables, `useFormat()`/`createFormat()` over `Intl`; `docs/i18n.md` is the reference.
- **Services and queries.** Contracts for catalog, install, downloads, channels, ideas, account,
  settings and system. Mock implementations run over one in-memory world from `fixtures/*.json`
  with the prototype's timings (110 ms ticks, 8-tick install hold, concurrency from settings,
  1.2 s update check). Tauri adapters delegate to the mocks except `system` (D6).
  `queries/` has the query keys, 7 read hooks and 4 action hooks that write results into the
  cache.
- **Domain, stores, hooks.** Pure `domain/*` covers the source rule, install state, updates,
  search, Browse/Library lists, ideas, app-page generators and the settings schema. There are
  nine Zustand stores plus `useDownloadsBridge`, and the derived hooks from architecture §6.
- **Components.** 51 component folders (primitives and composites, table in architecture §9a),
  each with hover/pressed/focus-visible/disabled states and a test, all shown in `/dev`.
- **Tests.** `src/test/render.tsx` (`renderWithProviders`, `renderApp`, automatic cleanup).
  81 Vitest files with 436 tests, plus the Rust crate smoke tests.
- **Checks.** typecheck, lint, test, format, cargo fmt, clippy (`-D warnings`) and cargo test are
  green. `pnpm tauri build --debug --no-bundle` compiles. `pnpm dev` renders the shell in Chrome
  with no console errors, in dark and light, en and ru, online and offline.

Known gaps (by milestone):

- Screens are placeholders that render nothing: Home, Browse, Categories and Search (M2);
  Library and Updates (M3); Subscription, Settings and Profile (M4); Ideas, Idea, Channel and
  App-page flows (M2/M5).
  - Typing in the search shows an empty results area until M2.
  - The Settings rows (including the developer tools of D5) render in M4.
- `DialogHost` has no dialogs registered yet (plan: M4; add channel, trust, report, suggest,
  release: M5). The first-launch scene (`screens/first-launch`) is not mounted (M6).
- Wiring left to the screens:
  - Unsubscribing or pausing a channel should call `useBrowseStore.dropSource(id)` (M5).
  - Uninstall should call `useDownloadsStore.clearJustUpdated(id)` (M3).
  - The "Parallel downloads" select must pass a number (M4).
  - Claiming the idea bonus should dismiss the shown release notes (M5).
- The developer-view avatar (channel monogram) waits for the developer channel to be exposed
  through the services (M5, D16). `ToggleChip` (Ideas status chips) and the numbered
  "How it works" circles are not built yet (M5).
- `Popover`/`Menu` have no portal or collision handling: their containers must not clip them.
- The main JS chunk is ≈ 505 kB minified (fixtures and three catalogs; Vite warns above 500 kB).
  Revisit code-splitting when real data replaces the fixtures.
- The `/dev` gallery tests take 3–6 s in jsdom and run with a 20 s timeout.

## M2 — Discovery (2026-09-23)

What exists now (decisions D26–D32 in `docs/decisions.md`):

- **Home** (`screens/home`). The hero carousel over `catalog.heroSlides` (slide kept in
  `useHomeStore`, glow wired to `useHomeStore.heroGlow` for M6), Featured apps (6 columns),
  Collections, New and notable, Recently updated (the six newest visible apps). Every "See all"
  and the hero CTAs reach their screen.
- **Browse** (`screens/browse`). Banner (or the open collection's title), the curated view
  (featured-app hero with "Get <App>", Featured apps, New and notable, Top categories) and the
  results view ("N apps", Clear all, 5-column grid), beside the sticky filter panel: category
  checkboxes with "Search filters…", Pro features, Portable build, Source (with more than one
  active channel, per-channel counts), Sort by Featured / Newest / A–Z / Size.
- **Categories** (`screens/categories`). Nine photo tiles with counts → Browse filtered to the
  category; Featured in Productivity; the brand line.
- **Search** (`screens/search`). Results over name, publisher, tagline, category and source
  channel in the UI language; the 6-card skeleton while "Searching…" (and while data loads);
  "Nothing found" with four featured suggestions and a Categories link; the offline state with a
  way to the Library.
- **App page** (`screens/app`, `/app/:appId`). Header with source chip → channel, source notes
  ("verified/community channel", "Also offered by"), the split action with favourite star,
  progress bar and status line with Cancel; screenshots; About with the Pro and "Grew from an
  idea" cards and the ideas link; Details with Report a problem and Suggest an improvement;
  ratings (tap to rate), reviews, version history, "More in “<collection>”"; "App not found" for
  unknown ids. Back returns to the section (and filters) the page was opened from.
- **Report dialog** (`app/dialogs/ReportDialog`, registered in `DialogHost`): routes to the
  channel author with a copy to Paparats, or to the Paparats team; toasts the receipt.
- **Shared pieces.** `screens/shared › StoreAppCard` (+ `useStoreAppView`, `toActionView`) is the
  one connected store card; `hooks/useLocale`; `domain/apps.ts › pickByIds`. Component additions:
  `EmptyState.wideHint`; `SplitButton` draws the prototype's 14 px / 16 px stroke-2 glyphs and
  its action paints its own ground (hover brightens it); `SectionHeader` "See all" has a 32 px hit
  area; `AppCard` keeps a wrapped channel chip's 4 px indent; `NotableRow` and `RatingSummary`
  spacing fixes; `CompactUpdatedRow` icon radius 10.
- **Rust backend (D26).** Every `services/tauri/*` adapter calls its Rust command; downloads
  follow the typed `download://progress` / `download://state` events; settings persist in
  `settings.json` (tauri-plugin-store). `downloads_set_concurrency` takes a `u32` (capped at 255).
- **Tests.** Vitest: 88 files, 563 tests — screen smoke and flow tests for all five screens and
  the report dialog, the Tauri adapters over `mockIPC` (66), and `app/discovery.test.tsx`, which
  runs the M2 flows through the whole shell and fails on any console error or warning. Rust:
  126 tests (32 in `paparats-desktop`, including download parity with the TypeScript mock and IPC
  tests).
- **Checks.** typecheck, lint, test, format:check, cargo fmt, clippy (`-D warnings`) and cargo
  test are green. Clicked through in Chrome on `pnpm dev` (mock services) and in the real app
  (`pnpm tauri dev`, Rust backend, driven over the WebView2 debugging port): sidebar navigation
  from Home, Browse, Categories, an app page and the search overlay to all eight sections; detail
  pages back to their section with Browse filters kept; every Browse filter, the filter search,
  sorting and both Clear all; Categories → Browse; search skeleton, results, empty state,
  suggestions and offline; Get → progress events → Pause → Resume → Cancel, favourite, report.
  No console errors in either.

Known gaps (by milestone):

- Library and Updates are still placeholders (M3); Subscription, Settings, Profile (M4);
  Ideas, Idea, Channel, the suggest-idea dialog (the app page opens `{kind:'suggestIdea'}`, which
  renders nothing yet) and the other channel dialogs (M5); first launch and the hero glow (M6).
- No catalog error state (no copy in the handoff); no failure toast for a report that cannot be
  sent.
- M1 token choices that differ slightly from the prototype on images: hero and
  `ScreenshotViewer` text use `--on-image` (#eef3f2) where the prototype has #f2f4f2 / #e6ecec.
- Cyrillic text renders 1–6 px narrower than in the prototype (the prototype falls back to
  another font where Onest has Cyrillic); Latin text matches to the pixel.
- The dev data set in `%APPDATA%/com.paparats.desktop` (SQLite, `settings.json`) carries changes
  from the M2 checks (files installed, Obsidian updated); delete the folder to reseed (D22).
- The main JS chunk is now ≈ 544 kB minified (the M2 screens on top of the fixtures and three
  catalogs; the mock world is still bundled in Tauri builds). Split the mock services and
  fixtures into a lazy chunk before release.

## M3 — Library, Updates, download engine (2026-09-23)

What exists now (decisions D33–D37 in `docs/decisions.md`):

- **Updates** (`screens/updates`). Banner with the count line ("6 updates available", "Can't check
  for updates while offline.", "Everything is up to date") and the manifests' total size; Update
  all (a batch over `startBatch`, `kind: update`, manifest sizes); while it runs "Updating X of N"
  with the percentage, the 6 px bar, Pause all / Resume all and Cancel all. Rows (pending updates
  plus "Updated just now") with the version step or the live download line, size, the app action,
  the 3 px bar, the source chip and the expandable "What's new" (VS Code and Obsidian open) with
  "View details →". Side column: Automatic updates toggle, Update settings (→ Settings › Updates),
  Update history (expands), promo card. Empty state with the mint check. Leaving the screen clears
  "Updated just now".
- **Library** (`screens/library`). Banner with Install app (→ Browse, filters reset); tabs
  Installed / Favorites / Collections with counts; Sort by Recently used / A–Z / Size; list and
  4-column grid. List rows: icon, name with the favourite star, tagline, category and
  Pro/Portable/license chips, source chip, version with "Updated …" or "Update → x", the app
  action, the ⋯ menu (favourite, Open install folder, Uninstall) and the 2 px bar with the
  download lines while queued. Collections tab: collection cards → the filtered list with the
  "All collections / Work" breadcrumb. Right column: stats, collections list, quick filters (All /
  Updates available / Downloads / Favorites), the quote. Empty states: empty library (→ Browse),
  no favourites, no active downloads, up to date, nothing found.
- **Download engine end to end.** Every Get / Update / Update all goes through
  `useDownloadsStore` → DownloadService (mock timers in the browser, the Rust engine with typed
  `download://progress` / `download://state` events in Tauri). Parallel downloads follow
  `settings.parallel` live; pause/resume/cancel per item and for all; offline freezes running
  items and blocks Get/Update ("Offline", toast), Retry resumes them; uninstall clears the app's
  "Updated just now" marker and drops it from Updates and the sidebar badge.
- **Shared pieces.** `screens/shared › useDownloadStatus` / `downloadStatus` (one status line for
  the app page, Updates and Library, D34). Component additions: `Tabs.onReselect`,
  `StatTile.tight`, `SegmentedControl.iconStrokeWidth` and a 32 px hit area on its 30 px options;
  `LibraryRow` (radius-10 tile, menu 4 px under the trigger, `folder` glyph) and `LibraryGridCard`
  tile fixes; Library/Updates row names wrap like the prototype; `PromoCard` text #f2f4f2; the
  on-image `ProgressBar` track is white 14 % (D37). New i18n keys `library.viewAs`,
  `library.moreActionsFor` (`app`), `library.signature` in en/be/ru.
- **Tests.** Vitest: 93 files, 605 tests — Library (16) and Updates (14) screen tests with fake
  timers, `downloadStatus` unit tests, and `app/libraryUpdates.test.tsx`, which runs the M3 flows
  through the whole shell and fails on any console error or warning: Update all landing everywhere
  (rows, badge, toast, Library, markers cleared on leaving), one download paused in Updates and
  resumed in the Library, uninstall reaching Updates and the badge, the Library's views across
  navigation and the app page, and offline (banner, Retry, inert Get/Update, frozen and resumed
  downloads). Rust: 126 tests.
- **Checks.** typecheck, lint, test, format:check, cargo fmt, clippy (`-D warnings`) and cargo
  test are green; `pnpm specta` produces no bindings drift. Clicked through in Chrome on `pnpm dev`
  (mock services) and in the real app (`pnpm tauri dev`, Rust backend, driven over the WebView2
  debugging port): expand/collapse release notes; Update all → per-row progress → "Updated just
  now" → badge 5→0 → "All updates installed"; Pause all / Resume all / Cancel all; Parallel
  downloads 2 → 1 → 4 while a batch runs; Library tabs, three sorts, list/grid, a collection and
  its breadcrumb, all quick filters and their empty states, Open, Open install folder, favourite
  on/off, uninstall with its toast, app page and Back; Simulate offline (banner, Retry, "Offline"
  buttons, a frozen download that resumes and lands). Layout compared by script with the prototype
  at 1440×920 (rows, grid tracks, batch bar, promo) in dark; colours checked in light. No console
  errors in either. The dev data set in `%APPDATA%/com.paparats.desktop` was backed up before the
  real-app checks and restored afterwards.

Known gaps (by milestone):

- The Settings screen is still a placeholder (M4): Parallel downloads and Developer mode ›
  Simulate offline were driven through `useSettingsStore` in the checks. The "Parallel downloads"
  select must pass a number (M1 note, still open).
- Creating and editing collections is not designed: + and "New collection" do nothing (D36).
- "Open install folder" and "Open" are no-ops on the Rust side for now (D24: until M6/M7).
- No failure copy for a failed download or uninstall (D8, D36): the item disappears silently.
- The Library re-renders on every download tick (≈ 9 Hz) through its item subscription; fine for
  a few dozen rows, revisit for large libraries.
- Belarusian was not compared visually; Cyrillic text still renders 1–6 px narrower than in the
  prototype (M2 gap). The ⋯ menu and Popover have no portal (M1 gap).
- The main JS chunk is now ≈ 564 kB minified (≈ 172 kB gzip); the mock services and fixtures are
  still bundled in Tauri builds.

## M4 — Account surfaces (2026-09-23)

What exists now (decisions D38–D41 in `docs/decisions.md`):

- **Subscription** (`screens/subscription`). The xl banner with the lead, the body, the motto and
  "Get Paparats Pro" (→ the monthly confirmation) or, while Pro, the status chip
  ("Paparats Pro Monthly · Active", "Paparats Pro · gift · Active"); "Learn more" → Settings ›
  About. The benefit strip; the three equal-height plan cards with prices from the platform
  data, the current plan's mint border and disabled "Current plan", "Choose plan" (→ the
  confirmation) and "Cancel plan" on the Free card while a paid plan is active; "Popular apps with
  Pro features" (5 link cards → the app page, "See all" → Browse with the Pro filter). Side
  column: Your impact, the quote, the ecosystem numbers, the Pro status card (plan, Active, price,
  "Renews on …" / "Idea bonus · active until …", or the hint and Upgrade).
- **Plan dialog** (`app/dialogs/PlanDialog`, registered in `DialogHost`): "Confirm Paparats Pro
  Monthly/Yearly" with the charge and the renewal date, Cancel/Escape, Confirm → purchase → toast
  "Welcome to Paparats Pro". The plan in effect reaches the sidebar Pro pill, the banner chip, the
  Subscription status card and the Profile Pro card at once (`screens/shared › useProStatusView`).
- **Settings** (`screens/settings`, `/settings/:section?`). The 250 px section nav and all ten
  sections: the eight row cards from the settings schema (theme, language, toggles, the check
  frequency and Parallel downloads selects, the install path, Clear search history, the Profile /
  Subscription links, Sign out, the developer-mode tools of D5 and the component gallery), the
  Sources placeholder (its panel arrives in M5) and **About** (version line, Check for updates →
  "Checking…" → toast, What's new → Updates, the principles, the links and the footer opening in
  the default browser). Theme and language apply to the whole window at once; Parallel downloads
  changes the running queue live; Start on Windows login goes through `setAutostart`.
- **Profile** (`screens/profile`). Banner; the header card with the initials, "Member since" and
  edit mode (Save → the account service → toast "Profile saved", header, rows and the top bar's
  initials follow; blank fields are refused inline); the underline tabs Account (five rows that
  open edit mode, the promo card), Preferences (theme, language), Security (password, two-factor
  switch, active sessions counting the devices), Devices ("This device", Remove), Data & Privacy
  (Export…, Delete…, both inert). Right column: the Pro card (free / plan / idea gift, Manage or
  Upgrade → Subscription), usage tiles, Recent activity (→ Updates). The tab, edit mode and draft
  survive navigation (`useProfileStore`).
- **Shared pieces.** `screens/shared › useProStatusView` (+ `PERIOD_KEYS`); stores
  `useProfileStore`, `useFirstLaunchStore` (Replay first launch, for M6); `queries/system.ts ›
  useSystemActions`, `useSettingsActions`. Component additions: `SettingsRow` `disabled` (action)
  and `selectedMark` (language); `ProfileHeader` `editButtonRef` / `nameInputRef`; parity fixes in
  `BenefitStrip`, `SubscriptionPlan`, the link `AppCard`, `StatTile` and `ProfileHeader` (D41).
  Tokens `--on-image-mint`, `--on-image-mint-ground`; `--font-mono` now lists Consolas first. New
  i18n keys `settings.signedOut`, `settings.notSignedIn`, `settings.sectionsLabel`,
  `about.updateAvailable` (`version`), `profile.sections`, `profile.changePhoto`,
  `profile.nameRequired`, `profile.emailRequired`; `profile.sessionsHint` became a plural
  (`count`); `subscription.testimonialBy` now carries its dash. The "Parallel downloads" select
  passes a number (M1 note closed).
- **Tests.** Vitest: 100 files, 672 tests. The M4 screens: Subscription (9), the plan dialog (8),
  Settings (13), Settings in the shell (4), About (7), Profile (17), and `app/account.test.tsx`
  (5), which runs the M4 flows through the whole shell and fails on any console error or warning:
  a plan bought on Subscription reaching the sidebar, the status card and the Profile card and
  cancelled again; all ten Settings sections, theme and language applied at once, Parallel
  downloads 2 → 4 → 1 reshaping a live queue; About's update check; Profile tabs, Edit → Save →
  toast and avatar, device removal, Data & Privacy. Rust: 126 tests.
- **Checks.** typecheck, lint, test, format:check, cargo fmt, clippy (`-D warnings`) and cargo
  test are green; `pnpm specta` produces no bindings drift.
  - Chrome on `pnpm dev` (mock services, driven by script): Choose plan → dialog → Confirm →
    toast, the plan current, the Pro pill in the sidebar, the banner chip, the status card and the
    Profile card, Cancel plan back to Free; all ten Settings sections; Light/Dark and en/ru/be
    applied at once and persisted; Parallel downloads 1 → 4 during Update all (1 downloading +
    5 queued → 4 + 2) with the batch landing and its toast; Check for updates → "Checking…" →
    "You're up to date!", What's new; Clear search history, Sign out, the developer-mode rows;
    Profile tabs, Edit → Save → toast and avatar, Remove device (the sessions hint then says
    "1 device signed in."), Export…/Delete… inert.
  - The real app (`pnpm tauri dev`, Rust backend, driven over the WebView2 debugging port): the
    yearly purchase (renewal date from the core's local today in the dialog, the status card and
    the Profile card, sidebar Pro pill); all ten sections; Light/Dark and en/ru persisted to
    `settings.json`; Parallel downloads 1 → 4 on the Rust queue during Update all (1 + 4 queued →
    4 + 1) landing with the toast; Check for updates; Profile tabs, Edit → Save → toast and
    avatar, Remove device, the two-factor switch, Export…/Delete… inert.
  - No console errors in either. The install path now measures 178.69 px, as in the prototype.
    The dev data set in `%APPDATA%/com.paparats.desktop` was backed up before the real-app checks
    and restored afterwards.

Known gaps (by milestone):

- Settings › Sources is a placeholder with its title (M5); Ideas, Idea, Channel and their dialogs
  (M5); the first-launch scene, the hero glow and Replay first launch doing something visible
  (M6).
- After Settings › Sign out nothing signs back in until first launch (M6) / PKCE (M7); in the
  real app the signed-out state persists in `paparats.db` (reseed the data set, D22). The top bar
  and Profile do not show a signed-out state (the prototype has none).
- No-ops kept from the prototype: Install location "Change…", Network proxy "Configure…",
  Change photo, Password "Change…", "Sign out everywhere", Export…, Delete…. Autostart and the
  search history have no Rust side yet (`setAutostart` and `clearSearchHistory` resolve without
  doing anything). The About links point at placeholder `https://paparats.app/…` addresses.
- No failure copy for a failed purchase, cancel, profile save, device removal or update check:
  each returns quietly (D38–D40).
- Shared-component behaviour that differs slightly from the prototype and was left as it is:
  the selected language option keeps its mint border on hover; Toggle's hover brightness and
  pressed knob; the 1 px pressed nudge on buttons; AppIcon's 34 px tile keeps -0.02em tracking;
  the destructive button's hover ground is `--danger` at 10 % (the prototype used
  rgba(224,91,60,.1)).
- Cyrillic text still renders 1–6 px narrower than in the prototype (M2 gap); the wrapped ru
  Profile tab label sits 1.3 px right of the prototype's.
- The main JS chunk is now ≈ 595 kB minified (≈ 181 kB gzip); the mock services and fixtures are
  still bundled in Tauri builds.

## M5 — Channels and Ideas (2026-09-23)

What exists now (decisions D42–D47 in `docs/decisions.md`):

- **Settings › Sources** (`screens/settings/sources`). The header with Add channel; one card with
  the followed channels in catalog order (monogram, trust badge, "Developer · by Kvetka · 1 app",
  "Synced today" / "Not synced yet" / "Unreachable for 16 days" in `--warn`, "Always on" for the
  official catalog, the pause switch — paused rows at .55 — and the chevron to the channel page);
  the stale callout (unreachable ≥ 14 days, not kept) with Keep / Unsubscribe; the three "Trust
  levels" cards.
- **Add channel** (`app/dialogs/AddChannelDialog`): the address field (full address, host,
  `@handle` or handle) with Add / Enter and the two inline errors ("No channel at this address…",
  "You already follow this channel."), then the catalog of channels not followed yet with Learn
  more and Subscribe. A verified channel is followed at once ("Subscribed to <Channel>"); a
  community channel opens **the trust confirmation** (`TrustConfirmDialog`, "Add <Channel>?"),
  and Cancel returns to the dialog with the address typed. The confirmation also stands alone for
  `{kind:'trustConfirm'}` (a card's or the channel page's Subscribe).
- **Channel page** (`screens/channel`, `/channel/:channelId`). The 96 px tile, name, trust badge,
  kind chip, "by … · @handle · N subscribers", the description; Subscribe (community → the
  confirmation) or "Subscribed" + Enabled/Paused + Unsubscribe (not for the official catalog);
  Copy address, Report a problem (the report dialog, routed to the channel's author), Sync now
  ("Channel synced" / "<Channel> is still unreachable"); the stale callout; the Pro / official
  notes; the Details card (Trust, Type, Author, Address, Files, Review, Support, Last sync, the
  community warning); "Apps in this channel" as store cards, or the empty card; "Channel not
  found" for unknown ids. Back returns to where the page was opened from (Settings › Sources too).
- **Ideas** (`screens/ideas`). Banner with Suggest an idea (and the "Developer view · Kvetka"
  pill); the "Your idea became an app" note (Open <App>, Activate 3 months of Pro, ×); boxed
  tabs with counts per view, the Open / In work / Released chips, Top/Newest; the "Filters: For
  <App> ×" chip from an app page; idea cards (vote/unvote, open, Take in the developer view);
  right column: the developer panel with three numbers, How it works, Your ideas with the
  Activate rail. Activating the gift dismisses the notes, clears the Ideas badge and makes Pro
  appear in the sidebar, on Subscription and on Profile.
- **Suggest an idea** (`app/dialogs/SuggestIdeaDialog`): New app (category) / Improve an app
  (visible apps A–Z, the app page's app preselected), title ≥ 6 characters with the inline error,
  description; Publish → the idea page and "Idea published — developers can see it now".
- **Idea page** (`screens/idea`, `/ideas/:ideaId`). The 72×76 vote button, kind chip, status pill,
  "by … · date", title and body; the status card (developer and hint, the released app with Open
  and the author's thank-you; in the developer view Take this idea, Mark as released or "In work at
  <developer>"); the Proposed · In work · Released timeline; the discussion with "You", Author and
  "Developer · <Channel>" badges and the composer (as the channel in the developer view).
- **Release** (`app/dialogs/ReleaseIdeaDialog`): the developer's app (select for a new-app idea,
  fixed for an improvement), the version prefilled with the next patch, "<Author> and N voters
  will be notified…", Release → "Released · N people notified".
- **Developer view.** `hooks/useDeveloperChannel` (the channel the view acts as, D46); the top bar
  avatar shows the channel's monogram on its tint (D16 closed).
- **Shared pieces (D47).** `hooks/useChannelFollow` (every follow/pause/unsubscribe/keep with its
  toast and the Browse source filter, also behind a card's Subscribe); `screens/shared ›
  channels.ts` (`KIND_KEY`, `HOST_KEY`, `TRUST_LEVELS`, `channelIcon`, `useChannelMeta`),
  `useIdeaView`, `useTakeIdea`, `BackLink`; `components/TrustBadge › TRUST_KEY`. Component
  additions: `StoreAppCard.channelChip`, `TrustBadge.iconSize`; parity fixes in `WarnCallout`,
  `ChannelRow`, `Modal` (form ×), `CommentThread` (Post) and the `IdeaCard` Take hit area. Token
  `--r-17`. All five M5 dialog kinds are registered in `DialogHost`.
- **Rust backend.** The channel and idea commands already existed (D26); the Tauri adapters call
  them (`services/tauri/channels.ts`, `ideas.ts`), nothing new to wire.
- **Tests.** Vitest: 111 files, 776 tests. M5: Sources (10), Add channel (14), trust confirmation
  (5), channel page (18), Ideas (16), Suggest an idea (8), idea page (19), `ideaDetail` (3), the
  release dialog (7), `useDeveloperChannel` (1), and `app/channelsIdeas.test.tsx` (3), which runs
  the M5 flows through the whole shell and fails on any console error or warning: adding channels
  by address, by handle (community → confirmation) and from the catalog; Browse gaining the Source
  group; the app page's install-source rule following a follow and a pause; the stale callout,
  Sync now, Copy address, the report, Keep, pause and unsubscribe on the channel page; proposing
  (short title refused), unvote/vote, commenting; the developer view (avatar, Take, Mark as
  released with a version); the author's note, Activate and Pro on the sidebar, Subscription and
  Profile. Rust: 126 tests.
- **Checks.** typecheck, lint, test, format:check, cargo fmt, clippy (`-D warnings`) and cargo
  test are green.
  - Chrome on `pnpm dev` (mock services, driven by script): Add channel — not found, already
    followed, `@vitrazh` → confirmation → Cancel (address kept) → Add channel, `mpvbuilds.example/paparats`
    → confirmation; Browse's Source group with per-channel counts; Vitrazh Tweaker's "Also offered
    by Vitrazh" and its disappearance after pausing Vitrazh; FOSS Friends: the stale callout, Sync
    now, Copy address (clipboard stubbed: the background tab has no focus), the report, Keep;
    Kvetka: pause/resume, unsubscribe, subscribe; Suggest an idea (short title refused, publish
    → page and toast), unvote/vote, a comment; Settings › Advanced → Developer mode → View Ideas as
    a channel developer (avatar "Kv" on the channel tint, the pill, the developer tabs), Take on
    the board, Mark as released with 1.10.0; developer mode off → the note → Activate → toast, Pro
    pill, Ideas badge cleared, "Paparats Pro · gift" on Subscription and Profile. No console
    errors.
  - The real app (`pnpm tauri dev`, Rust backend, driven over the WebView2 debugging port): the
    same Sources, channel-page and Ideas flows end to end with no console errors (FOSS Friends
    reads 24 days there: the core's local today, D21; the gift runs to 23 December 2026).
    The dev data set in `%APPDATA%/com.paparats.desktop` was backed up before and restored after.

Known gaps (by milestone):

- Copy address in the real app was not confirmed: driven over the debugging port without OS
  focus, WebView2's `navigator.clipboard.writeText` never settles (no toast, nothing copied). A
  user's click focuses the window; check it by hand once (Vitest covers the flow with a spy).
- The first-launch scene, the hero glow and Replay first launch doing something visible (M6).
- No failure copy for a failed subscribe, pause, lookup, sync, copy, vote, take, comment, publish,
  release or activation: each returns quietly (D42–D45).
- `VoteButton`, `IdeaCard` (comment count), `RatingSummary` and `ReviewCard` format numbers with
  `Intl.NumberFormat(i18n.language)` inside the presentational components (M1); the output equals
  `useFormat().number` for every language, but it bypasses the formatter.
- Cyrillic text still renders 1–6 px narrower than in the prototype (M2 gap); Belarusian was
  checked by tests, not visually.
- The main JS chunk is now ≈ 635 kB minified (≈ 192 kB gzip); the mock services and fixtures are
  still bundled in Tauri builds.

## M6 — First launch and polish (2026-09-23)

What exists now (decisions D48–D51 in `docs/decisions.md`):

- **First launch** (`screens/first-launch`, D50). The Kupalle night scene over the whole window:
  seed → fern (120 ms) → part (1400) → bloom (2800) → logo (4300) → lang (5400), with the spec's
  layers, easings and durations (per-phase values in `scene.ts`, transitions in CSS), scaled by
  `min(W/1440, H/920)`. A click on the scene or `››` skips to the language step. Steps: Language
  (each card in its own language, applied at once), Appearance (Light / Dark / System miniatures,
  applied at once), Account (email + password, Sign in, Later, "No account? Create one"); Back and
  the step indicator. The finish writes `localStorage › paparats.firstRun` {seen, locale, theme,
  at}, hands over to Home with the hero glow (1.7 s), fades the overlay (unmounted at 1.5 s), moves
  the focus to the content column and, after Sign in, toasts "Signed in as …" at 1.6 s. It plays at
  startup unless the record says it was seen (`bootstrap()` → `useFirstLaunchStore.launch()`) and
  again from Settings › Advanced › Replay first launch; reduced motion or Subtle animations off
  start at the language step with nothing moving. While it plays the rest of the window is inert,
  an invisible drag strip keeps the frameless window movable, and a `paparats://` link waits for the
  finish. New: `platform/storage.ts` (`localStore`), the `--fl-*` night palette in `tokens.css`.
- **Windows integration** (`src-tauri/src/shell.rs`, `window.rs`, `tray.rs`, `deep_link.rs`,
  `autostart.rs`; D48). Tray icon with Open Paparats · Check for updates · Quit in the UI language;
  Minimize to system tray (the × and Alt+F4 hide the window); start on login through
  tauri-plugin-autostart (`--minimized`, release builds only); a single instance (a second launch
  brings the first window forward); `paparats://app/<id>` and `paparats://channel/<id>` (the link
  that started the app is kept until the UI listens); the window created hidden on the theme's
  background and shown after the first frame, with its size, position and maximized state kept;
  capabilities narrowed to an app manifest (`allow-<command>` per command) plus single plugin
  permissions; the updater check (`updates.paparats.app`, placeholder public key); the signing hook
  `scripts/sign-windows.mjs` (Azure Trusted Signing or a PFX, unsigned without credentials); CI
  signs when the secrets exist and fails an installer of 15 MB or more. `export-bindings` became a
  Cargo example, so the installer carries one executable. UI side: `platform/shell.ts ›
  nativeShell`, `app/useNativeShell` (providers), `app/useDeepLinks`, `app/useTrayActions`.
- **Keyboard, focus, disabled and loading states** (D49). Every control has a visible
  `:focus-visible` ring (inset where it would be clipped, the mint border on text fields,
  `--cta-mint` on photos); 32 px hit targets for `xs` buttons from `Button`; `Modal` traps Tab,
  pulls escaping focus back and closes on Escape from anywhere; a navigation from inside the content
  focuses the content column; keyboard presses on buttons replaced by their result hand the focus
  on; window controls last in the tab order. `Button loading` (spinner over the label after 150 ms,
  width kept, `aria-busy`), `screens/shared › useBusyAction`, busy/double-submit guards on every
  async action; "Offline" actions `aria-disabled` but still answering with the toast; one polite
  live region for toasts; repeated labels described by their row / channel / plan.
- **Integration** (D51). The three engineers' `Layout.tsx` edits merged; the first-launch palette
  moved from the CSS module to `tokens.css`; the hero carousels' `aria-roledescription` translated
  (`common.carousel`); the focus hand-over after the first launch and the waiting deep link added
  (both tested).
- **Tests.** Vitest: 131 files, 892 tests. M6: `scene.test.ts` (7), `useFirstLaunchStore.test.ts`
  (12), `FirstLaunch.test.tsx` (15, fake timers, including a whole-shell run with the focus
  hand-over), `app/nativeShell.test.tsx` (links, the link waiting for the first launch, tray
  actions, tray language and first frame over `@tauri-apps/api/mocks`),
  `services/tauri/system.test.ts`, `useBusyAction`, and a keyboard/a11y smoke test per screen
  (`<Name>Screen.a11y.test.tsx`, `app/shell.a11y.test.tsx`). Rust: 164 tests (the shell, tray
  labels, link parsing, stored settings, window background vs `tokens.css`, capability ↔ commands
  ↔ bindings, updater endpoints on the allowlist, the installer's scheme).
- **Checks.** typecheck, lint, test, format:check, cargo fmt, clippy (`-D warnings`) and cargo
  test are green.
  - Chrome on `pnpm dev` (mock services, keyboard driven): with an empty `localStorage` the scene
    played to the language step with the shell inert; Русский and Light by keyboard applied at
    once and persisted; Later → Home with the focus on the content column and the record
    `{seen, ru, light}`; a reload did not replay it and kept ru/light; Settings › Advanced →
    Developer mode → Replay first launch played it again from the start; with Subtle animations off
    it opened on the language step with no animation or transition running. A focus audit (every
    tabbable control focused after keyboard input: `:focus-visible` with a 2 px ring, or the mint
    border on fields) passed on the eight sidebar screens, the app, channel and idea pages,
    Profile and search results. No console errors.
  - The real app (`pnpm tauri dev`, Rust backend, driven over the WebView2 debugging port): the
    scene played on an empty WebView2 profile; Русский and Light by keyboard reached
    `settings.json`; Later landed on Home. The tray icon is live (UI Automation finds "Paparats"
    in the notification-area overflow); the × hid the window with the process still running; a
    second launch of the executable exited and brought the first window back, visible and in the
    foreground; `Start-Process paparats://app/obsidian` opened the Obsidian page;
    `paparats://channel/kvetka` sent during a replayed scene opened the channel page as the
    exit began. The app log has no warnings. The dev data set in `%APPDATA%/com.paparats.desktop`
    was backed up before and restored after; the WebView2 `localStorage` was emptied again.
  - `pnpm tauri build`: `target/release/bundle/nsis/Paparats_0.1.0_x64-setup.exe`, 3 070 474 bytes
    (2.93 MiB), per-user (`RequestExecutionLevel user`), registers `paparats://`, unsigned (no
    credentials on this machine); the app executable is 6.79 MiB.

Known gaps:

- The installer was built but not installed here: the per-user install, start on login
  (registered by release builds at startup) and the installed scheme were not exercised end to end.
- Updates: `plugins.updater.pubkey` is a placeholder and nothing downloads or installs an update
  yet; the tray's "Check for updates" was checked by tests, not in the real app. The tray menu's
  translated labels were not looked at on screen (Rust tests cover them).
- During the first launch the window controls stay covered (prototype parity, D50): close and
  minimise through Alt+F4 and the taskbar.
- Reduced motion from the OS was checked by a unit test (matchMedia stub) and CSS review; the
  browser check used Subtle animations off. A frame-by-frame comparison of the scene's motion with
  the prototype was not possible (the checking tab was in the background); end states per phase
  were compared by the first-launch engineer.
- Focus is not handed on when a whole row or block disappears (Library ⋯ → Uninstall, the stale
  callout, the Ideas note ×, an idea card's Take, Cancel plan): the next Tab continues nearby, but
  nothing shows focus until then. `UpdateRow`'s icon tile is a `tabIndex=-1` button with
  `aria-hidden`.
- Running the development build registers `paparats://` for the dev executable in
  `HKCU\Software\Classes\paparats` (D48); on this machine it now points at `target/debug`.
- Cyrillic text still renders 1–6 px narrower than in the prototype (M2 gap). The main JS chunk is
  ≈ 660 kB minified (≈ 200 kB gzip); the mock services and fixtures are still bundled in Tauri
  builds.

## M7 — Real strategies behind flags (2026-09-23)

What exists now (decisions D52–D57 in `docs/decisions.md`). Without `PAPARATS_REAL` the app is
M6's; nothing in the UI changed.

- **Flags and wiring** (`src-tauri/src/flags.rs`, `services/wiring.rs`; D52). `PAPARATS_REAL` =
  `inventory`, `install`, `catalog`, `account` or `all`, read once at startup; a strategy that
  cannot start falls back to the simulated one and the log names what runs. Catalog, library,
  channel and account commands became async; inventory reads run on the blocking pool; a startup
  task refreshes the remote catalog, warms the inventory and refreshes the signed-in profile.
- **Real inventory** (`paparats-inventory › RegistryInventory`; D53): Uninstall keys (HKCU, HKLM
  64/32-bit), the user's MSIX packages and Paparats' portable folder, matched to catalog apps by
  detection rules that now travel with the catalog (`App.detection`, all 32 fixture apps);
  highest version wins, catalog spelling when equal; "last used" from UserAssist, folder times and
  install dates; 10 s cache; the local database becomes its journal. Uninstalling an app Paparats
  did not install is refused. UI: `domain/versions.ts` compares versions numerically, so an app
  newer than the catalog is "installed", not an update (the mock data set reads the same).
- **Real installers** (`paparats-install › StrategyInstaller`; D55): MSI (`msiexec /i … /qn
  /norestart`, per user, elevation only for an explicit machine-wide install), EXE silent (the
  manifest's argument vector, 30 min timeout, exit codes mapped), MSIX
  (`AddPackageAsync`, `ForceTargetApplicationShutdown`), portable ZIP (zip-slip-safe staged
  extraction to `%LOCALAPPDATA%\Paparats\apps\<app>\<version>`, Start-menu shortcut, uninstall).
  Every file hashed and held locked; EXE/MSI through `verify_authenticode` (`WinVerifyTrust`,
  embedded or catalog signatures) under the signature policy (typed errors; unsigned only for an
  accepted community warning). Receipts drive uninstall. The only `unsafe` code is
  `src/sys/windows.rs`.
- **Remote catalog** (`paparats-catalog › RemoteCatalog`; D54): Ed25519-signed manifest envelopes
  (`channels.json`, `catalog.json`, `platform.json`, channel manifests) with pinned keys, rollback
  guard, ETag cache in SQLite (schema 2), offline from the cache, outage tracking; downloads of
  packages from the source channel's manifest through `HttpTransfer`; `sign-manifest` bin and
  `scripts/sign-manifest.mjs`. No release key is pinned yet: `catalog` falls back to the embedded
  catalog unless a development build is pointed at a self-signed CDN.
- **Real sign-in** (`paparats-account › OAuthAccount`; D56): OAuth 2 PKCE in the system browser
  against `api.paparats.app`, the `paparats://auth/callback` link completing the waiting
  `account_sign_in`; tokens in the Windows Credential Manager (`persistence=Local`), refreshed on
  use, revoked on sign-out; the profile from `/v1/me`.
- **Integration** (D57). Dependencies hoisted to `[workspace.dependencies]` (Windows-only ones
  under target sections). Fixes: the downloaded file is named for its install strategy (an EXE
  link without `.exe` was refused); the seeded account no longer reads "signed in" under real
  sign-in without tokens; `PAPARATS_CATALOG_URL`/`_KEYS` only in development builds; forgetting
  an uninstalled app runs on the blocking pool; `InstallError::Unsupported` wording; stale
  comments. D52–D57 written from the code (two engineers left no notes); README › Real strategies
  and `docs/architecture.md` §12 describe the flags, strategies and test commands.
- **Tests.** Vitest: 132 files, 898 tests (`domain/versions.test.ts`, `apps.test.ts`). Rust: 348
  tests + 6 `#[ignore]`d (real MSI, machine-wide MSI, EXE and MSIX installs; the machine scan
  printout; the Credential Manager round trip — commands in the README). New suites: argument
  vectors, exit codes, zip slip and archive limits, real `WinVerifyTrust` (notepad.exe by catalog,
  explorer.exe embedded and tampered, unsigned copies), a signed system program as a stand-in EXE
  installer, portable install/update/uninstall in a temp folder; the inventory over a fake
  registry and on this PC; the remote catalog, OAuth and downloads against local HTTP servers;
  the app on a local signed CDN (`services/remote_tests.rs`); the startup account reconcile.
- **Checks.** typecheck, lint, test, format:check, cargo fmt, clippy (`-D warnings`), cargo test
  and `pnpm specta` (no drift) are green.
  - `PAPARATS_REAL=inventory pnpm tauri dev`, driven over the WebView2 debugging port on a fresh
    profile: the log shows `inventory: registry and MSIX scan` and `real strategies
    (PAPARATS_REAL) real=["inventory"]`; `install_get_library` answered in 263 ms with this PC's
    catalog apps — Obsidian 1.11.7, VLC 3.0.23, PowerToys 0.100.2, Everything 1.4.1.1032, VS Code
    1.121.0, 7-Zip 24.09. The Library lists the six (5 × Open, 7-Zip → Update 25.01), Updates and
    the sidebar badge show one update, Home renders. Uninstall 7-Zip was refused with `invalid`
    ("not installed by Paparats") and nothing was removed.
  - Default run (no flag): the 14 mock apps, 6 updates, no `real strategies` line in the log.
  - `PAPARATS_REAL=all`: the catalog fell back (`no trusted manifest keys are configured`),
    inventory, install and account ran, the seeded account read signed out (`no stored session`),
    the Library showed the same six apps. No install or sign-in was started.
  - `%APPDATA%\com.paparats.desktop` and `%LOCALAPPDATA%\com.paparats.desktop` were moved aside
    before and restored
    afterwards byte-identical (5 + 1 162 files, SHA-256); `%LOCALAPPDATA%\Paparats` was never
    created; every process started was stopped.

Known gaps:

- Real installs were not run on this machine (MSI, EXE, MSIX and elevated paths are covered by
  argument/exit-code tests and the `#[ignore]`d tests only), and no release catalog key exists,
  so real installs can only come from a development CDN. No test runs download → real installer
  in one go: `services/remote_tests.rs` downloads a real package from a local CDN and installs it
  with the simulated installer; the portable strategy is exercised end to end in its crate.
- The UI shows none of the new failures: the Library ignores an uninstall refusal, trust warnings
  of community manifests reach only the log, account changes outside the sign-in call reach the
  UI on its next account read. Installs are always per user; the install location setting is not
  used.
- Remote catalog: refresh only at startup (no retry); the directory allowlists every channel's
  manifest host (community downloads from that host are not gated by the follow); signature
  failures read as "unreachable"; `generated` has no future ceiling.
- Inventory: an app without any version reads as an update (`0`); versions recorded in the seeded
  mock journal can stand in for a missing one; apps installed or removed outside Paparats appear
  after the next library change or restart; EXE installs cannot be uninstalled.
- Account: an unreadable credential blocks sign-in and sign-out until removed; the UI still asks
  for a password; first launch signs in only with a typed email.
- `windows` 0.62 and 0.61 (Tauri's) both build; `winreg` has three versions in the lock.

## M8 — Prototype parity (2026-09-23)

What changed (decisions D58–D60 in `docs/decisions.md`). The aim is an app that looks identical
to the prototype. Earlier deliberate deviations were reverted, every icon draws the prototype's
glyph, and the mock world left the startup path.

- **Parity pass** (D58; each superseded bullet in D27, D31, D34, D36, D38, D39, D42, D45 and D49
  is marked):
  - The store card's category chip wraps like the prototype's inline-block chip (`Chip wrap`).
  - Hover styles the prototype lacks are gone: idle carousel dots, checkbox/radio boxes, and
    input borders.
  - The favourite stars stay `--text2` in both states.
  - Report › Send is always enabled.
  - "Paused · 61% · 7 MB of 12 MB" on the app page and in Updates rows.
  - The overflow menu has no pop-in.
  - Plan cards in the Pro state show both pills, and the current plan's button looks enabled
    but is inert (`aria-disabled`). Blank Post and blank Release work the same way.
  - Settings from the sidebar reopens the section last shown (`useUiStore.settingsSection`,
    `app/navigation › resolveTarget`).
  - A never-synced channel's Sources row has empty sync text.

  Measured side by side at 1440 × 920, with the app in a same-origin iframe over the prototype,
  in en/be/ru.
- **Icon glyph parity** (D59). Each registry name draws the prototype's glyph: 25 stock lucide
  icons, and 39 prototype paths through `createLucideIcon` (`components/Icon/glyphs.ts`). New
  name `info-serif` for the app-header and channel notes. The window controls and the Library
  row's star have butt caps. `Icon.test.tsx` reads the prototype file and pins every glyph.
  Checked by the set of (glyph, size, stroke, caps, fill) on every screen, dialog and first-launch
  step listed in D59.
- **Startup and build** (D60):
  - `createServices` is async, and the mock services and fixtures are a lazy chunk a Tauri
    build never loads.
  - `services/common.ts` holds what both service sets share.
  - `vite.config.ts` splits `react` / `vendor` / `fixtures`.
  - `main.tsx` has no top-level await, which had disabled rolldown's chunk merging.
  - The startup loads `index` 367 kB, `react` 296 kB, `vendor` 122 kB and one stylesheet, and
    no chunk warning remains.
  - `hooks/useConnectivity` carries the offline banner's Retry.
- **Integration** (D60): reconciled the parity, icon and service-split changes; the service-split
  engineer left no report, so D60 is written from the code. `docs/architecture.md` §1, §2, §5,
  §6, §7, §9 and §11 were brought up to date. The re-export shim in `mock/system.ts` is removed.
  CRLF working copies (`decisions.md`, `progress.md`, `paparats-install/src/error.rs`) are
  normalised to LF.
- **Tests.** Vitest: 134 files, 985 tests.
  - New: `hooks/useConnectivity.test.tsx` and `services/startup.test.ts`. The startup test checks
    that the static graph from `main.tsx` does not reach the mock world and that no module uses
    top-level await.
  - Registry tests cover the async `createServices`.
  - The glyph pin test.
  - Parity tests: Chip wrap, the AppCard category wrap, `resolveTarget` and the sidebar Settings
    memory through the shell, a blank report sent, the inert Post / Release / current-plan
    buttons, and both plan pills.

  Rust: 348 tests + 6 `#[ignore]`d (unchanged).
- **Checks.** All green:
  - `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm format:check`;
  - `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings` and
    `cargo test --workspace`;
  - `pnpm specta`, with no drift;
  - `pnpm build`, with no chunk-size warning.

  The production build, served by `vite preview` and loaded in headless Edge, boots on the lazy
  mock chunk and renders the Library.

Known gaps:

- `pnpm tauri dev` was not run in M8. The startup change keeps the order (services → bootstrap →
  render) and the Tauri set is created without the mock chunk, but only the browser build was
  exercised.
- Deliberate deviations kept:
  - The Pro-state plan card's second pill wraps inside the card; the prototype's overflowed and
    was clipped.
  - The inert current-plan, blank Post and blank Release buttons are focusable and announced as
    unavailable; the prototype's were plain enabled buttons, and its Release released a blank
    version.
  - Queued, Installing… and "Updated just now" stay native-disabled; the prototype's "Updated
    just now" toasted "Opening …".
- Only the likely hover suspects were checked against the prototype; a full audit of every
  remaining `:hover` rule was not done.
- Russian Cyrillic renders ≈ 2–3 % narrower than in the prototype ('Образование' 87.7 vs 89.6 px).
  The likely cause is the bundled `@fontsource/onest` versus the prototype's Google Fonts Onest.
  Belarusian and English match, and row and card heights are unaffected.
- The icon comparison did not render some surfaces; their markup was read instead:
  - the Release idea and Trust-confirm dialogs;
  - the toast and the offline banner;
  - the offline search and Updates "up to date" empty states;
  - the Ideas developer view;
  - search results.

  Glyphs were not compared separately in the light theme or in be/ru.
- `components/RatingSummary` still draws filled rating stars as inline `<svg>` with `STAR_PATH`
  (the same path as the `star` glyph).

## M8 — Acceptance (2026-09-23)

What changed (decisions D61–D62 in `docs/decisions.md`):

- **Functional acceptance** (D61, written from the code): focus rescue for controls that disappear
  with their row or block (`app/focusRescue.ts`), Settings › Account › Sign in after a sign-out
  (the first launch's Account step alone, `useFirstLaunchStore.openSignIn()`), and the Library /
  Updates row icon tile as a plain `div` (no focusable hidden button).
- **Visual acceptance** (D62): every screen and state compared with the prototype side by side,
  same origin, at 1440 × 920 and 1280 × 800, dark and light, en/be/ru, top of the page and
  scrolled, with forced hover and the first-launch phases (method in D62). Fixed:
  - `CountPill` line height 1.4 (Library tab counts were a pixel row off);
  - `AppIcon` without the overflow clip (monograms lost subpixel antialiasing);
  - `Modal` balances only its description paragraphs (the Suggest an idea placeholder wrapped
    differently);
  - `SettingsRow` hints wrap normally, `prettyHint` for Profile › Delete account;
  - `NotableRow` chips laid out inline like the prototype's (wrapped chips at 1280 px);
  - `layout-grid` draws the prototype's glyph;
  - Belarusian formats in Chromium, which has no `be` ICU data (`i18n/belarusian.ts`: sizes
    "18,4 МБ", dates, relative times, lists, numbers, prices);
  - test selectors that assumed a row tile button.
- **Tests.** Vitest: `i18n/belarusian.test.ts` (the hand-written `be` patterns against Node's ICU,
  `createFormat("be")` and i18next's `number` without runtime data).
- **Checks.** `pnpm typecheck`, `pnpm lint`, `pnpm test` (136 files, 1 008 tests),
  `pnpm format:check` and `pnpm build` (no chunk warning) are green; `cargo fmt --all --check` is
  green, and no Rust file changed after the M8 integration (clippy and cargo test not re-run).
  The functional pass's files had CRLF working copies and failing Library tests (selectors); both
  fixed.

Known gaps:

- The comparison ran in headless Chrome against the mock services; `pnpm tauri dev` (WebView2)
  was not driven. The Belarusian formats were checked in Edge 153 (the WebView2 runtime's ICU):
  `be` resolves to `ru-BY` there, which the fallback now covers.
- An app page re-opened on itself (the same app from search) keeps its expanded version history,
  rating and screenshot; the prototype's `go()` reset them on every navigation.
- Only `createFormat` and i18next's `number` format handle the missing `be` data.
  `RatingSummary`, `ReviewCard`, `IdeaCard` and `VoteButton` call `Intl.NumberFormat(language)`
  directly, so in Belarusian they get the runtime's fallback: WebView2's `ru-BY` writes the same
  "4,4", "64 %" and three-digit counts as `be` (it would group a four-digit count, "1 234", where
  `be` writes "1234"); Chrome writes en-US.

## M9 — Acceptance of the real app (2026-09-23)

`pnpm tauri dev` (WebView2 + Rust core, no `PAPARATS_REAL`) on a fresh profile (both app-data
folders moved aside, restored byte-identical afterwards: 5 + 1 162 files, SHA-256), driven over
the WebView2 debugging port (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9227`)
with trusted CDP mouse and keyboard input; the tray through its window messages and native menu.
The M8 startup (async `createServices`, lazy mock chunk) boots the Tauri set: the log shows
`seeded the local database` and `Paparats started`, no mock chunk.

| # | End-to-end flow | Result |
|---|---|---|
| 1 | Sidebar from all 8 sections, Profile, app, channel and idea pages (83 moves); detail pages keep their section highlighted and Back returns to it (Home, Browse, Library, Updates, Ideas, Settings › Sources) | PASS |
| 2 | Browse: categories, Pro, portable, source, all four sorts, filter search, both Clear all | PASS |
| 3 | Categories → Browse with the category preset | PASS |
| 4 | Release notes toggle; Update all → per-row progress (2 at a time) → "Updated just now" → badge 6 → 4 → 2 → none → "All updates installed"; Pause all / Resume all / Cancel all | PASS |
| 5 | Library tabs, sort, list/grid, collections + breadcrumb, quick filters, Open ("Opening …"), favourite on/off, uninstall ("7-Zip uninstalled", focus to the next control), empty states (favourites, updates, downloads) | PASS |
| 6 | Choose plan → confirm dialog → current plan; Pro pill in the sidebar, subscription and profile cards; Cancel plan back to Free | PASS |
| 7 | All 10 Settings sections; theme and language apply on the click and persist (`settings.json`, tray relabelled); parallel downloads 1 → 4 → 2 changes the running queue | PASS |
| 8 | About › Check for updates → "Checking…" → "You're up to date!" (updater endpoint unreachable reads as up to date); the same from the tray | PASS |
| 9 | Profile: five tabs, Edit → Save → "Profile saved", device removed, Data & Privacy (inert Export/Delete, as the prototype) | PASS |
| 10 | Search: six-row skeleton → results in ≈ 0.3 s; "Nothing found"; offline "Search needs a connection" | PASS |
| 11 | Add by address and by handle (community → trust dialog; verified → direct), not found, already followed; pause/resume, unsubscribe, sync, copy address (clipboard read back), report; stale callout Keep / Unsubscribe | PASS |
| 12 | Propose (5-char title refused), vote/unvote, comment; developer view Take → Mark as released (app + version); the author's note → Activate 3 months of Pro → Pro in sidebar, Subscription, Profile, Settings | PASS |
| 13 | Scene plays on the fresh profile, not after a restart; locale and theme persist; Replay (Advanced, developer mode) runs the timeline 0 → 0.1 → 1.4 → 2.8 → 4.2 → 5.4 s; reduced motion starts at the language step with no running animation | PASS |
| 14 | Offline (simulated and real, via CDP network emulation): banner with Retry, Get/Update inert ("You're offline"), downloads freeze and resume, "Back online" | PASS |

Also PASS: 36 screen states (every screen, the 10 Settings sections, 5 Profile tabs, 3 Library
tabs, grid, search, three dialogs) in en/be/ru × dark/light with no raw keys, `{{`, `undefined` or
`NaN` in text or ARIA attributes; no WARN/ERROR in the app log (99 INFO lines); minimise to tray
(close hides, process stays), tray left click and menu (Open, Check for updates, Quit; labels
follow the language), single instance (second launch exits 0 and brings the window forward),
`paparats://app/obsidian` both warm and as the launching link; D61 (focus rescue, Settings ›
Account › Sign in after a sign-out with the profile email, row tiles as `div`).

Fixed (D63): `[TAURI] Couldn't find callback id …` on 6 of 8 cold starts — the window controls'
resize listener was unlistened by StrictMode's remount while the window was being shown. One
native listener now serves every subscriber (`platform/window.ts`, `platform/window.test.ts`);
0 warnings in 6 cold starts afterwards.

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (138 files, 1 021 tests), `pnpm format:check`,
`cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
`cargo test --workspace` (348 + 6 ignored) and `pnpm specta:check` are green.

Known gaps:

- After Quit from the tray (the core calls `exit(0)`), `pnpm tauri dev` ends with
  `ELIFECYCLE … exit code -1` and Chromium logs `Failed to unregister class Chrome_WidgetWin_0`;
  the exit code of the app itself was not captured under the CLI.
- Not driven: an empty Library (uninstalling every app), a production build (`pnpm tauri build`),
  real installers (`PAPARATS_REAL`).
- Relative times follow the real clock in the Tauri app, so the seeded data reads older than in the
  mock world (the current device "last active last week", channels "synced last week").

## Release (2026-09-24)

State of the product at release (HEAD after M9):

- **Scope delivered** — all 13 screens (Home, Browse, Categories, Updates, Library, Ideas, Idea
  detail, Subscription, Settings with 10 sections, Settings › About, Settings › Sources, Profile,
  App detail, Channel page), the shell, global search, toasts, every dialog (plan confirmation, add
  channel, trust confirmation, report a problem, suggest an idea, release an idea) and the
  first-launch scene with onboarding — in dark and light, en/be/ru.
- **End-to-end flows** — all 14 PASS in the browser build
  (mock services) and in the real Tauri app on the Rust backend (M9 table above).
- **Fidelity** — strict parity pass (D58, D59) and a visual acceptance of 224 states × 2 themes ×
  3 locales × 1440/1280 against the prototype (D62); the remaining differences are localisation,
  accessibility (focus rings, hit targets) or listed decisions.
- **Platform** — frameless window with custom controls, tray and minimise to tray, start on login,
  single instance, `paparats://` deep links, updater wiring (placeholder public key), per-user NSIS
  installer (≈ 3.5 MB), signing hook active only when credentials exist.
- **Real strategies** — registry/MSIX inventory, MSI / silent EXE / MSIX / portable ZIP installers
  with Authenticode, Ed25519-signed catalog manifests, OAuth 2 PKCE sign-in with Credential
  Manager, all behind `PAPARATS_REAL` (D52–D57).
- **Resolved since M8's known gaps** — RatingSummary's inline STAR_PATH stars now use the Icon
  glyph (M9); Belarusian number formatting in components; the app page starts fresh per visit.

Release verification: a fresh `git clone` of HEAD built from scratch — `pnpm install
--frozen-lockfile` (ok), `pnpm check` (exit 0: 138 files / 1 021 UI tests, 348 Rust tests + 6
ignored, bindings up to date) and `pnpm tauri build` (exit 0,
`target/release/bundle/nsis/Paparats_0.1.0_x64-setup.exe`, 3 667 458 bytes, unsigned without
credentials). CI (`.github/workflows/ci.yml`) mirrors the gate and builds the installer.

Open for production (not blockers for the client): real signing credentials and updater keys,
production CDN/account endpoints, the Ideas/account backend (the client keeps them locally in the
simulated world), and the known gaps listed per milestone above.

## 0.1.0 — The real catalog (2026-11-01)

- **Releases.** Tags build, sign and draft releases (D66); 0.0.1 (the demo world) is published,
  and its "Check for updates" installs the next version from `latest.json`.
- **The official catalog** lives in `paparats-app/catalog` (D67): 53 apps (30 from the starter
  list, 23 on the Rising shelf), texts in en/be/ru, editorial data and icons. The bot
  (`crates/paparats-catalog-bot`) resolves releases daily on a Windows runner — SHA-256 against
  GitHub's digest, Authenticode with pinned signers, Defender — keeps newer releases 48 hours in
  quarantine, commits `lock.json` and publishes the signed manifests to GitHub Pages. A weekly
  smoke job installs, finds and uninstalls every app with the client's own code.
- **The client is real by default** (D68): catalog from Pages with two pinned keys, the PC's
  inventory, real installs (MSI, silent EXE, MSIX, portable ZIP and single EXE; machine-wide
  installers elevate; unsigned files only when the catalog pins their hash); `--demo` keeps the
  design's demo world in its own database. Surfaces without a server (Pro, account, Ideas,
  channels, reviews) are hidden by the catalog's features; app pages show GitHub facts instead of
  made-up ratings and versions; no mirrors; Open and Folder work; the catalog refreshes on the
  "Check for updates" schedule; not-yet-working settings are listed only in Developer mode.

The installer carries a signed snapshot of the catalog, so an offline first start shows it.

Uninstall also runs an app's own uninstaller from its Windows entry (EXE installers, apps
installed outside Paparats), silently where its kind is known.

Known gaps: no Windows notifications; automatic updates of other apps do not run; the installer
of Paparats itself is not code-signed.

## 0.1.1 — Checked on real Windows (2026-11-01)

- The catalog's smoke install (D69) installs every app on Windows Server 2022 and 2025, updates
  it from its previous release where there is one, checks that the client's inventory finds it
  and that "Open" has something to start, and uninstalls it through the client's own path. On
  2026-11-01, on both Server 2022 and 2025: every app installs, updates from its previous release
  and is found, and "Open" starts each one; every uninstall works but DeskBox's, whose Inno
  uninstaller waits on a dialog of its own (`paparats-app/catalog#2`). 7-Zip and Git ship with
  the runner images and are skipped.
- "Open" starts MSIX apps; Inno Setup uninstalls write a log.
- `self-update.yml` verifies the client's update from any published release to the latest one:
  0.0.1 → 0.1.1 and 0.1.0 → 0.1.1 pass (the update offered, its signature verified with the
  older release's key, installed over it, the new version read back).

