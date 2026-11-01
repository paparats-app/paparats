//! Tests of [`RegistryInventory`] over a fake registry, package list and file system.

use std::collections::HashMap;
use std::path::Path;

use chrono::TimeZone;
use paparats_core::Catalog;
use paparats_storage::Storage;

use super::*;
use crate::StoredInventory;
use crate::source::{MemoryRegistry, RegData, RegKeyData};
use crate::usage::{USER_ASSIST_PATH, rot13};

const TODAY: &str = "2026-09-22";
const USER_ASSIST_GUID: &str = "{CEBFF5CD-ACE2-4F4F-9178-9926F41749EA}";
const BITWARDEN_FAMILY: &str = "8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy";
const INKSCAPE_CODE: &str = "{81922150-317E-4BB0-A31D-FF1C14F707C5}";

fn apps() -> Vec<App> {
    let c: Catalog = serde_json::from_str(include_str!("../../../fixtures/catalog.json")).unwrap();
    c.apps
}

fn date(iso: &str) -> NaiveDate {
    dates::parse(iso).unwrap()
}

/// Local noon of `iso`, so the local calendar day is `iso` in any time zone.
fn at(iso: &str) -> SystemTime {
    let noon = date(iso).and_hms_opt(12, 0, 0).unwrap();
    SystemTime::from(Local.from_local_datetime(&noon).single().unwrap())
}

fn user_assist_record(when: SystemTime) -> RegData {
    let since = when.duration_since(SystemTime::UNIX_EPOCH).unwrap();
    let ticks = 116_444_736_000_000_000 + since.as_secs() * 10_000_000;
    let mut data = vec![0_u8; 72];
    data[60..68].copy_from_slice(&ticks.to_le_bytes());
    RegData::Binary(data)
}

/// Folder times by (case-insensitive) path.
#[derive(Default)]
struct FakeProbe(HashMap<String, SystemTime>);

impl FakeProbe {
    fn with(mut self, dir: &str, t: SystemTime) -> Self {
        self.0.insert(dir.trim_end_matches('\\').to_lowercase(), t);
        self
    }
}

impl FolderProbe for FakeProbe {
    fn newest_write(&self, dir: &Path) -> Option<SystemTime> {
        let key = dir.to_string_lossy().trim_end_matches('\\').to_lowercase();
        self.0.get(&key).copied()
    }
}

/// A registry the test can change between scans.
#[derive(Clone, Default)]
struct SharedRegistry(Arc<Mutex<MemoryRegistry>>);

impl SharedRegistry {
    fn insert(&self, root: RegRoot, path: &str, key: RegKeyData) {
        lock(&self.0).insert(root, path, key);
    }
}

impl RegistryReader for SharedRegistry {
    fn subkeys(&self, root: RegRoot, path: &str) -> Result<Vec<RegKeyData>, SourceError> {
        lock(&self.0).subkeys(root, path)
    }
}

struct FailingPackages;

impl PackageSource for FailingPackages {
    fn packages(&self) -> Result<Vec<MsixPackage>, SourceError> {
        Err(SourceError::Packages("Class not registered".into()))
    }
}

fn folders() -> KnownFolders {
    KnownFolders {
        windows: Some(PathBuf::from(r"C:\Windows")),
        local_app_data: Some(PathBuf::from(r"C:\Users\u\AppData\Local")),
        program_files: Some(PathBuf::from(r"C:\Program Files")),
        program_files_x86: Some(PathBuf::from(r"C:\Program Files (x86)")),
        ..KnownFolders::default()
    }
}

fn entry(key: &str, name: &str) -> RegKeyData {
    RegKeyData::new(key).with_str("DisplayName", name)
}

