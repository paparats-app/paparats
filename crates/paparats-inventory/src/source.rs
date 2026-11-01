//! What the real scan reads, behind traits so parsing and mapping are unit-tested with fake data:
//! registry keys ([`RegistryReader`]), MSIX packages ([`PackageSource`]) and folder times
//! ([`FolderProbe`]). The Windows implementations live in `crate::windows`.

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Local, NaiveDate};

/// A failure of one scan source. The scan logs it and carries on with the other sources.
#[derive(Debug, thiserror::Error)]
pub enum SourceError {
    #[error("registry {}\\{path}: {source}", root.label())]
    Registry {
        root: RegRoot,
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("MSIX packages: {0}")]
    Packages(String),
}

/// A registry root the scan reads.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum RegRoot {
    /// `HKEY_CURRENT_USER` (per-user installs; not redirected on 64-bit Windows).
    CurrentUser,
    /// `HKEY_LOCAL_MACHINE`, 64-bit view.
    LocalMachine,
    /// `HKEY_LOCAL_MACHINE`, 32-bit view (`Software\WOW6432Node`).
    LocalMachine32,
}

impl RegRoot {
    /// The three roots whose Uninstall keys make up "Installed apps".
    pub const UNINSTALL_ROOTS: [RegRoot; 3] = [
        RegRoot::CurrentUser,
        RegRoot::LocalMachine,
        RegRoot::LocalMachine32,
    ];

    pub const fn label(self) -> &'static str {
        match self {
            RegRoot::CurrentUser => "HKCU",
            RegRoot::LocalMachine => "HKLM",
            RegRoot::LocalMachine32 => "HKLM\\WOW6432Node",
        }
    }
}

/// A registry value, as far as the scan cares.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegData {
    /// `REG_SZ` / `REG_EXPAND_SZ` (not expanded), without trailing NULs.
    String(String),
    Dword(u32),
    Qword(u64),
    Binary(Vec<u8>),
    /// Any other type (`REG_MULTI_SZ`, `REG_NONE`, …).
    Other,
}

/// One registry key: its name under the parent, last-write time and values.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RegKeyData {
    pub name: String,
    pub last_write: Option<SystemTime>,
    pub values: Vec<(String, RegData)>,
}

impl RegKeyData {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            ..Self::default()
        }
    }

    /// Builder: adds a value.
    pub fn with(mut self, name: impl Into<String>, data: RegData) -> Self {
        self.values.push((name.into(), data));
        self
    }

    /// Builder: adds a `REG_SZ` value.
    pub fn with_str(self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.with(name, RegData::String(value.into()))
    }

    /// Builder: sets the last-write time.
    pub fn written(mut self, at: SystemTime) -> Self {
        self.last_write = Some(at);
        self
    }

    /// A value by name (registry value names are case-insensitive).
    pub fn value(&self, name: &str) -> Option<&RegData> {
        self.values
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, d)| d)
    }

    /// A non-empty string value, trimmed.
    pub fn string(&self, name: &str) -> Option<&str> {
        match self.value(name)? {
            RegData::String(s) => Some(s.trim()).filter(|s| !s.is_empty()),
            _ => None,
        }
    }

    /// A number stored as `REG_DWORD`, `REG_QWORD` or a decimal string (some installers do).
    pub fn number(&self, name: &str) -> Option<u64> {
        match self.value(name)? {
            RegData::Dword(n) => Some(u64::from(*n)),
            RegData::Qword(n) => Some(*n),
            RegData::String(s) => s.trim().parse().ok(),
            RegData::Binary(_) | RegData::Other => None,
        }
    }
}

/// Read-only registry access.
pub trait RegistryReader: Send + Sync {
    /// The subkeys of `path` under `root`, each with its values and last-write time. A missing
    /// `path` is empty, not an error; subkeys that cannot be opened are skipped.
    fn subkeys(&self, root: RegRoot, path: &str) -> Result<Vec<RegKeyData>, SourceError>;
}

/// A registry with no keys (non-Windows builds, tests).
#[derive(Debug, Clone, Copy, Default)]
pub struct EmptyRegistry;

impl RegistryReader for EmptyRegistry {
    fn subkeys(&self, _root: RegRoot, _path: &str) -> Result<Vec<RegKeyData>, SourceError> {
        Ok(Vec::new())
    }
}

/// An in-memory registry: `(root, path)` → subkeys (path compared case-insensitively). For tests
/// and for replaying a captured scan.
#[derive(Debug, Clone, Default)]
pub struct MemoryRegistry {
    keys: BTreeMap<(RegRoot, String), Vec<RegKeyData>>,
}

