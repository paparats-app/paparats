//! `catalog-bot smoke`: installs every app of the lock for real, the way the client does, then
//! checks that the inventory finds it and uninstalls it. Meant for a clean Windows runner
//! (administrator, no UAC prompt): it changes the machine it runs on.
//!
//! For each app: the file from `lock.json`, downloaded and checked against the pinned SHA-256;
//! the client's installer (`paparats-install`, the same signature policy); the client's
//! inventory (`paparats-inventory`) with the catalog's detection rules; uninstall. The report
//! names the Uninstall entries each install added, so a detection rule that misses can be fixed
//! from what Windows actually shows.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Arc;

use paparats_core::{App, InstalledApp, Package};
use paparats_install::{
    GateState, InstallError, InstallRequest, InstallTarget, Installer, RegisteredUninstall,
    StrictTrust, gate,
};
use paparats_inventory::{
    Detected, Inventory, LaunchTarget, Origin, RegRoot, RegistryInventory, StoredInventory,
};
use paparats_storage::Storage;

use regex::Regex;

use crate::build;
use crate::github::GitHub;
use crate::lock::Lock;
use crate::spec::{AppSpec, Catalog};
use crate::text;
use crate::{BotError, today};

/// What happened to one app.
#[derive(Debug)]
pub struct Outcome {
    pub id: String,
    pub strategy: String,
    pub install: Result<(), String>,
    /// The version the inventory found after the install (`None`: not found).
    pub detected: Option<String>,
    /// Uninstall entries the install added: `DisplayName` (key) — publisher.
    pub new_entries: Vec<String>,
    pub uninstall: Result<(), String>,
    /// The inventory still finds the app after uninstalling.
    pub left_behind: bool,
    /// Already on the runner before the install (its image ships it): not tested, untouched.
    pub preinstalled: bool,
    /// The update test: the previous release installed first, then the current one over it.
    /// `None` when there is no previous release with a matching file (or it would not install).
    pub update: Option<Result<String, String>>,
    /// What "Open" would start, as the client resolves it (`None`: nothing found).
    pub open: Option<String>,
    /// The tail of the installer's log when the uninstall failed (Inno Setup's `/LOG`).
    pub log: Vec<String>,
}

impl Default for Outcome {
    fn default() -> Self {
        Self {
            id: String::new(),
            strategy: String::new(),
            install: Ok(()),
            detected: None,
            new_entries: Vec::new(),
            uninstall: Ok(()),
            left_behind: false,
            preinstalled: false,
            update: None,
            open: None,
            log: Vec::new(),
        }
    }
}

impl Outcome {
    pub fn passed(&self) -> bool {
        self.preinstalled
            || (self.install.is_ok()
                && self.detected.is_some()
                && !matches!(self.update, Some(Err(_)))
                && self.open.is_some()
                && self.uninstall.is_ok()
                && !self.left_behind)
    }
}

/// Markdown for the job summary.
pub fn markdown(outcomes: &[Outcome]) -> String {
    let passed = outcomes.iter().filter(|o| o.passed()).count();
    let mut out = format!(
        "## Smoke install: {passed} of {} passed\n\n| App | Strategy | Install | Found | Update | Open | Uninstall | New Uninstall entries |\n|---|---|---|---|---|---|---|---|\n",
        outcomes.len()
    );
    for o in outcomes {
        let cell = |r: &Result<(), String>| match r {
            Ok(()) => "ok".to_owned(),
            Err(e) => format!("**failed**: {}", e.replace('|', "/")),
        };
        if o.preinstalled {
            out.push_str(&format!(
                "| {} | {} | skipped: already on the runner | | | | | |\n",
                o.id, o.strategy
            ));
            continue;
        }
        let found = o
            .detected
            .clone()
            .unwrap_or_else(|| "**not found**".to_owned());
        let uninstall = if o.left_behind {
            "**still found**".to_owned()
        } else {
            cell(&o.uninstall)
        };
        let update = match &o.update {
            None => "—".to_owned(),
            Some(Ok(from)) => format!("from {from}"),
            Some(Err(e)) => format!("**failed**: {}", e.replace('|', "/")),
        };
        let open = o
            .open
            .clone()
            .map_or_else(|| "**nothing to start**".to_owned(), |t| format!("`{t}`"));
        out.push_str(&format!(
            "| {}{} | {} | {} | {} | {} | {} | {} | {} |\n",
            if o.passed() { "" } else { "❌ " },
            o.id,
            o.strategy,
            cell(&o.install),
            found,
            update,
            open.replace('|', "/"),
            uninstall,
            o.new_entries.join("<br>").replace('|', "/"),
        ));
    }
    let logs: Vec<&Outcome> = outcomes.iter().filter(|o| !o.log.is_empty()).collect();
    for o in logs {
        out.push_str(&format!(
            "\n<details><summary>{}: installer log</summary>\n\n```\n{}\n```\n</details>\n",
            o.id,
            o.log.join("\n")
        ));
    }
    out
}

