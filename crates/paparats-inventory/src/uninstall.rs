//! Uninstall entries — what "Installed apps" in Windows Settings lists — parsed from the
//! `Software\Microsoft\Windows\CurrentVersion\Uninstall` subkeys of HKCU, HKLM and HKLM's 32-bit
//! view (`WOW6432Node`).

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use chrono::{DateTime, NaiveDate};

use crate::source::{KnownFolders, RegData, RegKeyData, RegRoot, path_within};

/// Where the Uninstall entries live under each [`RegRoot`].
pub const UNINSTALL_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";

/// `ReleaseType`s of entries that patch another product (listed under "Installed updates").
const UPDATE_RELEASE_TYPES: [&str; 5] = [
    "security update",
    "update rollup",
    "hotfix",
    "update",
    "service pack",
];

/// One installed program.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UninstallEntry {
    pub root: RegRoot,
    /// Key name: an MSI product code, an Inno Setup id (`{GUID}_is1`) or the installer's own name.
    pub key: String,
    pub display_name: String,
    /// `display_name` without trailing versions and architecture tags, for rule matching.
    pub base_name: String,
    /// `DisplayVersion` (first version-like token), else `VersionMajor.VersionMinor`, else the
    /// packed MSI `Version`, else the version in the `DisplayName`.
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub install_location: Option<PathBuf>,
    pub display_icon: Option<String>,
    pub uninstall_string: Option<String>,
    pub quiet_uninstall_string: Option<String>,
    pub install_date: Option<NaiveDate>,
    /// Last-write time of the entry's key (the installer touched it: install or update).
    pub last_write: Option<SystemTime>,
    /// `WindowsInstaller` = 1: an MSI product whose key name is the product code.
    pub windows_installer: bool,
}

impl UninstallEntry {
    /// Parses one Uninstall subkey. `None` for the entries Windows hides as well: no
    /// `DisplayName`, `SystemComponent` = 1, a `ParentKeyName` (an update of another entry) or an
    /// update `ReleaseType`.
    pub fn parse(root: RegRoot, key: &RegKeyData) -> Option<Self> {
        let display_name = key.string("DisplayName")?.to_owned();
        if key.number("SystemComponent") == Some(1) || key.string("ParentKeyName").is_some() {
            return None;
        }
        if key
            .string("ReleaseType")
            .is_some_and(|t| UPDATE_RELEASE_TYPES.contains(&t.to_ascii_lowercase().as_str()))
        {
            return None;
        }
        let (base_name, name_version) = split_display_name(&display_name);
        let version = key
            .string("DisplayVersion")
            .and_then(clean_version)
            .or_else(|| major_minor(key))
            .or_else(|| key.number("Version").and_then(unpack_msi_version))
            .or(name_version);
        Some(Self {
            root,
            key: key.name.clone(),
            base_name,
            version,
            publisher: key.string("Publisher").map(str::to_owned),
            install_location: key
                .string("InstallLocation")
                .map(unquote)
                .filter(|p| !p.is_empty())
                .map(PathBuf::from),
            display_icon: key.string("DisplayIcon").map(str::to_owned),
            uninstall_string: key.string("UninstallString").map(str::to_owned),
            quiet_uninstall_string: key.string("QuietUninstallString").map(str::to_owned),
            install_date: key.value("InstallDate").and_then(parse_install_date),
            last_write: key.last_write,
            windows_installer: key.number("WindowsInstaller") == Some(1),
            display_name,
        })
    }

    /// The folder the app lives in: `InstallLocation`, else the folder of `DisplayIcon`, else the
    /// folder of the uninstaller — unless that is under `%windir%` (`MsiExec.exe`) or an installer
    /// cache (`Package Cache`, `Installer`).
    pub fn install_dir(&self, folders: &KnownFolders) -> Option<PathBuf> {
        if let Some(dir) = &self.install_location {
            return Some(dir.clone());
        }
        let from_icon = self.display_icon.as_deref().and_then(icon_file);
        let from_uninstaller = self.uninstall_string.as_deref().and_then(command_file);
        [from_icon, from_uninstaller]
            .into_iter()
            .flatten()
            .filter_map(|file| file.parent().map(Path::to_path_buf))
            .find(|dir| usable_dir(dir, folders))
    }
}