impl MemoryRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds a subkey under `path`.
    pub fn insert(&mut self, root: RegRoot, path: &str, key: RegKeyData) {
        self.keys
            .entry((root, path.to_ascii_lowercase()))
            .or_default()
            .push(key);
    }

    /// Builder form of [`MemoryRegistry::insert`].
    pub fn with(mut self, root: RegRoot, path: &str, key: RegKeyData) -> Self {
        self.insert(root, path, key);
        self
    }
}

impl RegistryReader for MemoryRegistry {
    fn subkeys(&self, root: RegRoot, path: &str) -> Result<Vec<RegKeyData>, SourceError> {
        Ok(self
            .keys
            .get(&(root, path.to_ascii_lowercase()))
            .cloned()
            .unwrap_or_default())
    }
}

/// An MSIX/AppX main package installed for the current user.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MsixPackage {
    /// Package name, e.g. `8bitSolutionsLLC.bitwardendesktop`.
    pub name: String,
    /// `Name_PublisherHash`, the identity detection rules use.
    pub family_name: String,
    /// `Major.Minor.Build.Revision`.
    pub version: String,
    pub install_location: Option<PathBuf>,
    pub installed: Option<SystemTime>,
}

/// Installed MSIX/AppX packages.
pub trait PackageSource: Send + Sync {
    fn packages(&self) -> Result<Vec<MsixPackage>, SourceError>;
}

/// A fixed package list (tests).
impl PackageSource for Vec<MsixPackage> {
    fn packages(&self) -> Result<Vec<MsixPackage>, SourceError> {
        Ok(self.clone())
    }
}

/// Folder modification times (the "last used" evidence on disk) and folder listings (Paparats'
/// portable apps).
pub trait FolderProbe: Send + Sync {
    /// Newest last-write time of `dir` and of its entries up to two levels down (bounded; links
    /// and junctions are not followed). `None` when `dir` is not a readable folder.
    fn newest_write(&self, dir: &Path) -> Option<SystemTime>;

    /// Names of the folders directly inside `dir`, without hidden/staging ones (a leading `.`)
    /// and links. Empty when `dir` cannot be read.
    fn subfolders(&self, _dir: &Path) -> Vec<String> {
        Vec::new()
    }
}

/// [`FolderProbe`] over the real file system.
#[derive(Debug, Clone, Copy)]
pub struct DiskProbe {
    /// Entries looked at per probe, at most — the folder and its sub-folders together (a large
    /// install folder stays cheap).
    pub max_entries: usize,
}

impl Default for DiskProbe {
    fn default() -> Self {
        Self { max_entries: 256 }
    }
}

impl FolderProbe for DiskProbe {
    fn newest_write(&self, dir: &Path) -> Option<SystemTime> {
        let meta = std::fs::metadata(dir).ok()?;
        if !meta.is_dir() {
            return None;
        }
        let mut newest = meta.modified().ok();
        let mut budget = self.max_entries;
        let mut pending = vec![(dir.to_path_buf(), 0_u8)];
        while let Some((folder, depth)) = pending.pop() {
            let Ok(entries) = std::fs::read_dir(&folder) else {
                continue;
            };
            for entry in entries.flatten() {
                if budget == 0 {
                    return newest;
                }
                budget -= 1;
                let Ok(kind) = entry.file_type() else {
                    continue;
                };
                if kind.is_symlink() {
                    continue;
                }
                if let Some(t) = entry.metadata().ok().and_then(|m| m.modified().ok()) {
                    newest = newest.max(Some(t));
                }
                if kind.is_dir() && depth == 0 {
                    pending.push((entry.path(), depth + 1));
                }
            }
        }
        newest
    }

    fn subfolders(&self, dir: &Path) -> Vec<String> {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return Vec::new();
        };
        entries
            .flatten()
            .filter(|e| e.file_type().is_ok_and(|t| t.is_dir() && !t.is_symlink()))
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|name| !name.starts_with('.'))
            .collect()
    }
}

/// A probe that finds nothing (tests).
#[derive(Debug, Clone, Copy, Default)]
pub struct NoFolders;

impl FolderProbe for NoFolders {
    fn newest_write(&self, _dir: &Path) -> Option<SystemTime> {
        None
    }
}

/// Well-known folders the scan resolves paths against.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct KnownFolders {
    /// `%windir%`: entries whose only folder hint points here are system tools, not app folders.
    pub windows: Option<PathBuf>,
    /// `%LOCALAPPDATA%` (per-user installs, MSIX package data under `Packages\<family>`).
    pub local_app_data: Option<PathBuf>,
    /// `%APPDATA%`.
    pub roaming_app_data: Option<PathBuf>,
    /// `%USERPROFILE%`.
    pub profile: Option<PathBuf>,
    /// 64-bit Program Files (`%ProgramW6432%`, else `%ProgramFiles%`).
    pub program_files: Option<PathBuf>,
    /// `%ProgramFiles(x86)%`.
    pub program_files_x86: Option<PathBuf>,
    /// `%ProgramData%` (the Start menu of all users).
    pub program_data: Option<PathBuf>,
}