/// The last lines of the newest `Setup Log*.txt` in %TEMP% (Inno Setup's `/LOG`).
fn installer_log() -> Vec<String> {
    let dir = std::env::temp_dir();
    let newest = std::fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|e| e.file_name().to_string_lossy().starts_with("Setup Log"))
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    let Some(file) = newest else {
        return Vec::new();
    };
    let text = std::fs::read(file.path()).unwrap_or_default();
    let text = String::from_utf8_lossy(&text);
    let lines: Vec<String> = text.lines().map(str::to_owned).collect();
    lines[lines.len().saturating_sub(40)..].to_vec()
}

fn entries(inventory: &RegistryInventory) -> Vec<(String, String)> {
    inventory
        .scan()
        .map(|report| {
            report
                .entries
                .into_iter()
                .map(|e| {
                    let label = format!(
                        "{} ({}) — {}",
                        e.display_name,
                        e.key,
                        e.publisher.unwrap_or_default()
                    );
                    (e.key, label)
                })
                .collect()
        })
        .unwrap_or_default()
}

/// The uninstall commands of an Uninstall entry (the client's `registered_entry`).
fn registered_entry(found: &Detected) -> Option<RegisteredUninstall> {
    let Origin::Uninstall {
        root,
        key,
        windows_installer,
        uninstall_string,
        quiet_uninstall_string,
    } = &found.origin
    else {
        return None;
    };
    Some(RegisteredUninstall {
        key: key.clone(),
        windows_installer: *windows_installer,
        uninstall_string: uninstall_string.clone(),
        quiet_uninstall_string: quiet_uninstall_string.clone(),
        machine_wide: *root != RegRoot::CurrentUser,
    })
}

/// Whether the inventory still finds the app after 90 s at most (NSIS uninstallers return at
/// once and finish in the background), as the client waits.
async fn still_found(inventory: &RegistryInventory, app_id: &str) -> bool {
    for _ in 0..120 {
        inventory.refresh();
        if inventory.find(app_id).ok().flatten().is_none() {
            return false;
        }
        tokio::time::sleep(std::time::Duration::from_millis(750)).await;
    }
    true
}

/// The previous release's file as a package like `current` (same strategy, signer policy and
/// launch), downloaded to `work`. `None` when there is none or it cannot be fetched.
async fn previous_package(
    github: &GitHub,
    spec: &AppSpec,
    tag: &str,
    current: &Package,
    work: &Path,
) -> Option<(Package, std::path::PathBuf)> {
    let release = github.previous_release(&spec.source, tag).await.ok()??;
    let pattern = Regex::new(&spec.source.asset).ok()?;
    let asset = release.assets.iter().find(|a| pattern.is_match(&a.name))?;
    let dir = work.join("previous");
    std::fs::create_dir_all(&dir).ok()?;
    let file = dir.join(&asset.name);
    let (size, sha) = github
        .download(&asset.browser_download_url, &file)
        .await
        .ok()?;
    let package = Package {
        version: text::version_from_tag(&release.tag_name),
        url: Some(asset.browser_download_url.clone()),
        sha256: Some(sha),
        size_bytes: size,
        ..current.clone()
    };
    Some((package, file))
}

