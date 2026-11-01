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
use paparats_install::{GateState, InstallRequest, InstallTarget, Installer, StrictTrust, gate};
use paparats_inventory::{Inventory, RegistryInventory, StoredInventory};
use paparats_storage::Storage;

use crate::build;
use crate::github::GitHub;
use crate::lock::Lock;
use crate::spec::Catalog;
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
        }
    }
}

impl Outcome {
    pub fn passed(&self) -> bool {
        self.install.is_ok()
            && self.detected.is_some()
            && self.uninstall.is_ok()
            && !self.left_behind
    }
}

/// Markdown for the job summary.
pub fn markdown(outcomes: &[Outcome]) -> String {
    let passed = outcomes.iter().filter(|o| o.passed()).count();
    let mut out = format!(
        "## Smoke install: {passed} of {} passed\n\n| App | Strategy | Install | Found | Uninstall | New Uninstall entries |\n|---|---|---|---|---|---|\n",
        outcomes.len()
    );
    for o in outcomes {
        let cell = |r: &Result<(), String>| match r {
            Ok(()) => "ok".to_owned(),
            Err(e) => format!("**failed**: {}", e.replace('|', "/")),
        };
        let found = o
            .detected
            .clone()
            .unwrap_or_else(|| "**not found**".to_owned());
        let uninstall = if o.left_behind {
            "**still found**".to_owned()
        } else {
            cell(&o.uninstall)
        };
        out.push_str(&format!(
            "| {}{} | {} | {} | {} | {} | {} |\n",
            if o.passed() { "" } else { "❌ " },
            o.id,
            o.strategy,
            cell(&o.install),
            found,
            uninstall,
            o.new_entries.join("<br>").replace('|', "/"),
        ));
    }
    out
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

async fn smoke_one(
    github: &GitHub,
    installer: &dyn Installer,
    inventory: &RegistryInventory,
    app: &App,
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

    let before: BTreeSet<String> = entries(inventory).into_iter().map(|(k, _)| k).collect();
    let (_control, mut open) = gate(GateState::OPEN);
    let target = InstallTarget {
        per_user: true,
        ..InstallTarget::default()
    };
    let date = today();
    let request = InstallRequest {
        package,
        file: Some(&file),
        target: &target,
        date: &date,
    };
    let installed: Option<InstalledApp> = match installer.install(request, &mut open).await {
        Ok(app) => Some(app),
        Err(e) => {
            outcome.install = Err(e.to_string());
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

    let Some(installed) = installed else {
        return outcome;
    };
    if let Err(e) = installer.uninstall(&installed).await {
        outcome.uninstall = Err(e.to_string());
    }
    inventory.refresh();
    outcome.left_behind = inventory.find(&app.id).ok().flatten().is_some();
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
        eprintln!("smoke: {} …", app.id);
        let outcome = smoke_one(github, installer.as_ref(), &inventory, app, package, work).await;
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
            ..Outcome::default()
        };
        let missed = Outcome {
            id: "jan".into(),
            strategy: "ExeSilent".into(),
            new_entries: vec!["Jan (jan) — Jan AI".into()],
            ..Outcome::default()
        };
        assert!(ok.passed());
        assert!(!missed.passed(), "installed but the rule did not find it");
        let report = markdown(&[ok, missed]);
        assert!(report.starts_with("## Smoke install: 1 of 2 passed"));
        assert!(report.contains("| rufus | PortableExe | ok | 4.15 | ok |  |"));
        assert!(
            report
                .contains("| ❌ jan | ExeSilent | ok | **not found** | ok | Jan (jan) — Jan AI |")
        );
    }
}