impl KnownFolders {
    /// Reads the folders from the environment of this process.
    pub fn from_env() -> Self {
        let var = |name: &str| std::env::var_os(name).filter(|v| !v.is_empty());
        let path = |v: Option<OsString>| v.map(PathBuf::from);
        Self {
            windows: path(var("SystemRoot").or_else(|| var("windir"))),
            local_app_data: path(var("LOCALAPPDATA")),
            roaming_app_data: path(var("APPDATA")),
            profile: path(var("USERPROFILE")),
            program_files: path(var("ProgramW6432").or_else(|| var("ProgramFiles"))),
            program_files_x86: path(var("ProgramFiles(x86)")),
            program_data: path(var("ProgramData")),
        }
    }

    /// The folder behind a `KNOWNFOLDERID` (the ones Explorer writes into UserAssist paths).
    pub fn by_guid(&self, guid: &str) -> Option<PathBuf> {
        let guid = guid.trim_matches(|c| c == '{' || c == '}');
        let upper = guid.to_ascii_uppercase();
        let sub = |base: &Option<PathBuf>, rel: &str| base.as_ref().map(|b| b.join(rel));
        match upper.as_str() {
            // FOLDERID_ProgramFilesX64 / FOLDERID_ProgramFiles
            "6D809377-6AF0-444B-8957-A3773F02200E" | "905E63B6-C1BF-494E-B29C-65B732D3D21A" => {
                self.program_files.clone()
            }
            // FOLDERID_ProgramFilesX86
            "7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E" => self.program_files_x86.clone(),
            // FOLDERID_Windows
            "F38BF404-1D43-42F2-9305-67DE0B28FC23" => self.windows.clone(),
            // FOLDERID_System / FOLDERID_SystemX86
            "1AC14E77-02E7-4E5D-B744-2EB1AE5198B7" => sub(&self.windows, "System32"),
            "D65231B0-B2F1-4857-A4CE-A8E7C6EA7D27" => sub(&self.windows, "SysWOW64"),
            // FOLDERID_LocalAppData / FOLDERID_RoamingAppData / FOLDERID_Profile
            "F1B32785-6FBA-4FCF-9D55-7B8E7F157091" => self.local_app_data.clone(),
            "3EB685DB-65F9-4CF6-A03A-E3EF65729F3D" => self.roaming_app_data.clone(),
            "5E6C858F-0E22-4760-9AFE-EA3317B67173" => self.profile.clone(),
            _ => None,
        }
    }
}

/// FILETIME ticks between 1601-01-01 and 1970-01-01.
const FILETIME_UNIX_EPOCH: u64 = 116_444_736_000_000_000;

/// A Windows FILETIME / WinRT `DateTime` (100 ns ticks since 1601-01-01 UTC) as a
/// [`SystemTime`]. Zero and pre-1970 values (unset fields) are `None`.
pub fn filetime_to_system(ticks: u64) -> Option<SystemTime> {
    let since_unix = ticks.checked_sub(FILETIME_UNIX_EPOCH)?;
    if since_unix == 0 {
        return None;
    }
    let secs = since_unix / 10_000_000;
    // < 10^7 ticks × 100 ns < 10^9: always fits in u32.
    let nanos = u32::try_from((since_unix % 10_000_000) * 100).ok()?;
    UNIX_EPOCH.checked_add(Duration::new(secs, nanos))
}

/// The local calendar day of `t`.
pub fn local_date(t: SystemTime) -> NaiveDate {
    DateTime::<Local>::from(t).date_naive()
}

/// Whether `path` is `dir` or inside it (case-insensitive, `/` = `\`, like Windows paths).
pub fn path_within(path: &Path, dir: &Path) -> bool {
    let norm = |p: &Path| {
        p.to_string_lossy()
            .replace('/', "\\")
            .trim_end_matches('\\')
            .to_lowercase()
    };
    let (path, dir) = (norm(path), norm(dir));
    !dir.is_empty()
        && (path == dir || (path.starts_with(&dir) && path[dir.len()..].starts_with('\\')))
}

#[cfg(test)]
mod tests {
    use std::fs::File;

    use super::*;

    #[test]
    fn filetime_conversion() {
        assert_eq!(filetime_to_system(0), None);
        assert_eq!(filetime_to_system(FILETIME_UNIX_EPOCH), None);
        // 2024-01-15T00:00:00Z = 1705276800 s after the Unix epoch.
        let ticks = FILETIME_UNIX_EPOCH + 1_705_276_800 * 10_000_000 + 5;
        let t = filetime_to_system(ticks).unwrap();
        assert_eq!(
            t.duration_since(UNIX_EPOCH).unwrap(),
            Duration::new(1_705_276_800, 500)
        );
    }

