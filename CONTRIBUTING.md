# Contributing to Paparats

Thanks for helping. This file covers local setup, the checks every change has to pass and the
code style. The full rule set (design, i18n, TypeScript, Rust, process) is in `CLAUDE.md`; it
applies to human and agent contributors alike. Where things live is in `docs/architecture.md`.

- [Before you start](#before-you-start) · [Local setup](#local-setup) · [Running the app](#running-the-app)
- [Tests and checks](#tests-and-checks) · [Code style](#code-style)
- [Commits and pull requests](#commits-and-pull-requests) · [Reporting issues](#reporting-issues)

## Before you start

- Paparats is a Windows desktop app. The full workflow (Rust core, `pnpm tauri dev`, the
  installer) needs Windows 10 1809+ or Windows 11 x64. The UI alone (`pnpm dev`, `pnpm test`,
  lint, typecheck) also runs on Linux and macOS; see [Running the app](#running-the-app).
- The design source of truth is `design_handoff_paparats_store/` and it is read-only. When the
  product logic is ambiguous, follow the prototype (`Paparats Prototype.dc.html`) and record the
  call in `docs/decisions.md`.
- For a larger change, open an issue first so the approach can be agreed before you write code.

## Local setup

Requirements (details in the README's [Requirements](README.md#requirements)):

| Tool | Version |
| --- | --- |
| Node.js | ≥ 22 (CI uses 24) |
| pnpm | 12 (`packageManager: pnpm@12.5.1`): `corepack enable`, or `npm install -g pnpm@12` |
| Rust | stable, ≥ 1.88, MSVC toolchain on Windows, with `rustfmt` and `clippy` |
| C++ build tools | Visual Studio 2022 Build Tools, **Desktop development with C++** workload (Windows) |

```powershell
git clone https://github.com/paparats-app/paparats.git
cd paparats
pnpm install
```

`pnpm install --frozen-lockfile` is what CI runs; use it to make sure the lockfile is in sync.

## Running the app

| Command | What runs | OS |
| --- | --- | --- |
| `pnpm dev`, then open `http://localhost:1420` | The UI in a plain browser on **mock** services (no Rust build). The component gallery is at `http://localhost:1420/#/dev`. | any |
| `pnpm tauri dev` | The desktop app on the Rust core with the **simulated** world | Windows |
| `PAPARATS_MOCK=1 pnpm tauri dev` | The native shell with the UI on mock services | Windows |
| `PAPARATS_REAL=inventory,install,catalog,account` (or `all`) `pnpm tauri dev` | Real strategies instead of simulated ones; they read and change this PC | Windows |

The README's [Mock and real services](README.md#mock-and-real-services) and
[Real strategies](README.md#real-strategies) explain the switches. Never set `PAPARATS_MOCK` for
`pnpm tauri build`.

## Tests and checks

`pnpm check` is the gate. It runs the same steps, in the same order, as CI
(`.github/workflows/ci.yml`), and a pull request has to pass all of them:

```bash
pnpm typecheck                                        # tsc -b --noEmit (strict)
pnpm lint                                             # ESLint, --max-warnings 0
pnpm test                                             # Vitest (jsdom + Testing Library)
pnpm format:check                                     # Prettier
cargo fmt --all --check                               # rustfmt
cargo clippy --workspace --all-targets -- -D warnings # Clippy, warnings are errors
cargo test --workspace                                # Rust tests
pnpm specta:check                                     # bindings.ts matches the Rust commands
```

Useful variants:

- `pnpm test src/i18n` runs a subset; `pnpm --filter @paparats/desktop test:watch` watches.
- `cargo test -p paparats-download` runs one crate.
- `pnpm format` fixes Prettier issues; `cargo fmt --all` fixes rustfmt issues.
- After changing a Tauri command or event, run `pnpm specta` and commit the regenerated
  `apps/desktop/src/bindings.ts`. Never edit that file by hand.
- Tests that install software, show a UAC prompt or write credentials are `#[ignore]`d; the
  README's [Real strategies](README.md#real-strategies) lists how to run them.

The gate targets Windows, and CI on `windows-latest` is the reference. On Linux the UI steps
(`typecheck`, `lint`, `test`, `format:check`) and `cargo fmt --all --check` work as on Windows,
but the other Rust steps do not pass there: `paparats-desktop` needs Tauri's Linux system
libraries (GTK/WebKitGTK), Clippy reports the Windows-only code of `paparats-install` as dead
code, and four `paparats-inventory` tests assume Windows path separators. For Rust changes, run
the gate on Windows or rely on CI.

What to test:

- A new component gets a test next to it and a section in the `/dev` gallery, in both themes.
- A new screen gets a keyboard/a11y smoke test (`*.a11y.test.tsx`).
- A new user-visible string is added to `en`, `be` and `ru` in the same change; the i18n test
  fails on a missing key (`docs/i18n.md`).
- Rust logic gets unit tests in its crate; anything that would change the PC is `#[ignore]`d.

## Code style

Formatting is automatic: Prettier (width 100, double quotes, trailing commas) for TypeScript, CSS
and JSON, rustfmt (edition 2024, width 100) for Rust, `.editorconfig` for the rest. The rules
below are the short version of `CLAUDE.md`.

**TypeScript / React**

- `strict`, no `any`, no default exports for components.
- Screens read data only through `services/*` interfaces, via the TanStack Query hooks in
  `queries/` and the Zustand stores in `stores/`. Never call `invoke` or import `@/bindings`
  outside `services/` (ESLint enforces this).
- Every user-visible string goes through `t()`; dates, sizes and numbers through `useFormat()`.

**Design**

- Colours, radii and shadows only as `var(--*)` from `apps/desktop/src/styles/tokens.css`; no
  literal hex or rgba in components. A new value gets a token.
- Everything works in `data-theme="dark"` and `"light"`. Visible focus (2 px `--mint` ring, 2 px
  offset), hit targets ≥ 32 px.
- Motion is CSS only and respects `prefers-reduced-motion` and "Subtle animations". No animation
  libraries. Icons from `lucide-react` only.

**Rust**

- Errors with `thiserror`; no `unwrap`/`expect` outside tests (Clippy denies them).
- Every Tauri command returns `Result<T, AppError>` and is registered with tauri-specta; events
  are typed structs.
- Spawn processes with explicit argument vectors, never with shell command lines built from
  strings.
- Verify before trusting: manifest signature → download hash → Authenticode.
- New network hosts go into the allowlist in `paparats-core::hosts` only. No telemetry.
- Log with `tracing`; never log tokens or personal data.

## Commits and pull requests

- [Conventional commits](https://www.conventionalcommits.org/): `feat(scope): …`, `fix: …`,
  `docs: …`, `chore: …`. Look at `git log` for the house style.
- One logical change per pull request. Keep `docs/progress.md` current when a change finishes or
  moves a milestone, and record judgement calls and divergences from the design in
  `docs/decisions.md` (and its index).
- Run `pnpm check` (or at least every step your platform supports) before you push, and say in
  the pull request what you ran. The pull request template has the checklist.
- UI changes: add screenshots in both themes.

## Reporting issues

Use the issue templates (bug report, feature request). For a bug, say whether it happens with
`pnpm dev` (mock), `pnpm tauri dev` (simulated) or with `PAPARATS_REAL`, and attach the relevant
lines of the log (`%LOCALAPPDATA%\com.paparats.desktop\logs`) after checking they hold no
personal data.

Please do not report security vulnerabilities in public issues; contact the maintainers privately
instead.

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
