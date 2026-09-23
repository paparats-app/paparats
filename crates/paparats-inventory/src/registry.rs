//! [`RegistryInventory`]: the real inventory of this PC (M7, behind `PAPARATS_REAL=inventory`).
//!
//! **What is installed** comes from a scan: the Uninstall entries of HKCU, HKLM and HKLM's 32-bit
//! view plus the current user's MSIX main packages, mapped to catalog apps through their
//! [`paparats_core::AppDetection`] rules (see [`DetectionRules`]), plus the portable apps Paparats
//! extracted itself (`%LOCALAPPDATA%\Paparats\apps\<app-id>\<version>\`, the install crate's
//! layout; they leave no Uninstall entry). When several sources map to one app (a per-user and a
//! per-machine copy, x64 and x86, portable and installed) the highest version wins. A version that
//! compares equal to the catalog's (`5.2.9.0` vs `5.2.9`) is reported in the catalog's spelling,
//! so it reads the same everywhere (the UI compares versions numerically too, `domain/versions.ts`,
//! and never offers a newer install as an update). An entry without any version falls back to the
//! version Paparats recorded for the app, else `0`.
//!
//! **Last used** is a best-effort heuristic — Windows keeps no reliable per-app "last used". It
//! is the newest of these dates, never after today, and today when there is no evidence at all:
//! - the last run Explorer recorded in UserAssist for a program inside the install folder or a
//!   shortcut named like the entry or the app (Win32, portable), or for the package family
//!   (MSIX) — the only real "used" signal; empty when the user turned off "Track app launches";
//! - the newest last-write time in the install folder, two levels deep (apps that keep settings,
//!   logs or caches next to themselves; self-updates). MSIX: the package's data folder
//!   `%LOCALAPPDATA%\Packages\<family>` instead (Settings/LocalState change when the app runs);
//! - `InstallDate` and the Uninstall key's last-write time (installed or updated then). MSIX: the
//!   package's install date.
//!
//! Prefetch (`%windir%\Prefetch`) would be a better signal but needs administrator rights.
//!
//! **Record/remove** go to a journal inventory (the local database): activity, the updates
//! counter and the recorded version. [`Inventory::locate`] tells where each app was found, with
//! the uninstall commands Windows keeps — what uninstalling an app Paparats did not install needs.
//! Scans are cached for a short time (default 10 s); `record`, `remove`, [`Inventory::refresh`] and
//! [`Inventory::set_catalog`] drop the cache. A source that
//! fails (no MSIX support, access denied) is logged and skipped; the others still count.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError, RwLock};
use std::time::{Duration, Instant, SystemTime};

use chrono::{Local, NaiveDate};
use paparats_core::{ActivityKind, App, InstalledApp, IsoDate, dates};

use crate::detect::{DetectionRules, MatchKind};
use crate::source::{
    DiskProbe, EmptyRegistry, FolderProbe, KnownFolders, MsixPackage, PackageSource, RegRoot,
    RegistryReader, SourceError, local_date,
};
use crate::uninstall::{UNINSTALL_PATH, UninstallEntry};
use crate::usage::UsageIndex;
use crate::version::compare;
use crate::{Inventory, InventoryError};

/// Default lifetime of a scan.
pub const DEFAULT_SCAN_TTL: Duration = Duration::from_secs(10);

/// Today's local date (injected in tests).
pub type Today = Arc<dyn Fn() -> NaiveDate + Send + Sync>;

/// Where a scan reads from.
#[derive(Clone)]
pub struct Sources {
    pub registry: Arc<dyn RegistryReader>,
    /// `None` = no MSIX scan.
    pub packages: Option<Arc<dyn PackageSource>>,
    pub probe: Arc<dyn FolderProbe>,
    pub folders: KnownFolders,
    /// Paparats' portable apps folder (`<root>\<app-id>\<version>\`); `None` = not scanned.
    pub portable_root: Option<PathBuf>,
}

impl std::fmt::Debug for Sources {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Sources")
            .field("msix", &self.packages.is_some())
            .field("folders", &self.folders)
            .field("portable_root", &self.portable_root)
            .finish_non_exhaustive()
    }
}