impl UninstallEntry {
    /// The program the app starts with: the `.exe` its `DisplayIcon` names, unless that is an
    /// uninstaller or lives under `%windir%` or an installer cache. What "Open" runs.
    pub fn program(&self, folders: &KnownFolders) -> Option<PathBuf> {
        let file = self.display_icon.as_deref().and_then(icon_file)?;
        let exe = file
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("exe"));
        let name = file
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let uninstaller = name.starts_with("unins") || name.contains("uninstall");
        let dir = file.parent()?;
        (exe && !uninstaller && usable_dir(dir, folders)).then_some(file)
    }
}

fn usable_dir(dir: &Path, folders: &KnownFolders) -> bool {
    if dir.as_os_str().is_empty() || (!dir.is_absolute() && !looks_absolute(dir)) {
        return false;
    }
    if folders
        .windows
        .as_deref()
        .is_some_and(|w| path_within(dir, w))
    {
        return false;
    }
    let lower = dir.to_string_lossy().to_lowercase();
    !(lower.contains("\\package cache\\") || lower.contains("\\windows\\installer"))
}

/// `C:\…` or `\\server\…` — `Path::is_absolute` only knows this on Windows.
fn looks_absolute(p: &Path) -> bool {
    let s = p.to_string_lossy();
    let b = s.as_bytes();
    (b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && (b[2] == b'\\' || b[2] == b'/'))
        || s.starts_with("\\\\")
}

fn unquote(s: &str) -> String {
    s.trim().trim_matches('"').trim().to_owned()
}

/// `"C:\App\app.exe",0` → `C:\App\app.exe`.
fn icon_file(icon: &str) -> Option<PathBuf> {
    let s = icon.trim();
    let s = match s.strip_prefix('"') {
        Some(rest) => rest.split('"').next().unwrap_or(rest),
        None => match s.rsplit_once(',') {
            Some((file, index)) if index.trim().parse::<i32>().is_ok() => file,
            _ => s,
        },
    };
    let s = s.trim();
    (!s.is_empty()).then(|| PathBuf::from(s))
}

/// The program of a command line: the quoted first token, else everything up to `.exe`.
fn command_file(command: &str) -> Option<PathBuf> {
    let s = command.trim();
    let file = if let Some(rest) = s.strip_prefix('"') {
        rest.split('"').next()?
    } else {
        let lower = s.to_ascii_lowercase();
        match lower.find(".exe") {
            Some(i) => &s[..i + 4],
            None => s.split_whitespace().next()?,
        }
    };
    let file = file.trim();
    (!file.is_empty()).then(|| PathBuf::from(file))
}

fn major_minor(key: &RegKeyData) -> Option<String> {
    let major = key.number("VersionMajor")?;
    Some(match key.number("VersionMinor") {
        Some(minor) => format!("{major}.{minor}"),
        None => major.to_string(),
    })
}

/// MSI packs `major.minor.build` as `major << 24 | minor << 16 | build`.
fn unpack_msi_version(packed: u64) -> Option<String> {
    let packed = u32::try_from(packed).ok().filter(|&v| v != 0)?;
    Some(format!(
        "{}.{}.{}",
        packed >> 24,
        (packed >> 16) & 0xff,
        packed & 0xffff
    ))
}

/// The version inside free text, without surrounding punctuation: the first version-like token
/// (digits, or dotted), else the first token that starts with a digit.
/// `"1.93.0 (user setup)"` → `1.93.0`, `"2024a"` → `2024a`.
pub fn clean_version(raw: &str) -> Option<String> {
    let tokens = || {
        raw.split_whitespace()
            .map(|t| t.trim_matches(|c: char| matches!(c, '(' | ')' | '[' | ']' | ',' | ';')))
    };
    tokens()
        .find(|t| looks_like_version(t))
        .or_else(|| tokens().find(|t| t.starts_with(|c: char| c.is_ascii_digit())))
        .map(str::to_owned)
}

/// `146`, `25.01`, `v2.0.0-beta.2` — but not `3D` or `1Password`.
fn looks_like_version(token: &str) -> bool {
    let t = token
        .strip_prefix(['v', 'V'])
        .filter(|rest| rest.starts_with(|c: char| c.is_ascii_digit()))
        .unwrap_or(token);
    t.starts_with(|c: char| c.is_ascii_digit())
        && (t.bytes().all(|b| b.is_ascii_digit()) || t.contains('.'))
        && t.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+'))
}