/// A PC with a handful of catalog apps installed in every way the scan knows.
fn machine() -> SharedRegistry {
    use RegRoot::{CurrentUser as Hkcu, LocalMachine as Hklm, LocalMachine32 as Hklm32};
    let reg = SharedRegistry::default();
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry("7-Zip", "7-Zip 25.01 (x64)")
            .with_str("DisplayVersion", "25.01")
            .with_str("Publisher", "Igor Pavlov")
            .with_str("InstallLocation", r"C:\Program Files\7-Zip\")
            .with_str("InstallDate", "20250110")
            .written(at("2025-01-10")),
    );
    reg.insert(
        Hkcu,
        UNINSTALL_PATH,
        entry("5e4b2ae7-obsidian", "Obsidian 1.8.9")
            .with_str("DisplayVersion", "1.8.9")
            .with_str(
                "UninstallString",
                r#""C:\Users\u\AppData\Local\Programs\Obsidian\Uninstall Obsidian.exe" /currentuser"#,
            )
            .written(at("2026-08-01")),
    );
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry("Krita_x64", "Krita (x64) 5.2.9").with_str("DisplayVersion", "5.2.9.0"),
    );
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry(
            "{EA457B21-F73E-494C-ACAB-524FDE069978}_is1",
            "Microsoft Visual Studio Code",
        )
        .with_str("DisplayVersion", "1.92.2")
        .with_str("Publisher", "Microsoft Corporation")
        .written(at("2026-07-01")),
    );
    reg.insert(
        Hkcu,
        UNINSTALL_PATH,
        entry(
            "{771FD6B0-FA20-440A-A002-3B3BAC16DC50}_is1",
            "Microsoft Visual Studio Code (User)",
        )
        .with_str("DisplayVersion", "1.93.0")
        .with_str("Publisher", "Microsoft Corporation")
        .written(at("2026-09-02")),
    );
    reg.insert(
        Hklm32,
        UNINSTALL_PATH,
        entry("Everything", "Everything 1.4.1.1028 (x64)")
            .with_str("DisplayVersion", "1.4.1.1028")
            .with_str("Publisher", "voidtools")
            .with_str("InstallLocation", r"C:\Program Files (x86)\Everything")
            .written(at("2026-06-15")),
    );
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry("SomethingElse", "Everything")
            .with_str("DisplayVersion", "9.9")
            .with_str("Publisher", "Another Vendor"),
    );
    reg.insert(
        Hkcu,
        UNINSTALL_PATH,
        entry("Steam App 1127400", "Mindustry"),
    );
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry("Stellarium_is1", "Stellarium 25.2"),
    );
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry("Notepad++", "Notepad++ (64-bit x64)").with("SystemComponent", RegData::Dword(1)),
    );
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry("Git_is1", "Git").with_str("DisplayVersion", "2.50.0"),
    );
    reg.insert(
        Hklm,
        UNINSTALL_PATH,
        entry(INKSCAPE_CODE, "Inkscape")
            .with_str("DisplayVersion", "1.4.2")
            .with("WindowsInstaller", RegData::Dword(1))
            .with_str("UninstallString", format!("MsiExec.exe /X{INKSCAPE_CODE}")),
    );
    reg.insert(Hkcu, USER_ASSIST_PATH, RegKeyData::new(USER_ASSIST_GUID));
    reg.insert(
        Hkcu,
        &format!("{USER_ASSIST_PATH}\\{USER_ASSIST_GUID}"),
        RegKeyData::new("Count")
            .with(
                rot13(r"C:\Users\u\AppData\Local\Programs\Obsidian\Obsidian.exe"),
                user_assist_record(at("2026-09-20")),
            )
            .with(
                rot13(&format!("{BITWARDEN_FAMILY}!bitwardendesktop")),
                user_assist_record(at("2026-09-21")),
            )
            .with(
                rot13(r"{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}\Everything\Everything.exe"),
                user_assist_record(at("2026-12-24")),
            ),
    );
    reg
}

fn packages() -> Vec<MsixPackage> {
    vec![
        MsixPackage {
            name: "8bitSolutionsLLC.bitwardendesktop".into(),
            family_name: BITWARDEN_FAMILY.into(),
            version: "2026.8.1.0".into(),
            install_location: Some(PathBuf::from(
                r"C:\Program Files\WindowsApps\8bitSolutionsLLC.bitwardendesktop_2026.8.1.0_x64__h4e712dmw3xyy",
            )),
            installed: Some(at("2026-09-01")),
        },
        MsixPackage {
            name: "Microsoft.WindowsTerminal".into(),
            family_name: "Microsoft.WindowsTerminal_8wekyb3d8bbwe".into(),
            version: "1.23.1.0".into(),
            install_location: None,
            installed: Some(at("2026-09-10")),
        },
    ]
}

fn new_journal() -> (Arc<Storage>, Arc<dyn Inventory>) {
    let storage = Arc::new(Storage::open_in_memory().unwrap());
    let journal: Arc<dyn Inventory> = Arc::new(StoredInventory::new(Arc::clone(&storage)));
    (storage, journal)
}

fn inventory(registry: SharedRegistry, journal: Arc<dyn Inventory>) -> RegistryInventory {
    let probe = FakeProbe::default()
        .with(r"C:\Program Files\7-Zip", at("2026-05-05"))
        .with(
            &format!(r"C:\Users\u\AppData\Local\Packages\{BITWARDEN_FAMILY}"),
            at("2026-09-11"),
        );
    let sources = Sources {
        registry: Arc::new(registry),
        packages: Some(Arc::new(packages())),
        probe: Arc::new(probe),
        folders: folders(),
        portable_root: None,
    };
    RegistryInventory::new(&apps(), journal, sources)
        .with_today(Arc::new(|| date(TODAY)))
        .with_ttl(Duration::from_secs(3600))
}