impl Sources {
    /// This PC: the Windows registry, `PackageManager` and the file system, with the portable
    /// apps under `%LOCALAPPDATA%\Paparats\apps` (see [`default_portable_root`]). On other
    /// platforms only the portable folder is looked at.
    pub fn system() -> Self {
        let folders = KnownFolders::from_env();
        let portable_root = default_portable_root(&folders);
        #[cfg(windows)]
        let (registry, packages): (
            Arc<dyn RegistryReader>,
            Option<Arc<dyn PackageSource>>,
        ) = (
            Arc::new(crate::windows::WinRegistry),
            Some(Arc::new(crate::windows::MsixPackages)),
        );
        #[cfg(not(windows))]
        let (registry, packages): (
            Arc<dyn RegistryReader>,
            Option<Arc<dyn PackageSource>>,
        ) = (Arc::new(EmptyRegistry), None);
        Self {
            registry,
            packages,
            probe: Arc::new(DiskProbe::default()),
            folders,
            portable_root,
        }
    }

    /// Nothing at all (tests).
    pub fn empty() -> Self {
        Self {
            registry: Arc::new(EmptyRegistry),
            packages: None,
            probe: Arc::new(crate::source::NoFolders),
            folders: KnownFolders::default(),
            portable_root: None,
        }
    }
}

/// `%LOCALAPPDATA%\Paparats\apps` — where the install crate extracts portable apps
/// (`InstallerConfig::apps_dir`). Pass the installer's own folder with
/// [`RegistryInventory::with_portable_root`] when it differs.
pub fn default_portable_root(folders: &KnownFolders) -> Option<PathBuf> {
    folders
        .local_app_data
        .as_ref()
        .map(|local| local.join("Paparats").join("apps"))
}

/// Where a detected app was found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Origin {
    /// An Uninstall entry: root and key name (the product code when `windows_installer`).
    Uninstall {
        root: RegRoot,
        key: String,
        windows_installer: bool,
        /// Command lines exactly as Windows stores them — parse into an argument vector (never
        /// hand them to a shell).
        uninstall_string: Option<String>,
        quiet_uninstall_string: Option<String>,
    },
    /// An MSIX package: family and full package name.
    Msix { family_name: String, name: String },
    /// A version folder under Paparats' portable apps folder.
    Portable,
}

/// One place a scan found an app.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Detected {
    pub app_id: String,
    pub origin: Origin,
    pub kind: MatchKind,
    /// The version this source reports (before choosing the highest one).
    pub version: Option<String>,
    pub install_dir: Option<PathBuf>,
}

/// Everything one scan saw — for diagnostics and the machine test. Holds paths and names of the
/// user's programs: print it locally, never log it.
#[derive(Debug, Clone, Default)]
pub struct ScanReport {
    pub entries: Vec<UninstallEntry>,
    pub packages: Vec<MsixPackage>,
    pub detected: Vec<Detected>,
    /// The inventory, in catalog order.
    pub installed: Vec<InstalledApp>,
    pub errors: Vec<String>,
    pub duration: Duration,
}

/// What a scan found: the inventory and where each app was.
#[derive(Debug, Default)]
struct Scanned {
    apps: Vec<InstalledApp>,
    detected: Vec<Detected>,
}

#[derive(Debug)]
struct Snapshot {
    taken: Instant,
    /// Set by `record`, `remove`, `refresh` and `set_catalog`: the next read scans again.
    stale: bool,
    scanned: Arc<Scanned>,
}

/// Evidence gathered for one app during a scan.
#[derive(Debug, Default)]
struct Found {
    versions: Vec<String>,
    evidence: Option<NaiveDate>,
}

impl Found {
    fn saw(&mut self, date: Option<NaiveDate>) {
        self.evidence = self.evidence.max(date);
    }
    fn saw_time(&mut self, t: Option<SystemTime>) {
        self.saw(t.map(local_date));
    }
}

/// The inventory of this PC from the registry and MSIX packages. See the module docs.
pub struct RegistryInventory {
    sources: Sources,
    journal: Arc<dyn Inventory>,
    rules: RwLock<DetectionRules>,
    today: Today,
    ttl: Duration,
    cache: Mutex<Option<Snapshot>>,
}

impl std::fmt::Debug for RegistryInventory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RegistryInventory")
            .field("sources", &self.sources)
            .field("ttl", &self.ttl)
            .finish_non_exhaustive()
    }
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

impl RegistryInventory {
    /// Scans this PC for `apps`; installs and removals are journaled to `journal`.
    pub fn system(apps: &[App], journal: Arc<dyn Inventory>) -> Self {
        Self::new(apps, journal, Sources::system())
    }

    /// Scans `sources` for `apps`.
    pub fn new(apps: &[App], journal: Arc<dyn Inventory>, sources: Sources) -> Self {
        Self {
            sources,
            journal,
            rules: RwLock::new(compile_rules(apps)),
            today: Arc::new(|| Local::now().date_naive()),
            ttl: DEFAULT_SCAN_TTL,
            cache: Mutex::new(None),
        }
    }

