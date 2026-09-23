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
