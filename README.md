# Paparats

Paparats is a curated app store for Windows: utilities and professional software, not games.
Every app has a useful free tier, there are no ads and no telemetry, and one platform-wide
subscription, **Paparats Pro**, unlocks advanced features across participating apps. Users can
follow extra distribution channels and propose, vote on and discuss ideas that developers then
pick up.

This repository holds the Windows desktop client. It is a Tauri 2 app with a Rust core and a
React 19 / TypeScript UI in WebView2, built from the design handoff in
`design_handoff_paparats_store/`. Milestones M0–M9 are complete (`docs/progress.md`). The client
covers 13 screens, the shell, first launch and every dialog, in dark and light themes and in
English, Belarusian and Russian. It runs on a simulated world by default, and real
implementations sit behind an environment variable.

- [Quick start](#quick-start) · [Using the app](#using-the-app)
- [Requirements](#requirements) · [Setup](#setup) · [Scripts](#scripts)
- [Architecture map](#architecture-map) · [Mock and real services](#mock-and-real-services) ·
  [Real strategies](#real-strategies)
- [Local data](#local-data) · [i18n](#i18n) · [Design tokens](#design-tokens) ·
  [Testing](#testing)
- [Building the installer](#building-the-installer) · [Code signing](#code-signing) ·
  [Updater keys](#updater-keys)
- [Developer-mode tools](#developer-mode-tools) · [Known limitations](#known-limitations) ·
  [Contributing](#contributing) · [License](#license)

How to set up, test and send a change is in `CONTRIBUTING.md`. Rules for contributors (human or
agent) are in `CLAUDE.md`. Where things live and what they are
called is in `docs/architecture.md`. Judgement calls and every divergence from the design are
recorded in `docs/decisions.md` (with an index at the top).

## Install

1. Download `Paparats_<version>_x64-setup.exe` from the
   [latest release](https://github.com/paparats-app/paparats/releases/latest) (Windows 10 or 11,
   x64). `SHA256SUMS` next to it lists the file's hash.
2. Run it. It installs for the current user, without administrator rights. The installer is not
   code-signed yet, so Windows SmartScreen may warn: choose **More info** → **Run anyway**.
3. Paparats updates itself: Settings › About › Check for updates offers each new release, and the
   update is verified against the key built into the app.

Uninstall it in Windows Settings › Apps. `Paparats.exe --demo` opens the demo world of the design
instead of the real catalog. What the app sends over the network is listed in
[PRIVACY.md](PRIVACY.md): requests to GitHub only.

## Quick start

The fastest way to see the client is the UI alone in a browser, on the mock services. It needs
only Node.js ≥ 22 and pnpm 12, and works on Windows, Linux and macOS:

```bash
corepack enable          # or: npm install -g pnpm@12
pnpm install
pnpm dev                 # then open http://localhost:1420
```

The full desktop app (`pnpm tauri dev`, the Rust core, the installer) needs Windows and the
toolchain under [Requirements](#requirements); see [Setup](#setup).

## Using the app

The mock and simulated worlds hold the prototype's data set, so every flow works without an
account or a network. A few things to try:

- **Discover and install.** Home and Browse list the catalog; open an app, press Get and watch the
  download and the "Installing…" step in the queue. With `pnpm tauri dev` the transfer and the
  install are simulated by the Rust core; nothing touches the PC.
- **Updates and Library.** Updates shows the apps with a newer catalog version (six in the demo
  world); Update all runs them as one batch. Library lists installed apps, favorites and
  collections.
- **Channels and ideas.** Settings › Sources › Add channel follows an extra distribution
  channel; the Ideas board lets you propose, vote on and discuss ideas.
- **Themes and languages.** Settings switches dark/light and English/Беларуская/Русский.
- **Developer mode.** Settings › Advanced › Developer mode adds offline simulation, a replay of the
  first launch and the component gallery (`http://localhost:1420/#/dev` in a browser), described
  in [Developer-mode tools](#developer-mode-tools).
- **Deep links.** With the desktop app running, `start paparats://app/<id>` or
  `start paparats://channel/<id>` in PowerShell opens that page (`deep_link.rs` in
  `apps/desktop/src-tauri/src/`).

## Platform support

| | Windows | Linux / macOS |
| --- | --- | --- |
| `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` | yes | yes |
| `cargo fmt --all --check` | yes | yes |
| `pnpm tauri dev` / `pnpm tauri build`, `cargo clippy` / `cargo test --workspace`, `pnpm specta` | yes | no: `paparats-desktop` needs Tauri's Linux system libraries (GTK/WebKitGTK), Clippy flags the Windows-only code of `paparats-install` as dead code, and four `paparats-inventory` tests assume Windows paths |

The client is a Windows product; the Linux column only tells you what a contributor without
Windows can run.

## Requirements

| What | Version / notes |
| --- | --- |
| Windows | Windows 10 1809 or later, or Windows 11; x64 |
| WebView2 Runtime | Ships with Windows 11 and current Windows 10. The installer downloads it where it is missing (`webviewInstallMode: downloadBootstrapper`). |
| Node.js | ≥ 22 (`package.json › engines`; CI uses 24) |
| pnpm | 12. `package.json › packageManager` pins `pnpm@12.5.1`: run `corepack enable`, or `npm install -g pnpm@12`. |
| Rust | stable with the MSVC toolchain (`stable-x86_64-pc-windows-msvc`), at least 1.88 (`Cargo.toml › rust-version`), plus `rustup component add rustfmt clippy` |
| C++ build tools | Visual Studio 2022 Build Tools (or Visual Studio) with the **Desktop development with C++** workload. It provides the MSVC linker and the Windows SDK; the SDK's `signtool.exe` is used for PFX signing. |

## Setup

```powershell
pnpm install
pnpm tauri dev
```

The first `pnpm tauri dev` compiles the whole Cargo workspace, which takes a few minutes; later
runs are incremental. The command does three things:

1. It starts Vite on `http://localhost:1420`.
2. It builds and launches the app. Tauri's CLI prints `Info Watching …` and the app's own log
   file records `Paparats started`.
3. It shows the frameless window once the UI has drawn its first frame.

On a fresh profile the first-launch scene plays. Rust changes rebuild and restart the app, and UI
changes hot-reload. To stop, use tray › Quit or Ctrl+C in the terminal. With "Minimize to system
tray" on, the × only hides the window.

To work on the UI alone, `pnpm dev` serves the same UI to a plain browser at
`http://localhost:1420`, with mock services and no Rust build ([below](#mock-and-real-services)).

## Scripts

Root `package.json` (run from the repository root):

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server for the UI on `http://localhost:1420` (strict port). In a plain browser the UI runs on the mock services. |
| `pnpm tauri <cmd>` | The Tauri CLI, run in `apps/desktop`: `pnpm tauri dev`, `pnpm tauri build`, `pnpm tauri signer generate`, `pnpm tauri --version`, … |
| `pnpm build` | Type-checks (`tsc -b`) and builds the UI into `apps/desktop/dist`. `pnpm tauri build` runs it first. |
| `pnpm typecheck` | `tsc -b --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `pnpm lint` | ESLint 10, `--max-warnings 0` (typescript-eslint strict, react-hooks, no default exports, no `@tauri-apps/api/core` or `@/bindings` outside `services/`) |
| `pnpm test` | Vitest once (jsdom + Testing Library). Extra arguments filter files: `pnpm test src/i18n`. |
| `pnpm format` / `pnpm format:check` | Prettier write / check over the repository (`.prettierignore` skips Markdown, fixtures, generated files) |
| `pnpm specta` | Regenerates `apps/desktop/src/bindings.ts` from the Rust commands and events (the `export-bindings` Cargo example), then formats it |
| `pnpm specta:check` | Bindings drift check (`scripts/check-bindings.mjs`): regenerates the file and fails if it changed (no git needed) |
| `pnpm check` | **The gate**, in CI's order: typecheck → lint → test → format:check → `cargo fmt --all --check` → `cargo clippy --workspace --all-targets -- -D warnings` → `cargo test --workspace` → specta:check |

`apps/desktop/package.json`. Run these with `pnpm --filter @paparats/desktop <script>`, or with
plain `pnpm <script>` inside `apps/desktop`:

| Script | What it does |
| --- | --- |
| `dev` | `vite` (what `pnpm dev` and `tauri dev`'s `beforeDevCommand` run) |
| `build` | `tsc -b && vite build` (what `pnpm build` and `tauri build`'s `beforeBuildCommand` run) |
| `preview` | `vite preview`: serves the built `dist/` on `http://localhost:4173`, with mock services in a browser |
| `tauri` | the Tauri CLI |
| `typecheck`, `lint`, `test` | as above |
| `test:watch` | Vitest in watch mode |

Rust (from the repository root; one Cargo workspace):

| Command | What it does |
| --- | --- |
| `cargo fmt --all` / `cargo fmt --all --check` | rustfmt (edition 2024, width 100) |
| `cargo clippy --workspace --all-targets -- -D warnings` | Clippy with warnings as errors; `unwrap`/`expect` are denied outside tests and `unsafe` everywhere but `paparats-install/src/sys/windows.rs` |
| `cargo test --workspace` | every Rust test (tests that change this PC are `#[ignore]`d, [below](#real-strategies)) |
| `cargo test -p <crate>` | one crate, e.g. `cargo test -p paparats-download` |

Helper scripts (Node, no dependencies beyond the workspace):

| Script | What it does |
| --- | --- |
| `node scripts/sign-manifest.mjs …` | Signs a catalog/channel manifest with a development key ([Real strategies](#real-strategies)) |
| `node scripts/port-fixtures.mjs` | Re-ports `fixtures/*.json` from `design_handoff_paparats_store/paparats-proto-data.js`. Idempotent: on an unchanged handoff it rewrites identical files. |
| `node scripts/i18n-keymap.mjs` | Rewrites `apps/desktop/src/i18n/keymap.json` (prototype key → i18n key); only needed when the prototype changes |
| `apps/desktop/src-tauri/scripts/sign-windows.mjs` | The code-signing hook `pnpm tauri build` calls ([Code signing](#code-signing)) |

## Architecture map

```
apps/desktop/                     the Tauri app (pnpm package @paparats/desktop)
  src/                            UI: React 19 + TypeScript 6 (strict) + Vite 8, CSS Modules
    main.tsx                      entry: fonts/tokens → createServices() → bootstrap() → <App/>
    bindings.ts                   GENERATED by `pnpm specta` (Rust types, commands, events). Never edit.
    app/                          shell: App, providers, routes + navigation (useNav), Layout, Sidebar,
                                  TopBar, WindowControls, OfflineBanner, skeleton, ToastHost, DialogHost,
                                  documentSettings (theme/motion/locale → <html>), deep links, tray actions,
                                  focus rescue; app/dialogs/ = the six dialogs
    screens/<name>/               one folder per screen (public API = index.ts): home browse categories
                                  updates library ideas idea subscription settings (+ sources, about)
                                  profile app channel search first-launch dev (component gallery);
                                  screens/shared/ = connected pieces several screens use
    components/<Name>/            shared presentational components (props in, callbacks out), one
                                  folder each with its CSS module and test; all shown in /dev
    services/                     the only door to data: contracts.ts (interfaces), types.ts, errors.ts,
                                  registry.ts (createServices, useServices), common.ts (shared by both sets)
      mock/                       in-memory world over fixtures/*.json with the prototype's timings;
                                  loaded by a dynamic import, so it is its own lazy chunk that a Tauri
                                  build never loads
      tauri/                      adapters: one Rust command per method (via bindings.ts) + typed events
    queries/                      TanStack Query hooks over the services (keys = [service, method])
    stores/                       Zustand stores, one per domain (UI and client state)
    hooks/                        derived hooks: queries + stores + domain (useAppAction, useUpdates, …)
    domain/                       pure functions: source rule, install state, filters, sorting, ideas,
                                  versions, app-page generators, settings schema. No React.
    i18n/                         i18next setup, locales/<en|be|ru>/<area>.ts, useFormat/createFormat
                                  (Intl), the Belarusian CLDR fallback, keymap.json
    platform/                     runtime detection (isTauri, shouldUseMockServices), native window
                                  and shell wrappers, localStore (guarded localStorage)
    styles/                       tokens.css (the single token layer), global.css, fonts.css (Onest)
    test/                         Vitest setup and renderWithProviders / renderApp
    assets/images/                WebP images from the handoff
  src-tauri/                      Rust crate `paparats-desktop`: commands.rs (every command →
                                  Result<T, AppError>), events.rs, services/ (AppState; wiring.rs picks
                                  simulated or real strategies), flags.rs (PAPARATS_REAL), shell.rs +
                                  window.rs + tray.rs + deep_link.rs + autostart.rs (Windows
                                  integration), logging.rs, capabilities/, examples/export_bindings.rs,
                                  scripts/sign-windows.mjs, tauri.conf.json (+ tauri.updater.conf.json)
crates/
  paparats-core                   domain model (apps, channels, ideas, plans, installed apps, manifests),
                                  exported to TypeScript; the network allowlist (hosts.rs)
  paparats-catalog                catalog sources: the embedded data set or Ed25519-signed CDN manifests;
                                  channel lookup, install-source rule; the sign-manifest bin
  paparats-download               download queue: live concurrency, pause/resume/cancel, online flag,
                                  simulated and HTTPS transfers (Range resume, SHA-256), progress events
  paparats-install                installers: simulated; MSI, EXE silent, MSIX, portable ZIP with
                                  SHA-256 + Authenticode checks, receipts
  paparats-inventory              installed apps: the stored mock inventory or the registry/MSIX/portable
                                  scan; version comparison
  paparats-storage                SQLite (paparats.db): migrations, first-run seed from the fixtures,
                                  library, channels, ideas, account, manifest cache
  paparats-account                profile, devices, plans, idea gift; local sign-in or OAuth 2 PKCE with
                                  tokens in the Windows Credential Manager
fixtures/*.json                   the mock data set (ported from the handoff; used by the UI's mock
                                  services and compiled into the Rust embedded catalog and seed)
scripts/                          Node helpers (bindings check, manifest signing, fixture/keymap ports)
docs/                             architecture.md, decisions.md, progress.md, i18n.md
design_handoff_paparats_store/    the design source of truth (read-only)
.github/workflows/ci.yml          the gate + NSIS build on windows-latest
```

**Data flow.** Screens never talk to Tauri. A screen reads server-like data through the TanStack
Query hooks in `queries/` and client state from the Zustand stores in `stores/`. The derived
hooks in `hooks/` combine the two with the pure functions in `domain/`. Queries and store actions
call the interfaces in `services/contracts.ts`. `createServices()` picks one implementation of
them at startup. The **mock** set is an in-memory world with the prototype's timings. The
**tauri** set calls the generated commands in `bindings.ts` and listens to typed events
(`download://progress`, `download://state`, `shell://deep-link`, `shell://tray-action`). On the
Rust side each command goes through `AppState` (`src-tauri/src/services`). That layer drives the
crates: catalog source, inventory, download engine and installer, SQLite storage, account.
Mutations return the new authoritative state, which is written into the query cache without a
refetch. More detail is in `docs/architecture.md` §2.

## Mock and real services

Three switches decide what runs behind the same UI:

| How you start it | UI services | Backend | Data |
| --- | --- | --- | --- |
| `pnpm dev`, then open `http://localhost:1420` in a browser | **mock** (automatic outside Tauri) | none | In memory from `fixtures/*.json`, reset on reload; "today" is 2026-09-15; settings and the first-run record in the page's `localStorage` |
| `PAPARATS_MOCK=1 pnpm tauri dev` | **mock**, inside the real shell | Rust runs the native shell (window, tray, links, single instance); the services are not called | as above, in the WebView2 profile's `localStorage` |
| `pnpm tauri dev` (default) | **tauri** | Rust core, **real**: the signed catalog from GitHub Pages, this PC's installed apps, real downloads and installs; no sign-in | `library.db`, empty on first run (the official catalog followed); real local "today"; `settings.json` ([Local data](#local-data)) |
| `pnpm tauri dev -- -- --demo` or `PAPARATS_DEMO=1` | **tauri** | Rust core on the **demo world**: embedded catalog, stored inventory, simulated transfers and installs, local sign-in | `paparats.db` seeded once from the fixtures |
| `PAPARATS_REAL=… pnpm tauri dev` | **tauri** | Rust core with the named real strategies only ([Real strategies](#real-strategies)) | as above for the parts that stay simulated |

```powershell
# PowerShell: the variable stays set for the session, so remove it afterwards
$env:PAPARATS_MOCK = "1"; pnpm tauri dev
Remove-Item Env:PAPARATS_MOCK
```

```bash
PAPARATS_MOCK=1 pnpm tauri dev
```

- `PAPARATS_MOCK` is read by Vite when the dev server or a build starts (`vite.config.ts ›
  __PAPARATS_MOCK__`, `platform/runtime.ts › shouldUseMockServices`). Never set it for
  `pnpm tauri build`, or the release will ship on mock services.
- `PAPARATS_REAL`, `PAPARATS_DEMO` and `--demo` are read by the Rust core once at startup, so they
  have no visible effect together with `PAPARATS_MOCK=1`. An installed Paparats runs the demo
  world when started as `Paparats.exe --demo`.
- A production UI build served in a browser (`pnpm build`, then
  `pnpm --filter @paparats/desktop preview`) also runs on the mock chunk.

## Real strategies

By default the app is **real**: `inventory`, `install` and `catalog` below run, and `account`
does not (there is no account service). `--demo` or `PAPARATS_DEMO=1` runs the **demo world**
instead: the prototype's data set and timings (embedded catalog, a stored inventory, simulated
downloads and installs, local sign-in). `PAPARATS_REAL` picks the real strategies one by one and
wins over both. All three are read once at startup (`apps/desktop/src-tauri/src/flags.rs`, wired
in `src-tauri/src/services/wiring.rs`). The real catalog's `platform.json` turns off the surfaces
that need a server — Pro, the account, Ideas, channels and reviews — and the UI hides them
(D68).

```powershell
$env:PAPARATS_REAL = "inventory"          # one strategy
$env:PAPARATS_REAL = "inventory,install"  # several (commas, spaces, `;` or `+`)
$env:PAPARATS_REAL = "all"                # all four
pnpm tauri dev
```

```bash
PAPARATS_REAL=inventory pnpm tauri dev
```

| Name | What it does |
| --- | --- |
| `inventory` | **Installed apps are read from this PC**. Sources: the Uninstall keys of HKCU, HKLM and HKLM's 32-bit view, the user's MSIX packages and Paparats' portable folder (`%LOCALAPPDATA%\Paparats\apps`). These are matched to catalog apps by the catalog's detection rules, and only catalog apps are listed. "Update" means the catalog's version is newer than the installed one. "Last used" is a best-effort estimate from Explorer's UserAssist, folder times and install dates. A scan takes ≈ 0.25 s and is cached for 10 s. Uninstalling an app Paparats did not install is refused; the Library does not show that error yet. |
| `install` | **Downloads are installed for real**, by package type: MSI (`msiexec /qn`, per user; a package that can only be installed for all users is refused); silent EXE installers (the manifest's arguments, never a shell, 30 min timeout); MSIX (`PackageManager`); portable ZIP (extracted to `%LOCALAPPDATA%\Paparats\apps\<app>\<version>`, with a Start-menu shortcut). Every file is checked against the manifest's SHA-256. EXE/MSI need an Authenticode signature Windows trusts, and the manifest's signer when it names one. Packages from the mock world keep the simulated "Installing…" hold, so without `catalog` this flag changes nothing visible. |
| `catalog` | **The catalog comes from signed manifests** on the CDN: `channels.json`, `catalog.json`, `platform.json`, then the release manifest of each followed channel. They are verified with pinned Ed25519 keys; a community channel's manifest may be unsigned or self-signed and is then kept as unverified. Manifests are cached with their ETag and served offline from the cache. They refresh at startup, and "Sync now" asks the channel's server. A download gets the package its source channel's manifest lists: a real HTTPS transfer from allowlisted hosts, SHA-256 checked. An app that manifest does not list stays simulated. |
| `account` | **Sign-in happens in the browser** (OAuth 2 PKCE against `api.paparats.app`). Sign in opens the sign-in page with the email as a hint; the password is not used. It finishes when the browser returns through `paparats://auth/callback` within 10 minutes. Tokens live in the Windows Credential Manager (this PC only), never in the database or the log. Sign out revokes them when the server answers and always deletes them. |
| `all` | All four. |

Unknown names are ignored with a warning in the log (`%LOCALAPPDATA%\com.paparats.desktop\logs`).
A strategy that cannot start is logged and replaced by its simulated counterpart, so the app
always starts. The log names the real strategies actually running (`real strategies`). Nothing is
installed for real without both `catalog` and `install`.

**The remote catalog.** It comes from `https://paparats-app.github.io/catalog/v1/`, built and
signed by the bot of [`paparats-app/catalog`](https://github.com/paparats-app/catalog) (D67). The
client pins two keys in `OFFICIAL_KEYS` (`crates/paparats-catalog/src/remote/mod.rs`): the primary
one that signs the catalog and an offline backup. A development build (`pnpm tauri dev`) can be
pointed at a catalog you signed yourself; release builds ignore these two variables.

```powershell
$env:PAPARATS_SIGNING_KEY = (node scripts/sign-manifest.mjs --generate-key)   # keep it secret
node scripts/sign-manifest.mjs --public-key                                    # prints id:key
node scripts/sign-manifest.mjs channels.json --out v1/channels.json            # sign each file
node scripts/sign-manifest.mjs catalog.json --out v1/catalog.json
node scripts/sign-manifest.mjs platform.json --out v1/platform.json

$env:PAPARATS_CATALOG_URL  = "http://127.0.0.1:8787/v1/"   # base URL of the official files
$env:PAPARATS_CATALOG_KEYS = "<id>:<key>"                   # the output of --public-key
$env:PAPARATS_REAL = "catalog"
pnpm tauri dev
```

Each file is a JSON payload with a `generated` date (`YYYY-MM-DD`, never older than the copy a
client already has):

- `channels.json`: `{generated, channels}`, each channel with its `manifestUrl` and, when verified,
  its `keys`;
- `catalog.json`: `{generated, catalog}`;
- `platform.json`: `{generated, platform}`;
- each channel's manifest: `{channelId, generated, packages}`.

The formats are in `crates/paparats-catalog/src/remote/wire.rs`, with examples in the fixtures of
`crates/paparats-catalog/tests/remote.rs`. The base URL's host is added to the network allowlist.
Plain HTTP is accepted only for loopback hosts, and a loopback base URL turns the environment's
proxy off for the catalog and the downloads.

**Tests.** `cargo test --workspace` runs every test that leaves this PC unchanged. That includes
real Authenticode checks, a portable install and uninstall in a temp folder, and the catalog,
OAuth and download flows against local HTTP servers. Tests that install software, show a UAC
prompt or write credentials are `#[ignore]`d and read their input from the environment:

```powershell
$env:PAPARATS_TEST_MSI = "C:\path\to\signed-per-user.msi"
cargo test -p paparats-install -- --ignored real_msi_install               # installs, uninstalls
cargo test -p paparats-install -- --ignored real_machine_wide_msi_install  # UAC prompt, all users
$env:PAPARATS_TEST_EXE = "C:\path\to\setup.exe"
$env:PAPARATS_TEST_EXE_ARGS = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-"
cargo test -p paparats-install -- --ignored real_exe_install               # installs only
$env:PAPARATS_TEST_MSIX = "C:\path\to\trusted.msix"
cargo test -p paparats-install -- --ignored real_msix_install              # adds, removes
cargo test -p paparats-inventory -- --ignored scan_this_machine --nocapture  # read-only
cargo test -p paparats-account -- --ignored credential_manager_round_trip    # test credential
```

**Still simulated or local, whatever the flags:**

- The local database keeps favorites, collections, subscriptions and activity; the real app
  starts it empty (`library.db`), the demo world seeds its own (`paparats.db`).
- Profile edits, devices, two-factor, plans and purchases, the idea gift and the ideas board have
  no server API: the real catalog hides them (D68).
- Uninstalling runs the app's own uninstaller from its Windows entry when Paparats has no
  receipt for it (EXE installers, apps installed outside Paparats); an unknown uninstaller may
  show its own window.
- Installs are per user unless the catalog marks a package machine-wide (its installer elevates).
- An unsigned EXE/MSI runs only when the official catalog declares it unsigned and pins its
  SHA-256 (the app page says so), or from a community channel after the user's confirmation.

The details are in `docs/decisions.md` D52–D57.

## Local data

The app identifier is `com.paparats.desktop`. The development build and an installed build share
these folders.

| Where | What |
| --- | --- |
| `%APPDATA%\com.paparats.desktop\paparats.db` (+ `-wal`, `-shm`) | SQLite: library, favorites, collections, activity, subscriptions, ideas, account, manifest cache. Seeded from the fixtures on the first run only. |
| `%APPDATA%\com.paparats.desktop\settings.json` | Settings (tauri-plugin-store, one key per changed setting; defaults are not written) |
| `%APPDATA%\com.paparats.desktop\.window-state.json` | Window size, position, maximized |
| `%LOCALAPPDATA%\com.paparats.desktop\logs\paparats.<date>.log` | The log: daily files, 7 kept, INFO and above. It never holds tokens or personal data. |
| `%LOCALAPPDATA%\com.paparats.desktop\EBWebView\` | The WebView2 profile. Its `localStorage` holds the **first-run record** `paparats.firstRun` (`{seen, locale, theme, at}`). The dev server (`http://localhost:1420`) and the installed app are different origins, so each keeps its own record. |
| `%LOCALAPPDATA%\com.paparats.desktop\downloads\` | Real downloads only (`PAPARATS_REAL=catalog`); deleted after the install |
| `%LOCALAPPDATA%\Paparats\apps`, `\receipts` | Portable installs and install receipts (`PAPARATS_REAL=install` only) |
| Windows Credential Manager, service `Paparats` | OAuth tokens (`PAPARATS_REAL=account` only) |
| `HKCU\Software\Classes\paparats` | The `paparats://` scheme. The installer registers it; a debug build points it at `target\debug`. |
| `HKCU\Software\Microsoft\Windows\CurrentVersion\Run › Paparats` | Start on login (`--minimized`), written by release builds only |

**Reset.** Quit Paparats first (tray › Quit).

```powershell
# Everything: database (reseeded on the next start), settings, window state
Remove-Item -Recurse -Force "$env:APPDATA\com.paparats.desktop"
# The first-run record (and the rest of the WebView2 profile)
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\com.paparats.desktop\EBWebView"
```

To see the first launch again without deleting anything, use Settings › Advanced › Replay first
launch ([Developer-mode tools](#developer-mode-tools)). In a browser on `pnpm dev`, clear the
site's storage (DevTools › Application › Storage › Clear site data). The mock world itself resets
on every reload.

## i18n

English, Беларуская and Русский are first-class. The full reference is `docs/i18n.md`, and
`apps/desktop/src/i18n/i18n.test.ts` enforces it.

- **Every visible string goes through `t()`.** Catalogs are grouped by screen:
  `apps/desktop/src/i18n/locales/<en|be|ru>/<area>.ts`. English is the source of truth and is
  declared `as const`, so keys and interpolation variables are type-checked.
- **Adding a key.** Add it to `en`, `be` and `ru` in the same change; the test fails on a key
  missing in any language. A key that takes variables must also be listed in `docs/i18n.md` §7
  (the test checks that too). Numbers go in as `{{name, number}}`. Dates, sizes, prices and lists
  are passed pre-formatted. Never concatenate translated fragments into a sentence.
- **Plurals.** Call the base key with `count`: `t("common.appsCount", { count })`. English has
  `_one`/`_other`. Belarusian and Russian have `_one`/`_few`/`_many`/`_other`, where `_other`
  (fractions) repeats `_few`. The categories are the CLDR ones of `Intl.PluralRules`, and a key is
  plural in every language or in none.
- **Formatting.** Use `useFormat()` (sizes "18.4 MB" / "18,4 МБ", dates, relative times, numbers,
  `fixed` decimals, prices, percents, lists). Use `createFormat(locale, today)` outside React. A
  presentational component that only formats numbers uses `useNumberFormat()`. Components never
  call `Intl.*` directly.
- **The Belarusian fallback.** Chromium, and therefore WebView2, ships no Belarusian ICU data:
  `be` resolves to `ru-BY` in WebView2 and to `en-US` in Chrome. Where `be` data is missing,
  `createFormat("be")`, `useNumberFormat()` and i18next's `number` format apply the CLDR `be`
  patterns by hand (`i18n/belarusian.ts`). The tests compare them with Node's full ICU. Plural
  rules have their data everywhere.

## Design tokens

`apps/desktop/src/styles/tokens.css` is the only token layer. It holds both themes under bare
`[data-theme="dark"|"light"]` selectors, plus the brand, on-image, first-launch (`--fl-*`), type,
spacing, radius, shadow, layout and motion tokens.

- Components use only `var(--*)` for colours, radii, shadows, spacing and type sizes. Sizes come
  from the handoff README's tables. There are no literal hex or rgba values in CSS modules or TSX.
  The exceptions are the `#000` mask stops (a mask value, not a colour) and per-item data colours
  (app and channel tints) passed through `style`.
- A value the design uses without naming it gets a new token in `tokens.css`. It never goes inline.
- Every component works in both themes (the `/dev` gallery renders both side by side). Focus is the
  2 px `--mint` `:focus-visible` ring at a 2 px offset, and hit targets are at least 32 px. Motion
  is CSS only and honours `prefers-reduced-motion` and "Subtle animations" (`data-motion="off"`).
- Icons come from `lucide-react` through `components/Icon`. Where lucide 1.x redrew a glyph, the
  prototype's path is used instead (`components/Icon/glyphs.ts`, D59). The font is the bundled
  Onest with tabular figures.

## Testing

- **UI**: `pnpm test` runs Vitest with jsdom and Testing Library: 138 files, 1 021 tests. Use
  `pnpm --filter @paparats/desktop test:watch` while working, or `pnpm test <path or pattern>` for
  a subset.
  - `src/test/render.tsx` provides `renderWithProviders(ui, { route, services })` and
    `renderApp({ route })` (the whole shell on mock services with 0 ms latency).
  - Each milestone's end-to-end flows run through the whole shell and fail on any
    `console.error`/`console.warn`: `app/discovery`, `libraryUpdates`, `account`, `channelsIdeas`,
    `nativeShell`.
  - Every screen has a keyboard/a11y smoke test (`*.a11y.test.tsx`).
  - The Tauri adapters are tested over `mockIPC`.
  - `services/startup.test.ts` keeps the mock world out of the startup graph.
- **Rust**: `cargo test --workspace` runs 348 tests, with 6 more `#[ignore]`d. It covers unit tests
  per crate and fixtures ↔ model sync (`paparats-core/tests/fixtures.rs`). It also runs
  integration tests against local HTTP servers: the signed CDN, the OAuth server, HTTP downloads
  and the app on a local CDN. IPC tests run on Tauri's mock runtime.
- **Everything**: `pnpm check` runs the whole gate. CI runs the same steps, then builds the
  installer.

## Building the installer

```powershell
pnpm tauri build
```

`pnpm tauri build` runs `pnpm build`, compiles the release binary (LTO, `opt-level = "s"`,
stripped), signs it through the signing hook and bundles an NSIS installer:

```
target\release\bundle\nsis\Paparats_0.1.0_x64-setup.exe
```

- The installer is **per user** (`installMode: currentUser`, no administrator rights). It
  registers `paparats://` and uses the WebView2 download bootstrapper. Its languages are English
  and Russian; NSIS has no Belarusian.
- The size budget is **< 15 MB** without the WebView2 runtime; CI fails the build at 15 MB. The
  M6 build was 2.93 MiB.
- Release builds register start-on-login at their first start (the setting defaults to on) and
  ignore the development catalog overrides.
- The version comes from `apps/desktop/src-tauri/tauri.conf.json › version` (and the workspace
  `Cargo.toml`).
- For a UI-only production build use `pnpm build`; for a debug executable without an installer,
  `pnpm tauri build --debug --no-bundle`.

## Code signing

`tauri.conf.json › bundle.windows.signCommand` runs
`node scripts/sign-windows.mjs <file>` (in `apps/desktop/src-tauri/scripts/`) for the app, the
installer and the uninstaller. The script picks a method from the environment:

| Method | Variables |
| --- | --- |
| Azure Trusted Signing (`trusted-signing-cli` on PATH: `cargo install trusted-signing-cli`) | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `TRUSTED_SIGNING_ENDPOINT` (e.g. `https://weu.codesigning.azure.net`), `TRUSTED_SIGNING_ACCOUNT`, `TRUSTED_SIGNING_PROFILE` |
| OV/EV certificate through `signtool` (Windows SDK) | `WINDOWS_CERTIFICATE_PFX` (path to the `.pfx`), `WINDOWS_CERTIFICATE_PASSWORD`; optional `WINDOWS_TIMESTAMP_URL` (default DigiCert), `SIGNTOOL_PATH` (default: the newest SDK `signtool.exe`) |

- With no credentials the file stays unsigned and the build succeeds; this is the local default,
  and it prints `sign-windows: no signing credentials, … stays unsigned`.
- A half-configured method is an error.
- `PAPARATS_REQUIRE_SIGNING=1` turns "unsigned" into a failure, for release pipelines.
- Tools are spawned with argument vectors and secrets are never printed.

**CI secrets** (`.github/workflows/ci.yml`, build job) use the same names:

- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `TRUSTED_SIGNING_ENDPOINT`,
  `TRUSTED_SIGNING_ACCOUNT`, `TRUSTED_SIGNING_PROFILE`. When these are set, CI also installs
  `trusted-signing-cli`.
- Or `WINDOWS_CERTIFICATE_PFX_BASE64` (the `.pfx` in base64, which CI decodes to
  `WINDOWS_CERTIFICATE_PFX`) and `WINDOWS_CERTIFICATE_PASSWORD`.

Without secrets CI builds an unsigned installer and passes.

## Updater keys

The app checks `https://updates.paparats.app/latest.json` through tauri-plugin-updater. Settings ›
About and tray › Check for updates use it, and an unreachable endpoint reads as "up to date".
Nothing downloads or installs an update yet. Updates are verified with a minisign key pair:

```powershell
pnpm tauri signer generate -w "$HOME\.tauri\paparats-updater.key"   # asks for a password
```

- The **public key** replaces the placeholder in
  `apps/desktop/src-tauri/tauri.conf.json › plugins.updater.pubkey` (today
  `PLACEHOLDER-NOT-A-KEY: …`).
- The **private key** (the file's contents) and its password become the CI secrets
  `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Keep them out of the
  repository.
- Updater artifacts (the installer's `.sig`) are only built when the private key is present:

  ```powershell
  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw "$HOME\.tauri\paparats-updater.key"
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "…"
  pnpm tauri build --config src-tauri/tauri.updater.conf.json
  ```

  `createUpdaterArtifacts` lives in that separate file because the Tauri CLI fails any build that
  creates updater artifacts without the key. A plain `pnpm tauri build` keeps working everywhere.
  CI adds the file only when the secret exists.

## Developer-mode tools

Settings › Advanced › **Developer mode** reveals four rows. They replace the prototype's demo
toolbar (D5).

| Row | What it does |
| --- | --- |
| View Ideas as a channel developer | The Ideas board and idea pages act as the Kvetka channel: Take an open idea, Mark as released (app + version), post as the channel; the avatar shows the channel's monogram |
| Simulate offline | Offline without touching the network: the banner with Retry, Get/Update inert, downloads frozen until you are back online |
| Replay first launch | Plays the first-launch scene and onboarding again from the start; with reduced motion or Subtle animations off it opens on the language step |
| Component gallery | Opens `/dev`: every shared component in all variants and states, dark and light side by side (also `http://localhost:1420/#/dev` in a browser) |

The two toggles are ordinary persisted settings. Real connectivity loss shows the same banner
without developer mode.

## Known limitations

The complete, current list is in `docs/progress.md`: each milestone's "Known gaps" and the
Release entry. The reasons are in `docs/decisions.md`. The main ones:

- **Installers are author-signed or nothing.** Local builds of Paparats itself are not
  code-signed, so Windows SmartScreen warns about the installer.
- **No server APIs.** Pro, the account, Ideas, channels and reviews exist only in the demo world
  (`--demo`); the real catalog turns them off (D68). Problem reports go to the app's GitHub
  issues.
- **Failures are quiet.** The handoff has no copy for a failed download or similar action, so
  these return without a message (D8, D36, D38–D45).
- **Settings that do nothing yet** (D64) are listed only in Developer mode: automatic updates,
  metered networks, notifications, install location, shortcuts and the rest. "Check for updates"
  works: it is how often the catalog refreshes in the background.
- **Not exercised on this machine.** Real MSI/EXE/MSIX installs are covered by the `#[ignore]`d
  tests and by the catalog's smoke installs on a GitHub runner.
- **Rendering.** Russian Cyrillic renders ≈ 2–3 % narrower than in the prototype (bundled
  `@fontsource/onest` versus the prototype's Google Fonts build).
- **Developer build quirk.** Tray › Quit under `pnpm tauri dev` ends the CLI with
  `ELIFECYCLE … exit code -1`.

## Contributing

Issues and pull requests are welcome. `CONTRIBUTING.md` covers local setup, the checks (`pnpm
check` is the gate CI runs), code style and commit conventions; the issue and pull request
templates live in `.github/`.

## License

MIT, see [LICENSE](LICENSE). Names and logos of third-party apps in the catalog and in the demo
data belong to their owners.