    /// Replaces the clock (tests).
    pub fn with_today(mut self, today: Today) -> Self {
        self.today = today;
        self
    }

    /// How long a scan is reused.
    pub fn with_ttl(mut self, ttl: Duration) -> Self {
        self.ttl = ttl;
        self
    }

    /// Where Paparats extracts portable apps (the installer's `apps_dir`); `None` = not scanned.
    pub fn with_portable_root(mut self, root: Option<PathBuf>) -> Self {
        self.sources.portable_root = root;
        self
    }

    /// Scans now (no cache) and reports everything it saw. With no detection rules there is
    /// nothing to look for and nothing is read.
    pub fn scan(&self) -> Result<ScanReport, InventoryError> {
        let started = Instant::now();
        let mut report = ScanReport::default();
        if self
            .rules
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .is_empty()
        {
            return Ok(report);
        }
        let failed = |e: SourceError, report: &mut ScanReport| {
            tracing::warn!(error = %e, "inventory source failed; scanning the others");
            report.errors.push(e.to_string());
        };
        let registry = self.sources.registry.as_ref();
        for root in RegRoot::UNINSTALL_ROOTS {
            match registry.subkeys(root, UNINSTALL_PATH) {
                Ok(keys) => report
                    .entries
                    .extend(keys.iter().filter_map(|k| UninstallEntry::parse(root, k))),
                Err(e) => failed(e, &mut report),
            }
        }
        if let Some(source) = &self.sources.packages {
            match source.packages() {
                Ok(packages) => report.packages = packages,
                Err(e) => failed(e, &mut report),
            }
        }
        let usage = match UsageIndex::read(registry, &self.sources.folders) {
            Ok(usage) => usage,
            Err(e) => {
                failed(e, &mut report);
                UsageIndex::default()
            }
        };

        let rules = self.rules.read().unwrap_or_else(PoisonError::into_inner);
        let mut found: BTreeMap<usize, Found> = BTreeMap::new();
        for entry in &report.entries {
            let Some(hit) = rules.match_entry(entry) else {
                continue;
            };
            let dir = entry.install_dir(&self.sources.folders);
            let f = found.entry(hit.index).or_default();
            f.versions.extend(entry.version.clone());
            f.saw(entry.install_date);
            f.saw_time(entry.last_write);
            if let Some(dir) = &dir {
                f.saw_time(self.sources.probe.newest_write(dir));
                f.saw_time(usage.last_run_under(dir));
            }
            f.saw_time(
                usage.last_run_of_shortcut([entry.display_name.as_str(), entry.base_name.as_str()]),
            );
            report.detected.push(Detected {
                app_id: hit.app_id.to_owned(),
                origin: Origin::Uninstall {
                    root: entry.root,
                    key: entry.key.clone(),
                    windows_installer: entry.windows_installer,
                    uninstall_string: entry.uninstall_string.clone(),
                    quiet_uninstall_string: entry.quiet_uninstall_string.clone(),
                },
                kind: hit.kind,
                version: entry.version.clone(),
                install_dir: dir,
            });
        }
        for package in &report.packages {
            let Some(hit) = rules.match_package(package) else {
                continue;
            };
            let f = found.entry(hit.index).or_default();
            f.versions.push(package.version.clone());
            f.saw_time(package.installed);
            f.saw_time(usage.last_run_of_family(&package.family_name));
            if let Some(local) = &self.sources.folders.local_app_data {
                let data = local.join("Packages").join(&package.family_name);
                f.saw_time(self.sources.probe.newest_write(&data));
            }
            report.detected.push(Detected {
                app_id: hit.app_id.to_owned(),
                origin: Origin::Msix {
                    family_name: package.family_name.clone(),
                    name: package.name.clone(),
                },
                kind: hit.kind,
                version: Some(package.version.clone()),
                install_dir: package.install_location.clone(),
            });
        }
        if let Some(root) = &self.sources.portable_root {
            let probe = self.sources.probe.as_ref();
            for app_id in probe.subfolders(root) {
                let Some(index) = rules.index_of(&app_id) else {
                    continue;
                };
                let app_dir = root.join(&app_id);
                let Some(version) = probe
                    .subfolders(&app_dir)
                    .into_iter()
                    .max_by(|a, b| compare(a, b))
                else {
                    continue;
                };
                let dir = app_dir.join(&version);
                let f = found.entry(index).or_default();
                f.saw_time(probe.newest_write(&dir));
                f.saw_time(usage.last_run_under(&dir));
                f.saw_time(usage.last_run_of_shortcut(rules.app_name(index)));
                f.versions.push(version.clone());
                if let Some(hit) = rules.hit(index, MatchKind::PortableFolder) {
                    report.detected.push(Detected {
                        app_id: hit.app_id.to_owned(),
                        origin: Origin::Portable,
                        kind: hit.kind,
                        version: Some(version),
                        install_dir: Some(dir),
                    });
                }
            }
        }

        let today = (self.today)();
        for (index, (app_id, catalog_version)) in rules.apps().enumerate() {
            let Some(f) = found.remove(&index) else {
                continue;
            };
            let version = match f.versions.into_iter().max_by(|a, b| compare(a, b)) {
                Some(v) => v,
                None => self
                    .journal
                    .find(app_id)?
                    .map_or_else(|| "0".to_owned(), |recorded| recorded.version),
            };
            let version = if compare(&version, catalog_version).is_eq() {
                catalog_version.to_owned()
            } else {
                version
            };
            let last_used = f.evidence.map_or(today, |d| d.min(today));
            report.installed.push(InstalledApp {
                app_id: app_id.to_owned(),
                version,
                last_used: dates::format(last_used),
            });
        }
        report.duration = started.elapsed();
        tracing::debug!(
            entries = report.entries.len(),
            packages = report.packages.len(),
            detected = report.installed.len(),
            errors = report.errors.len(),
            ms = report.duration.as_millis(),
            "inventory scan"
        );
        Ok(report)
    }