fn app(id: &str, version: &str, last_used: &str) -> InstalledApp {
    InstalledApp {
        app_id: id.into(),
        version: version.into(),
        last_used: last_used.into(),
    }
}

#[test]
fn maps_the_machine_to_catalog_apps() {
    let (_, journal) = new_journal();
    let inv = inventory(machine(), journal);
    assert_eq!(
        inv.installed().unwrap(),
        [
            // UserAssist: Obsidian.exe, inside the uninstaller's folder, ran on 09-20.
            app("obsidian", "1.8.9", "2026-09-20"),
            // Only the voidtools entry counts; its UserAssist date is in the future → today.
            app("everything", "1.4.1.1028", TODAY),
            // HKLM 1.92.2 and HKCU 1.93.0: the highest wins; the newest key write.
            app("vscode", "1.93.0", "2026-09-02"),
            // 5.2.9.0 equals the catalog's 5.2.9 and is reported in its spelling.
            app("krita", "5.2.9", TODAY),
            // The install folder changed after the install date.
            app("sevenzip", "25.01", "2026-05-05"),
            // MSIX: 2026.8.1.0 = 2026.8.1; the family ran on 09-21 (data folder: 09-11).
            app("bitwarden", "2026.8.1", "2026-09-21"),
            // Version from the DisplayName; no evidence → today.
            // An MSI product.
            app("inkscape", "1.4.2", TODAY),
            app("stellarium", "25.2", TODAY),
            // Steam key, no version anywhere → 0.
            app("mindustry", "0", TODAY),
        ]
    );
    assert_eq!(
        inv.find("vscode").unwrap().map(|a| a.version),
        Some("1.93.0".into())
    );
    assert_eq!(
        inv.find("notepadpp").unwrap(),
        None,
        "SystemComponent entries are hidden"
    );
    assert_eq!(inv.find("git").unwrap(), None);
}

#[test]
fn report_lists_what_the_scan_saw() {
    let (_, journal) = new_journal();
    let report = inventory(machine(), journal).scan().unwrap();
    assert_eq!(report.entries.len(), 11, "12 Uninstall keys, one hidden");
    assert_eq!(report.packages.len(), 2);
    assert!(report.errors.is_empty());
    let vscode: Vec<&Detected> = report
        .detected
        .iter()
        .filter(|d| d.app_id == "vscode")
        .collect();
    assert_eq!(vscode.len(), 2);
    assert!(vscode.iter().all(|d| d.kind == MatchKind::ProductCode));
    let bitwarden = report
        .detected
        .iter()
        .find(|d| d.app_id == "bitwarden")
        .unwrap();
    assert_eq!(
        bitwarden.origin,
        Origin::Msix {
            family_name: BITWARDEN_FAMILY.into(),
            name: "8bitSolutionsLLC.bitwardendesktop".into(),
        }
    );
    let obsidian = report
        .detected
        .iter()
        .find(|d| d.app_id == "obsidian")
        .unwrap();
    assert_eq!(
        obsidian.install_dir.as_deref(),
        Some(Path::new(r"C:\Users\u\AppData\Local\Programs\Obsidian"))
    );
}

#[test]
fn journal_supplies_missing_versions_and_records_activity() {
    let (storage, journal) = new_journal();
    storage.seed_from_fixtures().unwrap();
    let inv = inventory(machine(), journal);
    assert_eq!(inv.find("mindustry").unwrap().unwrap().version, "0");
    let before = storage.account().unwrap().usage.updates_installed;

    inv.record(
        &app("mindustry", "146", TODAY),
        ActivityKind::Updated,
        &TODAY.into(),
    )
    .unwrap();
    assert_eq!(
        inv.find("mindustry").unwrap().unwrap().version,
        "146",
        "rescanned after record; the recorded version fills the gap"
    );
    assert_eq!(
        storage.account().unwrap().usage.updates_installed,
        before + 1
    );
    assert_eq!(
        inv.find("vscode").unwrap().unwrap().version,
        "1.93.0",
        "the registry wins over the seeded 1.92.2"
    );
    assert!(
        inv.find("flow").unwrap().is_none(),
        "seeded rows are not installs"
    );
}