async fn install(
    installer: &dyn Installer,
    package: &Package,
    file: &Path,
) -> Result<InstalledApp, String> {
    let (_control, mut open) = gate(GateState::OPEN);
    let target = InstallTarget {
        per_user: true,
        ..InstallTarget::default()
    };
    let date = today();
    let request = InstallRequest {
        package,
        file: Some(file),
        target: &target,
        date: &date,
    };
    installer
        .install(request, &mut open)
        .await
        .map_err(|e| e.to_string())
}

/// What "Open" would start, resolved as the client does.
fn open_target(
    installer: &dyn Installer,
    inventory: &RegistryInventory,
    app_id: &str,
) -> Option<String> {
    if let Some(shortcut) = installer.shortcut(app_id) {
        return Some(shortcut.display().to_string());
    }
    inventory
        .locate(app_id)
        .unwrap_or_default()
        .into_iter()
        .find_map(|d| d.launch_target())
        .map(|target| match target {
            LaunchTarget::Program(program) => program.display().to_string(),
            LaunchTarget::PackagedApp(app) => app,
        })
}

#[allow(clippy::too_many_arguments)]
async fn smoke_one(
    github: &GitHub,
    installer: &dyn Installer,
    inventory: &RegistryInventory,
    app: &App,
    spec: &AppSpec,
    tag: &str,
    package: &Package,
    work: &Path,
) -> Outcome {
    let mut outcome = Outcome {
        id: app.id.clone(),
        strategy: format!("{:?}", package.strategy)
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .to_owned(),
        ..Outcome::default()
    };
    let Some(url) = package.url.as_deref() else {
        outcome.install = Err("no file".into());
        return outcome;
    };
    let name = url.rsplit('/').next().unwrap_or("package");
    let file = work.join(name);
    match github.download(url, &file).await {
        Ok((_, sha))
            if package
                .sha256
                .as_deref()
                .is_some_and(|p| p.eq_ignore_ascii_case(&sha)) => {}
        Ok((_, sha)) => {
            outcome.install = Err(format!("SHA-256 {sha} is not the pinned one"));
            return outcome;
        }
        Err(e) => {
            outcome.install = Err(e.to_string());
            return outcome;
        }
    }

    inventory.refresh();
    if inventory.find(&app.id).ok().flatten().is_some() {
        outcome.preinstalled = true;
        let _ = std::fs::remove_file(&file);
        return outcome;
    }
    let before: BTreeSet<String> = entries(inventory).into_iter().map(|(k, _)| k).collect();

    // The update test: the previous release first, when it installs and is found.
    let mut previous = None;
    if let Some((old, old_file)) = previous_package(github, spec, tag, package, work).await {
        if install(installer, &old, &old_file).await.is_ok() {
            inventory.refresh();
            previous = inventory.find(&app.id).ok().flatten().map(|a| a.version);
        }
        let _ = std::fs::remove_file(&old_file);
    }

    let installed = match install(installer, package, &file).await {
        Ok(app) => Some(app),
        Err(e) => {
            outcome.install = Err(e);
            None
        }
    };
    let _ = std::fs::remove_file(&file);

    inventory.refresh();
    outcome.new_entries = entries(inventory)
        .into_iter()
        .filter(|(key, _)| !before.contains(key))
        .map(|(_, label)| label)
        .collect();
    outcome.detected = inventory.find(&app.id).ok().flatten().map(|a| a.version);
    if let Some(old) = previous {
        let updated = outcome
            .detected
            .as_deref()
            .is_some_and(|v| paparats_inventory::compare(v, &app.version).is_ge());
        outcome.update = Some(if updated {
            Ok(old)
        } else {
            Err(format!(
                "{old} → still {}",
                outcome
                    .detected
                    .clone()
                    .unwrap_or_else(|| "not found".into())
            ))
        });
    }
    outcome.open = open_target(installer, inventory, &app.id);

    let Some(installed) = installed else {
        return outcome;
    };
    // As the client does: the receipt first, then the uninstaller Windows lists for the app.
    match installer.uninstall(&installed).await {
        Ok(()) | Err(InstallError::Unsupported(_)) => {}
        Err(e) => outcome.uninstall = Err(e.to_string()),
    }
    inventory.refresh();
    if outcome.uninstall.is_ok() && inventory.find(&app.id).ok().flatten().is_some() {
        let entry = inventory
            .locate(&app.id)
            .unwrap_or_default()
            .into_iter()
            .find_map(|d| registered_entry(&d));
        match entry {
            Some(entry) => {
                if let Err(e) = installer.uninstall_registered(&app.id, &entry).await {
                    outcome.uninstall = Err(e.to_string());
                }
            }
            None => outcome.uninstall = Err("no registered uninstaller".into()),
        }
    }
    outcome.left_behind = still_found(inventory, &app.id).await;
    if outcome.left_behind || outcome.uninstall.is_err() {
        outcome.log = installer_log();
    }
    outcome
}

