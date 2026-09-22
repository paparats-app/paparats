# Paparats — technology stack recommendation

Decision record for the greenfield build. No code exists yet.

## Recommendation

Build the Windows client on **Tauri 2**: a **Rust core** for everything an app store must get
right (downloads, hash and signature verification, running installers, inventory, update checks,
credential storage, tray/autostart) and a **TypeScript + React UI rendered by WebView2**, styled
with plain CSS custom properties ported from the prototype's token tables.

Rust goes where trust and performance live. Web technology goes where the high-fidelity design
already exists as HTML/CSS and ports nearly 1:1. Ship a **signed per-user NSIS installer** with
the built-in updater; add MSIX later if Store distribution is wanted.

"Maybe Rust?" — **yes, for the core; no, for rendering the UI** (see "Why not a pure-Rust UI").

## What the product needs from its stack

- It runs other publishers' installers: process spawning with explicit arguments, UAC elevation
  on demand, Authenticode checks, registry reads, MSIX deployment APIs. This code must be
  memory-safe and auditable — the brand promise is "trustworthy, no telemetry".
- A download engine: queue with setting-driven concurrency, pause/resume via HTTP Range,
  cancel, SHA-256 verification, progress events ≥ 10 Hz.
- A hi-fi UI: 13 screens, dark/light/system themes, three locales with Slavic plurals, CSS masks,
  gradients and `mix-blend-mode` (first-launch scene), 340 ms transitions, skeletons, custom
  window chrome.
- Lightweight and calm: small installer, fast cold start, modest RAM. Windows 10 (1809+) and 11.
- A small team building with Claude Code — mainstream languages and libraries matter.

## Options compared

| | **Tauri 2 (Rust + TS)** | Qt 6 / QML (C++) — original brief | .NET 8 + WinUI 3 / Avalonia | Pure-Rust GUI (Slint, Iced, egui) | Electron |
|---|---|---|---|---|---|
| Fidelity to the HTML prototype | 1:1 — same CSS | Rewrite; masks/blend modes need shaders | Rewrite in XAML, against Fluent defaults | Rewrite; no CSS, limited effects | 1:1 |
| Installer / idle RAM | ~8–15 MB / 80–130 MB (WebView2 is shared with Edge) | 30–60 MB / 50–90 MB | 60–90 MB / 90–150 MB | 5–15 MB / 40–80 MB | 100+ MB / 200–350 MB |
| Windows integration (tray, autostart, registry, UAC, MSIX) | `windows` crate + plugins | Excellent | Excellent | `windows` crate | Weaker (native addons) |
| Memory safety of the installer core | Rust | C++ | C# (managed) | Rust | JS |
| Cyrillic text, i18n plumbing | Chromium + `Intl` | Good | Good | Slint good; Iced/egui weaker | Chromium + `Intl` |
| Licensing | MIT/Apache | LGPLv3 dynamic or commercial | MIT | Slint: GPL / royalty-free / commercial; others MIT | MIT |
| Productivity with Claude Code | High | Low–medium | Medium | Low (young, shifting APIs) | High |
| Main risk | WebView2 dependency; frameless-window details | Slow iteration, licensing, C++ | WinUI tooling churn; heavy | Ecosystem too thin for this design | Weight contradicts the brand |

### Why not the original C++/Qt plan
The brief predates the prototype. Now that the design exists as CSS, a QML rewrite costs more
and lands lower in fidelity; Qt's commercial terms matter as soon as static linking or certain
modules are wanted; C++ in a network-facing installer is a liability; and QML/C++ is where
AI-assisted development is least productive. Keep Qt only as the fallback if WebView2 were ever
ruled out.

### Why not a pure-Rust UI
Slint is the one serious candidate, but this design leans on CSS masks, gradients,
`mix-blend-mode`, text-shadow, line clamping and a cinematic first launch. Rebuilding those in
Slint markup is slow, and the component ecosystem (rich text, virtualized lists, accessibility)
is thin. Dioxus desktop renders through a WebView anyway — at which point Tauri + React is the
better-trodden path. Revisit in a few years.

### Why not Electron
150–300 MB of RAM and a 100 MB installer for a store whose promise is "lightweight, no bloat".
WebView2 is the same rendering engine without shipping Chromium.