/// Architecture words stripped from the end of a name, alone or in parentheses.
const ARCH_WORDS: [&str; 10] = [
    "x64", "x86", "x86_64", "x86-64", "amd64", "arm64", "aarch64", "64-bit", "32-bit", "win64",
];
/// Words that only count inside a parenthesised architecture tag: `(64 bit)`, `(x64 edition)`.
const ARCH_FILLER: [&str; 6] = ["64", "32", "bit", "edition", "version", "win32"];

/// The word before a version: Inno Setup writes `AppName version X` in the setup's language
/// (`Hiddify, версия 4.1.1`), so the UI languages' forms count too.
const VERSION_WORDS: [&str; 6] = ["version", "ver.", "ver", "v", "версия", "версія"];

fn is_arch_word(w: &str) -> bool {
    let w = w.to_ascii_lowercase();
    ARCH_WORDS.contains(&w.as_str())
}

/// Splits a `DisplayName` into its base name and the version it carries, stripping trailing
/// versions (`7-Zip 25.01`), the word "version" before them (`LocalSend version 1.17.0`,
/// `Hiddify, версия 4.1.1`), architecture tags (`(x64)`, `(64-bit x64)`, `x64`) and dangling
/// separators, in any order. The first word always stays.
pub fn split_display_name(name: &str) -> (String, Option<String>) {
    strip_tail(name, true)
}

/// A `DisplayName` without trailing architecture tags only: `Heroes 3 (x64)` → `Heroes 3`.
pub fn strip_architecture(name: &str) -> String {
    strip_tail(name, false).0
}

fn strip_tail(name: &str, versions: bool) -> (String, Option<String>) {
    let mut s = name.trim();
    let mut version = None;
    loop {
        let before = s;
        if let Some(inner) = s.strip_suffix(')') {
            if let Some(open) = inner.rfind('(') {
                let tag = &inner[open + 1..];
                let words: Vec<&str> = tag
                    .split(|c: char| c.is_whitespace() || c == ',' || c == '/')
                    .filter(|w| !w.is_empty())
                    .collect();
                let arch = !words.is_empty()
                    && words.iter().any(|w| is_arch_word(w))
                    && words.iter().all(|w| {
                        is_arch_word(w) || ARCH_FILLER.contains(&w.to_ascii_lowercase().as_str())
                    });
                let head = inner[..open].trim_end();
                if !head.is_empty() {
                    if arch {
                        s = head;
                    } else if versions && words.len() == 1 && looks_like_version(tag.trim()) {
                        version.get_or_insert_with(|| tag.trim().to_owned());
                        s = head;
                    }
                }
            }
        } else if let Some((head, last)) = s.rsplit_once(char::is_whitespace) {
            let head = head.trim_end();
            if !head.is_empty() {
                let lower = last.to_ascii_lowercase();
                if is_arch_word(last) || (versions && matches!(lower.as_str(), "-" | "–" | "—"))
                {
                    s = head;
                } else if versions && looks_like_version(last) {
                    version.get_or_insert_with(|| last.to_owned());
                    s = head;
                } else if version.is_some() && VERSION_WORDS.contains(&last.to_lowercase().as_str())
                {
                    s = head;
                }
            }
        }
        let unpunctuated = s.trim_end_matches([',', ';', ':']).trim_end();
        if !unpunctuated.is_empty() {
            s = unpunctuated;
        }
        if s == before {
            break;
        }
    }
    (s.to_owned(), version)
}

/// `InstallDate`: `YYYYMMDD` (the documented form), `YYYY-MM-DD`, `YYYY/MM/DD`, US `M/D/YYYY`,
/// or a number — `YYYYMMDD` or Unix seconds.
pub fn parse_install_date(data: &RegData) -> Option<NaiveDate> {
    let plausible = |d: NaiveDate| {
        (1990..=2100)
            .contains(&chrono::Datelike::year(&d))
            .then_some(d)
    };
    match data {
        RegData::String(s) => {
            let s = s.trim();
            ymd_digits(s)
                .or_else(|| {
                    ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"]
                        .iter()
                        .find_map(|f| NaiveDate::parse_from_str(s, f).ok())
                })
                .and_then(plausible)
        }
        RegData::Dword(n) => number_date(u64::from(*n)).and_then(plausible),
        RegData::Qword(n) => number_date(*n).and_then(plausible),
        RegData::Binary(_) | RegData::Other => None,
    }
}