    /// The cached scan (apps, where they were found), scanning when it is missing, stale or
    /// older than the TTL.
    fn snapshot(&self) -> Result<Arc<Scanned>, InventoryError> {
        let mut cache = lock(&self.cache);
        if let Some(s) = cache.as_ref()
            && !s.stale
            && s.taken.elapsed() < self.ttl
        {
            return Ok(Arc::clone(&s.scanned));
        }
        let report = self.scan()?;
        let scanned = Arc::new(Scanned {
            apps: report.installed,
            detected: report.detected,
        });
        *cache = Some(Snapshot {
            taken: Instant::now(),
            stale: false,
            scanned: Arc::clone(&scanned),
        });
        Ok(scanned)
    }

    /// Whether the last scan (fresh or not) saw `app_id`.
    fn last_seen(&self, app_id: &str) -> bool {
        lock(&self.cache)
            .as_ref()
            .is_some_and(|s| s.scanned.apps.iter().any(|a| a.app_id == app_id))
    }

    /// Forces the next read to scan (the last apps stay for `last_seen`).
    fn invalidate(&self) {
        if let Some(s) = lock(&self.cache).as_mut() {
            s.stale = true;
        }
    }
}

fn compile_rules(apps: &[App]) -> DetectionRules {
    let (rules, errors) = DetectionRules::compile(apps);
    for e in &errors {
        tracing::warn!(error = %e, "detection rule ignored");
    }
    rules
}

impl Inventory for RegistryInventory {
    fn installed(&self) -> Result<Vec<InstalledApp>, InventoryError> {
        Ok(self.snapshot()?.apps.clone())
    }

    fn find(&self, app_id: &str) -> Result<Option<InstalledApp>, InventoryError> {
        Ok(self
            .snapshot()?
            .apps
            .iter()
            .find(|a| a.app_id == app_id)
            .cloned())
    }

    fn record(
        &self,
        app: &InstalledApp,
        kind: ActivityKind,
        date: &IsoDate,
    ) -> Result<(), InventoryError> {
        let result = self.journal.record(app, kind, date);
        self.invalidate();
        result
    }

    fn remove(&self, app_id: &str) -> Result<bool, InventoryError> {
        let seen = self.last_seen(app_id);
        let journaled = self.journal.remove(app_id);
        self.invalidate();
        Ok(journaled? || seen)
    }

    fn set_catalog(&self, apps: &[App]) {
        *self.rules.write().unwrap_or_else(PoisonError::into_inner) = compile_rules(apps);
        self.invalidate();
    }

    fn refresh(&self) {
        self.invalidate();
    }

    fn locate(&self, app_id: &str) -> Result<Vec<Detected>, InventoryError> {
        Ok(self
            .snapshot()?
            .detected
            .iter()
            .filter(|d| d.app_id == app_id)
            .cloned()
            .collect())
    }
}

#[cfg(test)]
#[path = "registry_tests.rs"]
mod tests;