### If the team is C#-first
Avalonia 11 + .NET 8 is the stronger C# option (not WinUI 3): consistent custom theming,
XAML, good tooling. It still means re-drawing the prototype in XAML.

## Architecture

### Repository layout (single repo, Cargo workspace + pnpm)
```
paparats/
  apps/desktop/                 Tauri app
    src/                        React + TypeScript (Vite)
      app/                      router, providers, shell (Sidebar, TopBar, WindowControls, Toast, Modal)
      screens/                  one folder per screen: home, browse, categories, updates, library,
                                ideas, idea, subscription, settings (+ sources, about), profile, app, channel,
                                first-launch
      components/               AppCard, AppListItem, HeroBanner, FilterPanel, Toggle, SettingsRow, …
      services/                 typed clients over Tauri commands (+ mock implementations)
      i18n/                     en.ts, be.ts, ru.ts message catalogs; formatters (Intl.*)
      styles/tokens.css         the token tables from README.md as CSS custom properties
    src-tauri/                  Rust: commands, events, plugins, tray, window setup
  crates/
    paparats-core/              domain types (App, Channel, Idea, Plan, InstalledApp, UpdateManifest), serde
    paparats-catalog/           catalog + channel manifests: fetch, cache, Ed25519 signature check, trust levels
    paparats-download/          queue, concurrency limit, Range resume, pause/cancel, SHA-256, progress
    paparats-install/           installer strategies (MSI, EXE silent, MSIX, portable ZIP), Authenticode, elevation
    paparats-inventory/         installed-app discovery (registry Uninstall keys, MSIX), version compare
    paparats-storage/           SQLite (rusqlite, bundled) for cache / inventory / activity; settings JSON
    paparats-account/           OAuth 2 PKCE via system browser + `paparats://` deep link; tokens in Credential Manager
  design_handoff_paparats_store/  this bundle (read-only reference)
```

### Rust side
- Runtime: `tokio`; HTTP: `reqwest` (streaming); hashing: `sha2`; manifest signatures:
  `ed25519-dalek`; archives: `zip`; DB: `rusqlite` (`bundled`); errors: `thiserror` per crate,
  one `AppError` at the Tauri boundary; logging: `tracing` to a local rolling file only.
- Windows: `windows` crate — `WinVerifyTrust` (Authenticode), `ShellExecuteExW` with `runas`
  (elevation only for explicit machine-wide installs), `Windows.Management.Deployment.PackageManager`
  (MSIX); `winreg` for Uninstall keys (HKCU, HKLM, WOW6432Node); `keyring` for Credential Manager.
- Install strategies behind one trait (`Installer`): `Msi` (`msiexec /i … /qn`), `ExeSilent`
  (arguments come from the manifest — Inno/NSIS/other; never shell-interpreted), `Msix`,
  `PortableZip` (extract to per-user apps dir + shortcut). A `Simulated` implementation drives
  development and tests with the prototype's timings.
- Download engine emits typed events (`download://progress`, `download://state`) consumed by the
  UI; the queue honours the "Parallel downloads" setting (default 2) and pauses/resumes on
  connectivity changes.

### Tauri configuration
- Frameless window (`decorations: false`), default 1440×920, minimum 1280×800, custom window
  controls in the top bar, `data-tauri-drag-region` on the drag strip. Optional: a community
  title-bar plugin for Windows 11 Snap Layouts on the maximize button — verify it is maintained
  before adopting; otherwise accept the loss of the hover overlay.
- Plugins: `window-state`, `autostart`, `store` (settings), `updater`, `single-instance`,
  `deep-link` (`paparats://` for sign-in return and `paparats://channel/…` links), `notification`,
  `opener` (external links only), `log`, `os`. Tray icon via the core `tray-icon` feature.
- Typed IPC: `tauri-specta` generates TypeScript bindings for every command and event, so the
  UI and the core share one source of truth for types.
- Theme: `Light / Dark / System` — System follows `window.theme()` + `onThemeChanged`; the UI
  applies `data-theme` on the root exactly like the prototype.

### Frontend
- React 19 + TypeScript (strict) + Vite. React Router (memory history — no URLs in a desktop
  app), Zustand for UI/app state, TanStack Query for command-backed data, `lucide-react` icons,
  `@tauri-apps/api`.
- Styling: CSS Modules + `tokens.css`. No Tailwind, no runtime CSS-in-JS: the prototype's
  values map directly to custom properties and the design is not utility-shaped.