#[test]
fn remove_reports_what_the_last_scan_saw() {
    let (storage, journal) = new_journal();
    let inv = inventory(machine(), journal);
    inv.record(
        &app("sevenzip", "25.01", TODAY),
        ActivityKind::Installed,
        &TODAY.into(),
    )
    .unwrap();
    assert!(inv.find("sevenzip").unwrap().is_some());
    assert!(inv.remove("sevenzip").unwrap());
    assert!(
        storage.installed_app("sevenzip").unwrap().is_none(),
        "journal row gone"
    );
    assert!(
        inv.remove("krita").unwrap(),
        "seen by the scan, never journaled"
    );
    assert!(!inv.remove("sharex").unwrap());
}

#[test]
fn scans_are_cached_until_refresh_or_ttl() {
    let (_, journal) = new_journal();
    let reg = machine();
    let inv = inventory(reg.clone(), journal);
    assert!(inv.find("vlc").unwrap().is_none());
    reg.insert(
        RegRoot::LocalMachine,
        UNINSTALL_PATH,
        entry("VLC media player", "VLC media player").with_str("DisplayVersion", "3.0.21"),
    );
    assert!(inv.find("vlc").unwrap().is_none(), "cached");
    inv.refresh();
    assert_eq!(inv.find("vlc").unwrap().unwrap().version, "3.0.21");

    let (_, second) = new_journal();
    let uncached = inventory(reg.clone(), second).with_ttl(Duration::ZERO);
    assert!(uncached.find("audacity").unwrap().is_none());
    reg.insert(
        RegRoot::CurrentUser,
        UNINSTALL_PATH,
        entry("Audacity_is1", "Audacity 3.7.4"),
    );
    assert_eq!(uncached.find("audacity").unwrap().unwrap().version, "3.7.4");
}

#[test]
fn locate_tells_where_apps_were_found() {
    let (_, journal) = new_journal();
    let inv = inventory(machine(), journal);
    let vscode = inv.locate("vscode").unwrap();
    assert_eq!(vscode.len(), 2, "per-machine and per-user copies");
    let inkscape = inv.locate("inkscape").unwrap();
    assert_eq!(
        inkscape,
        [Detected {
            app_id: "inkscape".into(),
            origin: Origin::Uninstall {
                root: RegRoot::LocalMachine,
                key: INKSCAPE_CODE.into(),
                windows_installer: true,
                uninstall_string: Some(format!("MsiExec.exe /X{INKSCAPE_CODE}")),
                quiet_uninstall_string: None,
            },
            kind: MatchKind::DisplayName,
            version: Some("1.4.2".into()),
            install_dir: None,
            program: None,
        }]
    );
    let bitwarden = inv.locate("bitwarden").unwrap();
    assert!(matches!(bitwarden[0].origin, Origin::Msix { .. }));
    assert!(inv.locate("sharex").unwrap().is_empty());
    let shared: Arc<dyn Inventory> = Arc::new(inv);
    assert_eq!(
        shared.locate("vscode").unwrap().len(),
        2,
        "through the trait"
    );
}

#[test]
fn portable_apps_in_the_paparats_folder() {
    let root = tempfile::tempdir().unwrap();
    let apps_dir = root.path().join("apps");
    let make = |app: &str, version: &str| {
        let dir = apps_dir.join(app).join(version);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("app.exe"), b"MZ").unwrap();
    };
    make("obsidian", "1.8.10");
    make("sharex", "16.9.0");
    make("sharex", "17.0.0");
    make("sharex", ".17.1.0.partial-1-2");
    make("not-in-catalog", "1.0");
    std::fs::write(apps_dir.join("stray.txt"), b"").unwrap();

    let (_, journal) = new_journal();
    let today = Local::now().date_naive();
    let sources = Sources {
        registry: Arc::new(machine()),
        packages: None,
        probe: Arc::new(DiskProbe::default()),
        folders: folders(),
        portable_root: None,
    };
    let inv = RegistryInventory::new(&apps(), journal, sources)
        .with_today(Arc::new(move || today))
        .with_portable_root(Some(apps_dir.clone()));
    let obsidian = inv.find("obsidian").unwrap().unwrap();
    assert_eq!(
        obsidian.version, "1.8.10",
        "the portable copy is newer than the registry's 1.8.9"
    );
    let sharex = inv.find("sharex").unwrap().unwrap();
    assert_eq!(
        sharex.version, "17.0.0",
        "highest version folder; staging ignored"
    );
    assert_eq!(
        sharex.last_used,
        dates::format(today),
        "files were just written"
    );
    let located = inv.locate("sharex").unwrap();
    assert_eq!(located.len(), 1);
    assert_eq!(located[0].origin, Origin::Portable);
    assert_eq!(located[0].kind, MatchKind::PortableFolder);
    assert_eq!(
        located[0].install_dir.as_deref(),
        Some(apps_dir.join("sharex").join("17.0.0").as_path())
    );
    assert!(
        !inv.installed()
            .unwrap()
            .iter()
            .any(|a| a.app_id == "not-in-catalog")
    );
}