/// Installs, finds and uninstalls every app in the lock (or the `only` ones), one at a time.
pub async fn run(
    catalog: &Catalog,
    lock: &Lock,
    github: &GitHub,
    only: &BTreeSet<String>,
    root: &Path,
    work: &Path,
) -> Result<Vec<Outcome>, BotError> {
    let built = build::assemble(catalog, lock, crate::BASE_URL, root, &today());
    let apps = built.catalog.apps.clone();
    let storage = Storage::open_in_memory().map_err(|e| BotError::Spec(e.to_string()))?;
    let journal: Arc<dyn Inventory> = Arc::new(StoredInventory::new(Arc::new(storage)));
    let inventory = RegistryInventory::system(&apps, journal);
    let installer = paparats_install::from_flags(true, Arc::new(StrictTrust))
        .map_err(|e| BotError::Spec(format!("installer: {e}")))?;
    let mut outcomes = Vec::new();
    for app in &apps {
        if !only.is_empty() && !only.contains(&app.id) {
            continue;
        }
        let Some(package) = built.official.packages.iter().find(|p| p.app_id == app.id) else {
            continue;
        };
        let (Some(spec), Some(locked)) = (
            catalog.apps.iter().find(|a| a.id == app.id),
            lock.apps.get(&app.id),
        ) else {
            continue;
        };
        eprintln!("smoke: {} …", app.id);
        let outcome = smoke_one(
            github,
            installer.as_ref(),
            &inventory,
            app,
            spec,
            &locked.release.tag,
            package,
            work,
        )
        .await;
        eprintln!(
            "smoke: {}: {}",
            app.id,
            if outcome.passed() { "passed" } else { "FAILED" }
        );
        outcomes.push(outcome);
    }
    Ok(outcomes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_report_marks_what_failed() {
        let ok = Outcome {
            id: "rufus".into(),
            strategy: "PortableExe".into(),
            detected: Some("4.15".into()),
            update: Some(Ok("4.14".into())),
            open: Some(r"C:\Start\Rufus.lnk".into()),
            ..Outcome::default()
        };
        let missed = Outcome {
            id: "jan".into(),
            strategy: "ExeSilent".into(),
            new_entries: vec!["Jan (jan) — Jan AI".into()],
            open: Some(r"C:\Jan\Jan.exe".into()),
            ..Outcome::default()
        };
        let stale = Outcome {
            id: "yaak".into(),
            strategy: "ExeSilent".into(),
            detected: Some("2026.8.1".into()),
            update: Some(Err("2026.8.1 → still 2026.8.1".into())),
            open: Some(r"C:\Yaak\yaak.exe".into()),
            ..Outcome::default()
        };
        let no_open = Outcome {
            id: "x".into(),
            detected: Some("1".into()),
            ..Outcome::default()
        };
        assert!(ok.passed());
        assert!(!missed.passed(), "installed but the rule did not find it");
        assert!(!stale.passed(), "the update did not replace the version");
        assert!(!no_open.passed(), "nothing for Open to start");
        let report = markdown(&[ok, missed, stale, no_open]);
        assert!(report.starts_with("## Smoke install: 1 of 4 passed"));
        assert!(report.contains(
            r"| rufus | PortableExe | ok | 4.15 | from 4.14 | `C:\Start\Rufus.lnk` | ok |  |"
        ));
        assert!(report.contains("| ❌ jan | ExeSilent | ok | **not found** | — |"));
        assert!(report.contains("| **failed**: 2026.8.1 → still 2026.8.1 |"));
        assert!(report.contains("**nothing to start**"));
    }
}
