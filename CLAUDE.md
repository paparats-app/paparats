# CLAUDE.md — Paparats desktop client

## What this is
Paparats — a curated Windows app store for utilities and professional software. Tauri 2 desktop
client: Rust core + React/TypeScript UI in WebView2. Design source of truth:
`design_handoff_paparats_store/` (README.md = spec, STACK.md = architecture,
FIRST_LAUNCH_SPEC.md = onboarding, `Paparats Prototype.dc.html` = clickable reference).

## Commands
- `pnpm install` — install; `pnpm tauri dev` — run; `pnpm tauri build` — NSIS installer
- `pnpm typecheck` · `pnpm lint` · `pnpm test` (Vitest)
- `cargo fmt --check` · `cargo clippy --all-targets -- -D warnings` · `cargo test`
- `PAPARATS_MOCK=1 pnpm tauri dev` — mock services with the prototype's data and timings
- `pnpm specta` — regenerate TypeScript bindings from Rust commands/events (tauri-specta)

## Layout
- `apps/desktop/src` — UI. `app/` shell + router, `screens/<name>/`, `components/`, `services/`,
  `i18n/`, `styles/tokens.css`.
- `apps/desktop/src-tauri` — Tauri commands, events, plugins, tray, window.
- `crates/paparats-{core,catalog,download,install,inventory,storage,account}` — Rust core.
- `docs/decisions.md` — product/engineering decisions; `docs/progress.md` — milestone log.

## Rules
### Design
- Only `var(--*)` from `tokens.css` for colors, radii, shadows; sizes from the README's tables.
  No literal hex/rgba in components (exceptions: on-image text colors listed in the README).
- Every screen and component renders correctly in `data-theme="dark"` and `"light"`.
- Visible focus (`:focus-visible` 2 px `--mint` ring, 2 px offset). Hit targets ≥ 32 px.
- Motion: CSS transitions/keyframes; respect `prefers-reduced-motion` and the
  "Subtle animations" setting. No animation libraries.
- Icons: `lucide-react` only. Font: bundled Onest, tabular figures.

### i18n
- Every user-visible string via `t()`; keys grouped by screen; en/be/ru always in sync
  (a test fails on missing keys). Plurals via `Intl.PluralRules`, dates/sizes via `Intl.*`.

### TypeScript
- `strict`, no `any`, no default exports for components. Screens read data only through
  `services/*` interfaces; never call `invoke` directly from a component.
- State: Zustand stores per domain (`useLibraryStore`, `useDownloadsStore`, …); server-like
  data via TanStack Query keyed by service method.

### Rust
- Workspace crates, `thiserror` errors, no `unwrap`/`expect` outside tests. Every Tauri command
  returns `Result<T, AppError>` and is registered with tauri-specta. Events are typed structs.
- Never build shell command lines from strings; spawn with explicit argument vectors.
- Verify before trusting: manifest signature → download hash → Authenticode (EXE/MSI).
- Network allowlist lives in one place (`paparats-core::hosts`). No telemetry, ever.
- Logging: `tracing` to a local rolling file; never log tokens or personal data.

### Process
- Conventional commits; one milestone = one PR; keep `docs/progress.md` current.
- Before finishing a task: typecheck, lint, tests, fmt, clippy — all green.
- Ambiguity in product logic → choose the prototype's behaviour, note it in `docs/decisions.md`.