/// `YYYYMMDD`.
fn ymd_digits(s: &str) -> Option<NaiveDate> {
    if s.len() != 8 || !s.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let year = s.get(..4)?.parse().ok()?;
    let month = s.get(4..6)?.parse().ok()?;
    let day = s.get(6..)?.parse().ok()?;
    NaiveDate::from_ymd_opt(year, month, day)
}

fn number_date(n: u64) -> Option<NaiveDate> {
    if (19_900_101..=21_001_231).contains(&n) {
        return ymd_digits(&n.to_string());
    }
    let secs = i64::try_from(n).ok()?;
    DateTime::from_timestamp(secs, 0).map(|t| t.date_naive())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn display_names_lose_versions_and_architectures() {
        let cases = [
            ("7-Zip 25.01 (x64)", "7-Zip", Some("25.01")),
            ("7-Zip 25.01 (x64 edition)", "7-Zip", Some("25.01")),
            (
                "Everything 1.4.1.1028 (x64)",
                "Everything",
                Some("1.4.1.1028"),
            ),
            ("Krita (x64) 5.2.9", "Krita", Some("5.2.9")),
            ("Notepad++ (64-bit x64)", "Notepad++", None),
            ("LocalSend version 1.17.0", "LocalSend", Some("1.17.0")),
            (
                "Hiddify, версия 4.1.1+40101",
                "Hiddify",
                Some("4.1.1+40101"),
            ),
            ("LocalSend, версія 1.17.0", "LocalSend", Some("1.17.0")),
            ("Tool, v2.1", "Tool", Some("v2.1")),
            ("Bitwarden 2026.8.1", "Bitwarden", Some("2026.8.1")),
            ("PowerToys (Preview) x64", "PowerToys (Preview)", None),
            ("Python 3.12.1 (64-bit)", "Python", Some("3.12.1")),
            ("Foo - 1.2", "Foo", Some("1.2")),
            ("Foo (v2.0)", "Foo", Some("v2.0")),
            ("VLC media player", "VLC media player", None),
            (
                "Microsoft Visual Studio Code (User)",
                "Microsoft Visual Studio Code (User)",
                None,
            ),
            (
                "Mozilla Firefox (x64 en-US)",
                "Mozilla Firefox (x64 en-US)",
                None,
            ),
            ("  Слоўнік 2.4.0 ", "Слоўнік", Some("2.4.0")),
            ("7-Zip", "7-Zip", None),
            ("1Password", "1Password", None),
            ("Sweet Home 3D", "Sweet Home 3D", None),
            ("Mindustry 146", "Mindustry", Some("146")),
            ("x64", "x64", None),
            ("Steam", "Steam", None),
        ];
        for (name, base, version) in cases {
            let (b, v) = split_display_name(name);
            assert_eq!(b, base, "{name}");
            assert_eq!(v.as_deref(), version, "{name}");
        }
    }

    #[test]
    fn architecture_only_stripping_keeps_numbers() {
        assert_eq!(strip_architecture("Heroes 3 (x64)"), "Heroes 3");
        assert_eq!(strip_architecture("Heroes 3 x64"), "Heroes 3");
        assert_eq!(strip_architecture("7-Zip 25.01 (x64)"), "7-Zip 25.01");
    }

    #[test]
    fn versions_are_cleaned() {
        assert_eq!(
            clean_version("1.93.0 (user setup)").as_deref(),
            Some("1.93.0")
        );
        assert_eq!(clean_version(" 25.01 ").as_deref(), Some("25.01"));
        assert_eq!(
            clean_version("v2.0.0-beta.2").as_deref(),
            Some("v2.0.0-beta.2")
        );
        assert_eq!(clean_version("Build 1234").as_deref(), Some("1234"));
        assert_eq!(clean_version("(3.0.21)").as_deref(), Some("3.0.21"));
        assert_eq!(clean_version("2024a").as_deref(), Some("2024a"));
        assert_eq!(clean_version("latest"), None);
        assert_eq!(clean_version(""), None);
    }

    #[test]
    fn install_dates() {
        let s = |v: &str| RegData::String(v.into());
        assert_eq!(parse_install_date(&s("20240115")), Some(date("2024-01-15")));
        assert_eq!(
            parse_install_date(&s("2024-01-15")),
            Some(date("2024-01-15"))
        );
        assert_eq!(
            parse_install_date(&s("2024/1/15")),
            Some(date("2024-01-15"))
        );
        assert_eq!(
            parse_install_date(&s("1/15/2024")),
            Some(date("2024-01-15"))
        );
        assert_eq!(parse_install_date(&s("20241315")), None, "month 13");
        assert_eq!(
            parse_install_date(&s("15.01.2024")),
            None,
            "ambiguous order"
        );
        assert_eq!(parse_install_date(&s("18991231")), None, "implausible");
        assert_eq!(
            parse_install_date(&RegData::Dword(20_240_115)),
            Some(date("2024-01-15"))
        );
        assert_eq!(
            parse_install_date(&RegData::Dword(1_705_276_800)),
            Some(date("2024-01-15")),
            "Unix seconds"
        );
        assert_eq!(parse_install_date(&RegData::Binary(vec![1, 2])), None);
    }

    fn key(name: &str) -> RegKeyData {
        RegKeyData::new(name)
    }

    #[test]
    fn hidden_entries_are_skipped() {
        let root = RegRoot::LocalMachine;
        assert!(
            UninstallEntry::parse(root, &key("a")).is_none(),
            "no DisplayName"
        );
        assert!(UninstallEntry::parse(root, &key("a").with_str("DisplayName", " ")).is_none());
        let named = key("a").with_str("DisplayName", "Tool");
        assert!(UninstallEntry::parse(root, &named).is_some());
        let system = named.clone().with("SystemComponent", RegData::Dword(1));
        assert!(UninstallEntry::parse(root, &system).is_none());
        let system_str = named.clone().with_str("SystemComponent", "1");
        assert!(UninstallEntry::parse(root, &system_str).is_none());
        let visible = named.clone().with("SystemComponent", RegData::Dword(0));
        assert!(UninstallEntry::parse(root, &visible).is_some());
        let patch = named.clone().with_str("ParentKeyName", "OperatingSystem");
        assert!(UninstallEntry::parse(root, &patch).is_none());
        let update = named.clone().with_str("ReleaseType", "Security Update");
        assert!(UninstallEntry::parse(root, &update).is_none());
        let app = named.with_str("ReleaseType", "Application");
        assert!(UninstallEntry::parse(root, &app).is_some());
    }

    #[test]
    fn entry_fields_and_version_fallbacks() {
        let written = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000);
        let full = key("{EA457B21-F73E-494C-ACAB-524FDE069978}_is1")
            .with_str("DisplayName", "Microsoft Visual Studio Code")
            .with_str("DisplayVersion", "1.93.0 (system setup)")
            .with_str("Publisher", "Microsoft Corporation")
            .with_str(
                "InstallLocation",
                "\"C:\\Program Files\\Microsoft VS Code\\\"",
            )
            .with_str(
                "UninstallString",
                "\"C:\\Program Files\\Microsoft VS Code\\unins000.exe\"",
            )
            .with_str(
                "QuietUninstallString",
                "\"C:\\Program Files\\Microsoft VS Code\\unins000.exe\" /SILENT",
            )
            .with_str("InstallDate", "20240901")
            .written(written);
        let e = UninstallEntry::parse(RegRoot::LocalMachine, &full).unwrap();
        assert_eq!(e.key, "{EA457B21-F73E-494C-ACAB-524FDE069978}_is1");
        assert_eq!(e.version.as_deref(), Some("1.93.0"));
        assert_eq!(e.publisher.as_deref(), Some("Microsoft Corporation"));
        assert_eq!(
            e.install_location,
            Some(PathBuf::from("C:\\Program Files\\Microsoft VS Code\\"))
        );
        assert!(e.quiet_uninstall_string.unwrap().ends_with("/SILENT"));
        assert_eq!(e.install_date, Some(date("2024-09-01")));
        assert_eq!(e.last_write, Some(written));
        assert!(!e.windows_installer);

        let parts = key("p")
            .with_str("DisplayName", "Tool")
            .with("VersionMajor", RegData::Dword(4))
            .with("VersionMinor", RegData::Dword(120));
        let e = UninstallEntry::parse(RegRoot::CurrentUser, &parts).unwrap();
        assert_eq!(e.version.as_deref(), Some("4.120"));

        let packed = key("{GUID}")
            .with_str("DisplayName", "Tool")
            .with("Version", RegData::Dword((5 << 24) | (2 << 16) | 9));
        let e = UninstallEntry::parse(RegRoot::LocalMachine32, &packed).unwrap();
        assert_eq!(e.version.as_deref(), Some("5.2.9"));
        let msi = packed.with("WindowsInstaller", RegData::Dword(1));
        assert!(
            UninstallEntry::parse(RegRoot::LocalMachine, &msi)
                .unwrap()
                .windows_installer
        );

        let in_name = key("Stellarium_is1").with_str("DisplayName", "Stellarium 25.2");
        let e = UninstallEntry::parse(RegRoot::LocalMachine, &in_name).unwrap();
        assert_eq!(
            (e.base_name.as_str(), e.version.as_deref()),
            ("Stellarium", Some("25.2"))
        );

        let none = key("m").with_str("DisplayName", "Mindustry");
        assert_eq!(
            UninstallEntry::parse(RegRoot::CurrentUser, &none)
                .unwrap()
                .version,
            None
        );
    }

    #[test]
    fn install_dir_hints() {
        let folders = KnownFolders {
            windows: Some(PathBuf::from(r"C:\Windows")),
            ..KnownFolders::default()
        };
        let entry = |k: RegKeyData| {
            UninstallEntry::parse(RegRoot::LocalMachine, &k.with_str("DisplayName", "X")).unwrap()
        };
        let located = entry(key("a").with_str("InstallLocation", r"D:\Tools\X"));
        assert_eq!(
            located.install_dir(&folders),
            Some(PathBuf::from(r"D:\Tools\X"))
        );

        let icon = entry(key("b").with_str("DisplayIcon", r"C:\Program Files\7-Zip\7zFM.exe,0"));
        assert_eq!(
            icon.install_dir(&folders),
            Some(PathBuf::from(r"C:\Program Files\7-Zip"))
        );

        let quoted_icon = entry(key("c").with_str("DisplayIcon", "\"C:\\Apps\\X\\x.exe\",1"));
        assert_eq!(
            quoted_icon.install_dir(&folders),
            Some(PathBuf::from(r"C:\Apps\X"))
        );

        let uninstaller = entry(key("d").with_str(
            "UninstallString",
            r"C:\Program Files\Notepad++\uninstall.exe /S",
        ));
        assert_eq!(
            uninstaller.install_dir(&folders),
            Some(PathBuf::from(r"C:\Program Files\Notepad++"))
        );

        let msi = entry(
            key("{GUID}")
                .with_str("UninstallString", r"MsiExec.exe /X{GUID}")
                .with_str("DisplayIcon", r"C:\Windows\Installer\{GUID}\icon.ico"),
        );
        assert_eq!(msi.install_dir(&folders), None);

        let system = entry(key("e").with_str("UninstallString", r"C:\Windows\System32\x.exe"));
        assert_eq!(system.install_dir(&folders), None);

        let cache = entry(key("f").with_str(
            "UninstallString",
            "\"C:\\ProgramData\\Package Cache\\{GUID}\\setup.exe\" /uninstall",
        ));
        assert_eq!(cache.install_dir(&folders), None);
    }

    #[test]
    fn the_program_comes_from_the_display_icon() {
        let folders = KnownFolders {
            windows: Some(PathBuf::from(r"C:\Windows")),
            ..KnownFolders::default()
        };
        let entry = |icon: &str| {
            let k = key("a")
                .with_str("DisplayName", "X")
                .with_str("DisplayIcon", icon);
            UninstallEntry::parse(RegRoot::CurrentUser, &k).unwrap()
        };
        assert_eq!(
            entry(r"C:\Program Files\7-Zip\7zFM.exe,0").program(&folders),
            Some(PathBuf::from(r"C:\Program Files\7-Zip\7zFM.exe"))
        );
        assert_eq!(
            entry(r#""C:\Apps\X\X.EXE""#).program(&folders),
            Some(PathBuf::from(r"C:\Apps\X\X.EXE"))
        );
        // Not something to start: an icon file, an uninstaller, a system tool.
        assert_eq!(entry(r"C:\Apps\X\app.ico").program(&folders), None);
        assert_eq!(entry(r"C:\Apps\X\unins000.exe,0").program(&folders), None);
        assert_eq!(entry(r"C:\Apps\X\Uninstall X.exe").program(&folders), None);
        assert_eq!(
            entry(r"C:\Windows\System32\msiexec.exe").program(&folders),
            None
        );
        let none =
            UninstallEntry::parse(RegRoot::CurrentUser, &key("b").with_str("DisplayName", "Y"))
                .unwrap();
        assert_eq!(none.program(&folders), None);
    }
}