#[test]
fn default_portable_folder_follows_local_app_data() {
    assert_eq!(
        default_portable_root(&folders()),
        Some(PathBuf::from(r"C:\Users\u\AppData\Local\Paparats\apps"))
    );
    assert_eq!(default_portable_root(&KnownFolders::default()), None);
}

#[test]
fn a_failing_source_does_not_hide_the_others() {
    let (_, journal) = new_journal();
    let sources = Sources {
        registry: Arc::new(machine()),
        packages: Some(Arc::new(FailingPackages)),
        probe: Arc::new(crate::source::NoFolders),
        folders: folders(),
        portable_root: None,
    };
    let inv =
        RegistryInventory::new(&apps(), journal, sources).with_today(Arc::new(|| date(TODAY)));
    let report = inv.scan().unwrap();
    assert_eq!(report.errors, ["MSIX packages: Class not registered"]);
    assert!(report.installed.iter().any(|a| a.app_id == "sevenzip"));
    assert!(!report.installed.iter().any(|a| a.app_id == "bitwarden"));
}

#[test]
fn catalog_changes_rebuild_the_rules() {
    let (_, journal) = new_journal();
    let inv = RegistryInventory::new(
        &[],
        journal,
        Sources {
            registry: Arc::new(machine()),
            ..Sources::empty()
        },
    );
    assert!(inv.installed().unwrap().is_empty());
    assert!(
        inv.scan().unwrap().entries.is_empty(),
        "no rules → nothing read"
    );
    inv.set_catalog(&apps());
    assert!(inv.find("sevenzip").unwrap().is_some());
    let only_krita: Vec<App> = apps().into_iter().filter(|a| a.id == "krita").collect();
    inv.set_catalog(&only_krita);
    let ids: Vec<String> = inv
        .installed()
        .unwrap()
        .into_iter()
        .map(|a| a.app_id)
        .collect();
    assert_eq!(ids, ["krita"]);
}

/// Scans this PC for the 32 fixture apps and prints what it found. Reads the registry (Uninstall
/// keys, UserAssist) and the MSIX package list; writes nothing. Run it by hand:
/// `cargo test -p paparats-inventory -- --ignored --nocapture scan_this_machine`.
#[test]
#[ignore = "reads this PC's registry and MSIX packages; run with --ignored --nocapture"]
fn scan_this_machine() {
    let (_, journal) = new_journal();
    let inv = RegistryInventory::system(&apps(), journal);
    let report = inv.scan().unwrap();
    let folders = KnownFolders::from_env();
    println!(
        "\n{} Uninstall entries, {} MSIX packages, {} errors, {} ms\n",
        report.entries.len(),
        report.packages.len(),
        report.errors.len(),
        report.duration.as_millis()
    );
    for e in &report.entries {
        println!(
            "{:<17} {:<50} {:<16} {:<30} key={} dir={:?} installed={:?}",
            e.root.label(),
            e.display_name,
            e.version.as_deref().unwrap_or("-"),
            e.publisher.as_deref().unwrap_or("-"),
            e.key,
            e.install_dir(&folders),
            e.install_date,
        );
    }
    println!();
    for p in &report.packages {
        println!(
            "MSIX {:<64} {:<16} {:?}",
            p.family_name, p.version, p.install_location
        );
    }
    println!("\nDetected catalog apps:");
    for d in &report.detected {
        println!(
            "  {:<14} {:?} via {:?}, version {:?}, dir {:?}",
            d.app_id, d.kind, d.origin, d.version, d.install_dir
        );
    }
    println!("\nInventory:");
    for a in &report.installed {
        println!(
            "  {:<14} {:<14} last used {}",
            a.app_id, a.version, a.last_used
        );
    }
    for e in &report.errors {
        println!("error: {e}");
    }
    #[cfg(windows)]
    {
        let t = Instant::now();
        let n = crate::windows::MsixPackages.packages().map(|p| p.len());
        println!(
            "
MSIX alone: {n:?} packages in {} ms",
            t.elapsed().as_millis()
        );
        let t = Instant::now();
        let usage = UsageIndex::read(&crate::windows::WinRegistry, &folders);
        println!(
            "UserAssist alone: {} ms, empty = {:?}",
            t.elapsed().as_millis(),
            usage.map(|u| u.is_empty())
        );
    }
    assert!(report.errors.is_empty(), "{:?}", report.errors);
}