    #[test]
    fn key_values_are_case_insensitive_and_typed() {
        let key = RegKeyData::new("x")
            .with_str("DisplayName", "  Obsidian  ")
            .with_str("Empty", "   ")
            .with("SystemComponent", RegData::Dword(1))
            .with_str("EstimatedSize", "42")
            .with("Big", RegData::Qword(7));
        assert_eq!(key.string("displayname"), Some("Obsidian"));
        assert_eq!(key.string("Empty"), None);
        assert_eq!(key.string("SystemComponent"), None);
        assert_eq!(key.number("systemcomponent"), Some(1));
        assert_eq!(key.number("EstimatedSize"), Some(42));
        assert_eq!(key.number("Big"), Some(7));
        assert_eq!(key.number("DisplayName"), None);
    }

    #[test]
    fn memory_registry_paths_ignore_case() {
        let reg =
            MemoryRegistry::new().with(RegRoot::CurrentUser, r"Software\X", RegKeyData::new("a"));
        assert_eq!(
            reg.subkeys(RegRoot::CurrentUser, r"SOFTWARE\x")
                .unwrap()
                .len(),
            1
        );
        assert!(
            reg.subkeys(RegRoot::LocalMachine, r"Software\X")
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn known_folder_guids() {
        let f = KnownFolders {
            windows: Some(PathBuf::from(r"C:\Windows")),
            program_files: Some(PathBuf::from(r"C:\Program Files")),
            program_files_x86: Some(PathBuf::from(r"C:\Program Files (x86)")),
            ..KnownFolders::default()
        };
        assert_eq!(
            f.by_guid("{6D809377-6AF0-444B-8957-A3773F02200E}"),
            Some(PathBuf::from(r"C:\Program Files"))
        );
        assert_eq!(
            f.by_guid("7c5a40ef-a0fb-4bfc-874a-c0f2e0b9fa8e"),
            Some(PathBuf::from(r"C:\Program Files (x86)"))
        );
        assert_eq!(
            f.by_guid("{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}"),
            Some(PathBuf::from(r"C:\Windows").join("System32"))
        );
        assert_eq!(
            f.by_guid("{F1B32785-6FBA-4FCF-9D55-7B8E7F157091}"),
            None,
            "unset"
        );
        assert_eq!(f.by_guid("{00000000-0000-0000-0000-000000000000}"), None);
    }

    #[test]
    fn paths_within_folders() {
        let dir = Path::new(r"C:\Apps\Foo\");
        assert!(path_within(Path::new(r"c:\apps\foo\bin\foo.exe"), dir));
        assert!(path_within(Path::new(r"C:/Apps/Foo"), dir));
        assert!(!path_within(Path::new(r"C:\Apps\FooBar\foo.exe"), dir));
        assert!(!path_within(Path::new(r"C:\Apps"), dir));
        assert!(!path_within(Path::new(r"C:\x.exe"), Path::new("")));
    }

    fn touch(path: &Path, at: SystemTime) {
        let f = File::options()
            .write(true)
            .create(true)
            .truncate(false)
            .open(path)
            .unwrap();
        f.set_modified(at).unwrap();
    }

    #[test]
    fn disk_probe_reads_two_levels() {
        let root = tempfile::tempdir().unwrap();
        let now = SystemTime::now();
        let day = Duration::from_secs(86_400);
        std::fs::create_dir_all(root.path().join("a").join("b")).unwrap();
        touch(&root.path().join("top.txt"), now + day);
        touch(&root.path().join("a").join("second.txt"), now + 5 * day);
        touch(
            &root.path().join("a").join("b").join("deep.txt"),
            now + 30 * day,
        );

        let newest = DiskProbe::default().newest_write(root.path()).unwrap();
        let diff = |a: SystemTime, b: SystemTime| {
            a.duration_since(b)
                .or_else(|_| b.duration_since(a))
                .unwrap()
        };
        assert!(
            diff(newest, now + 5 * day) < Duration::from_secs(2),
            "second level counts, third does not"
        );

        let capped = DiskProbe { max_entries: 0 }
            .newest_write(root.path())
            .unwrap();
        assert!(capped < now + day, "only the folder itself");

        let mut folders = DiskProbe::default().subfolders(root.path());
        folders.sort();
        assert_eq!(folders, ["a"], "files are not folders");
        std::fs::create_dir(root.path().join(".staging")).unwrap();
        assert_eq!(
            DiskProbe::default().subfolders(root.path()),
            ["a"],
            "hidden folders skipped"
        );
        assert!(
            DiskProbe::default()
                .subfolders(&root.path().join("missing"))
                .is_empty()
        );

        assert_eq!(
            DiskProbe::default().newest_write(&root.path().join("missing")),
            None
        );
        assert_eq!(
            DiskProbe::default().newest_write(&root.path().join("top.txt")),
            None
        );
    }
}
