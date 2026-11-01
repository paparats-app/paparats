# Privacy

Paparats collects nothing about you. It has no telemetry, no analytics, no crash reporting and
no account service. This file lists every network request the app makes and what it keeps on
your PC.

## What the app connects to

| Host | Why |
|---|---|
| `paparats-app.github.io` | The signed catalog (`channels.json`, `catalog.json`, `platform.json`, `official.json`) and the app icons, from GitHub Pages |
| `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com` | The installers of the apps you install, straight from their authors' GitHub Releases, and Paparats' own updates (`latest.json` and the installer of a new version) |

These are the only hosts the app talks to (`crates/paparats-core/src/hosts.rs`). The catalog is
signed, and every downloaded file is checked against the SHA-256 the catalog pins before it runs.

GitHub serves all of these requests, so GitHub sees your IP address, as any website you visit
does. GitHub's privacy statement applies to that:
<https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement>.
Paparats sends GitHub nothing else: no identifier, no list of your apps, no cookies.

Links you open from the app (an app's repository, "Support the author", this file) open in your
default browser.

## What stays on your PC

In `%APPDATA%\com.paparats.desktop` and `%LOCALAPPDATA%\com.paparats.desktop`, and portable
apps in `%LOCALAPPDATA%\Paparats\apps`:

- your settings and favourites, the library's collections, and the record of what Paparats
  installed and updated;
- the cached catalog and icons, so the app works offline;
- downloads in progress, deleted once an app is installed;
- a log file for troubleshooting, kept for seven days and never sent anywhere.

To read which apps are installed, Paparats looks at the Windows uninstall entries and your MSIX
packages. That information never leaves your PC.

Uninstalling Paparats and deleting the two folders above removes everything it stored.

## Questions

Open an issue or a discussion at <https://github.com/paparats-app/paparats>.