- i18n: `i18next` + `react-i18next`, catalogs ported from `paparats-proto-data.js`; plurals via
  `Intl.PluralRules` (covers `be` and `ru`), dates/relative times/sizes via
  `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.NumberFormat`.
- Fonts: bundle **Onest** (OFL) as woff2 inside the app — never fetch from Google Fonts at
  runtime (no telemetry means no third-party requests).
- Motion: CSS transitions/keyframes and the Web Animations API; no animation library. Honour
  `prefers-reduced-motion` and the "Subtle animations" setting.

### Security posture
- Strict CSP (`default-src 'self'`; images additionally from the catalog CDN); no remote code;
  Tauri capabilities scoped to the commands actually used.
- Every catalog/channel manifest is Ed25519-signed and verified before its hashes are trusted;
  every download is SHA-256-checked; EXE/MSI additionally go through Authenticode. Community
  channels: files come straight from the author's server, unsigned binaries produce a warning
  in the UI (mirrors the prototype's trust-level copy).
- Per-user install by default; elevation only for explicit machine-wide installs.
- Network allowlist: catalog/channel hosts, download hosts from manifests, account API,
  updater endpoint. Nothing else. Logs stay on disk.

### Distribution
- `pnpm tauri build` → NSIS `.exe`, `installMode: currentUser` (no admin), WebView2
  `downloadBootstrapper` for Windows 10 machines without the runtime.
- Code signing is mandatory (the app spawns installers; unsigned = SmartScreen warnings):
  Azure Trusted Signing or an OV/EV certificate through Tauri's `signCommand`.
- Auto-update: `tauri-plugin-updater` with minisign keys and a `latest.json` on the CDN.
- CI: GitHub Actions on `windows-latest` with `tauri-apps/tauri-action`; artifacts: installer,
  update bundle, `latest.json`.

### Testing
- Rust: unit tests per crate; integration tests for download/install against a local HTTP
  server (`wiremock`/`axum`) and temp directories.
- UI: Vitest + Testing Library with `@tauri-apps/api/mocks` (`mockIPC`) for command-backed
  components; visual checks against the prototype in both themes and all three locales.
- End-to-end (optional, later): WebdriverIO + `tauri-driver`.

### Budgets
Cold start to first paint < 800 ms on a mid-range laptop · idle RAM < 130 MB including
WebView2 · installer < 15 MB (without the WebView2 bootstrapper) · transitions at 60 fps ·
download engine saturates ≥ 500 Mbps with two streams.

## Decisions to lock now
1. Tauri 2 + Rust core + React/TypeScript UI (this document).
2. CSS Modules + `tokens.css`; both themes via `data-theme`.
3. `i18next`; catalogs are the single source of copy; `Intl.*` for all formatting.
4. `rusqlite` for local data; `tauri-plugin-store` JSON for settings.
5. NSIS per-user installer + `tauri-plugin-updater`; MSIX deferred.
6. Azure Trusted Signing (or OV cert) from the first public build.
7. Minimum OS: Windows 10 1809.
8. Mock services first (`PAPARATS_MOCK=1`), real catalog/download/install behind the same
   interfaces — the prototype's simulated timings are the mock's spec.

## Risks and mitigations
- **WebView2 runtime missing on old Windows 10** → bootstrapper in the installer; detect and
  explain at first launch.
- **Frameless window vs. Windows 11 Snap Layouts** → evaluate a title-bar plugin; fallback is
  a working custom maximize button without the hover overlay.
- **Installer zoo (Inno, NSIS, MSI, MSIX, portable)** → strategy per app in the manifest, with
  `Simulated` first; add real strategies one at a time with tests.
- **Elevation prompts** → per-user installs by default; a future elevated helper service is out
  of scope for v1.
- **RAM perception** → WebView2 processes are shared with Edge; measure and publish numbers.

## Backend (later, out of scope for the client)
Catalog and channel manifests can be **signed static JSON on a CDN** — no server needed for
browsing, updates or installs. Account, subscription and the Ideas board need an API; if Rust is
chosen there too (`axum` + `sqlx` + Postgres), the `paparats-core` crate is shared between server
and client so manifest and account types never drift. Channel authors publish the same manifest
format from their own hosts; "verified" channels are mirrored by Paparats, "community" ones are not.
