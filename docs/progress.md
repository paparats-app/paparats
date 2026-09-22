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
