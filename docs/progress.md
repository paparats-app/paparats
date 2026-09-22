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
