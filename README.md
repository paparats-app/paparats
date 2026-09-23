# Paparats

Curated app store for Windows — Tauri 2 desktop client (Rust core + React/TypeScript UI).

Work in progress; see `docs/progress.md`. Setup, scripts and the architecture map land here as the
milestones complete.

```bash
pnpm install
pnpm tauri dev
```

## Real strategies

By default the app runs on the **mock world**: the prototype's data set and timings (embedded
catalog, a stored inventory, simulated downloads and installs, local sign-in). The real
implementations sit behind one environment variable, `PAPARATS_REAL`, read once at startup
(`apps/desktop/src-tauri/src/flags.rs`, wired in `src-tauri/src/services/wiring.rs`). Nothing in
the UI changes; without the variable the app behaves exactly as before.

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
| `inventory` | **Installed apps are read from this PC**: the Uninstall keys of HKCU, HKLM and HKLM's 32-bit view, the user's MSIX packages and Paparats' portable folder (`%LOCALAPPDATA%\Paparats\apps`), matched to catalog apps by the catalog's detection rules (only catalog apps are listed). "Update" means the catalog's version is newer than the installed one. "Last used" is a best-effort estimate (Explorer's UserAssist, folder times, install dates). A scan takes ≈ 0.25 s and is cached for 10 s. Uninstalling an app Paparats did not install is refused (the Library does not show that error yet). |
| `install` | **Downloads are installed for real**: MSI (`msiexec /qn`, per user; a package that can only be installed for all users is refused), silent EXE installers (the manifest's arguments, never a shell, 30 min timeout), MSIX (`PackageManager`) and portable ZIP (extracted to `%LOCALAPPDATA%\Paparats\apps\<app>\<version>`, with a Start-menu shortcut). Every file is checked against the manifest's SHA-256; EXE/MSI need an Authenticode signature Windows trusts (and the manifest's signer, when it names one). Packages from the mock world keep the simulated "Installing…" hold — on its own, without `catalog`, this flag changes nothing visible. |
| `catalog` | **The catalog comes from signed manifests** on the CDN (`channels.json`, `catalog.json`, `platform.json`, then the release manifest of each followed channel), verified with pinned Ed25519 keys (a community channel's manifest may be unsigned or self-signed: it is kept as unverified), cached with their ETag and served offline from the cache. They refresh at startup; "Sync now" asks the channel's server. A download gets the package its source channel's manifest lists (a real HTTPS transfer from allowlisted hosts, SHA-256 checked); an app that manifest does not list stays simulated. |
| `account` | **Sign-in happens in the browser** (OAuth 2 PKCE against `api.paparats.app`): Sign in opens the sign-in page (the email as a hint; the password is not used) and finishes when the browser returns through `paparats://auth/callback`, within 10 minutes. Tokens live in the Windows Credential Manager (this PC only), never in the database or the log. Sign out revokes them when the server answers and always deletes them. |
| `all` | All four. |

Unknown names are ignored with a warning in the log (`%LOCALAPPDATA%\com.paparats.desktop\logs`).
A strategy that cannot start is logged and replaced by its simulated counterpart, so the app always
starts; the log names the real strategies actually running (`real strategies (PAPARATS_REAL)`).
Nothing is installed for real without both `catalog` and `install`, and no release catalog key
exists yet: today real installs only come from a development CDN (below).

**The remote catalog needs keys.** No release signing key is pinned yet, so `catalog` alone falls
back to the embedded catalog. A development build (`pnpm tauri dev`) can be pointed at a CDN you
signed yourself; release builds ignore these two variables.

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
client already has): `{generated, channels}` (each channel with its `manifestUrl` and, when
verified, its `keys`), `{generated, catalog}`, `{generated, platform}`, and per channel
`{channelId, generated, packages}` — see `crates/paparats-catalog/src/remote/wire.rs` and the
fixtures in `crates/paparats-catalog/tests/remote.rs`. The base URL's host is added to the network
allowlist; plain HTTP is accepted only for loopback hosts, and a loopback base URL turns the
environment's proxy off for the catalog and the downloads.

**Tests.** `cargo test --workspace` runs everything that leaves this PC unchanged, including real
Authenticode checks, a portable install and uninstall in a temp folder, and the catalog, OAuth and
download flows against local HTTP servers. Tests that install software, show a UAC prompt or write
credentials are `#[ignore]`d and read their input from the environment:

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

**Still simulated or local, whatever the flags:** the local database keeps favorites, collections,
subscriptions, ideas, activity and the account snapshot (the mock world is still seeded on first
run); profile edits, devices, two-factor, plans and purchases, the idea gift, problem reports and
the ideas board have no server API yet; Open and Open folder in the Library do nothing yet; apps
installed by an EXE installer cannot be uninstalled from Paparats yet; installs are always per
user (the Settings choice is not used yet). No UI accepts unsigned installers yet, so an unsigned
EXE/MSI is always refused. See `docs/decisions.md` (D52–D57) for the details.
