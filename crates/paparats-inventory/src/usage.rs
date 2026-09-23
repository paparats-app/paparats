//! When programs last ran, as Explorer records it for the current user (UserAssist:
//! `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist\{GUID}\Count`). Value
//! names are ROT13-encoded program paths (`{KNOWNFOLDERID}\App\app.exe`, `C:\…\app.exe`),
//! shortcuts (`…\Everything.lnk`) or packaged-app ids (`Family_hash!App`); Windows 7+ data is 72
//! bytes with the last run as a FILETIME at offset 60. Read locally for the library's "last used"
//! and never logged.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::source::{
    KnownFolders, RegData, RegRoot, RegistryReader, SourceError, filetime_to_system, path_within,
};

pub const USER_ASSIST_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist";

/// Offset of the last-run FILETIME in a Windows 7+ UserAssist record.
const LAST_RUN_OFFSET: usize = 60;

/// Last-run times by program path, shortcut name and MSIX package family.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct UsageIndex {
    programs: Vec<(PathBuf, SystemTime)>,
    /// Lower-case shortcut file names without `.lnk` (`everything`, `vlc media player`).
    shortcuts: HashMap<String, SystemTime>,
    families: HashMap<String, SystemTime>,
}

fn keep_newest(map: &mut HashMap<String, SystemTime>, key: String, t: SystemTime) {
    let slot = map.entry(key).or_insert(t);
    *slot = (*slot).max(t);
}

impl UsageIndex {
    /// Reads every UserAssist `Count` key of the current user.
    pub fn read(
        registry: &dyn RegistryReader,
        folders: &KnownFolders,
    ) -> Result<Self, SourceError> {
        let mut index = Self::default();
        for guid in registry.subkeys(RegRoot::CurrentUser, USER_ASSIST_PATH)? {
            let path = format!("{USER_ASSIST_PATH}\\{}", guid.name);
            for key in registry.subkeys(RegRoot::CurrentUser, &path)? {
                if key.name.eq_ignore_ascii_case("Count") {
                    for (name, data) in &key.values {
                        index.add(name, data, folders);
                    }
                }
            }
        }
        Ok(index)
    }

    /// Adds one UserAssist value.
    pub fn add(&mut self, encoded_name: &str, data: &RegData, folders: &KnownFolders) {
        let RegData::Binary(bytes) = data else {
            return;
        };
        let Some(ran) = last_run(bytes) else {
            return;
        };
        match Program::parse(&rot13(encoded_name), folders) {
            Some(Program::Path(path)) => self.programs.push((path, ran)),
            Some(Program::Shortcut(name)) => keep_newest(&mut self.shortcuts, name, ran),
            Some(Program::Family(family)) => keep_newest(&mut self.families, family, ran),
            None => {}
        }
    }

    /// The last run of any program inside `dir`.
    pub fn last_run_under(&self, dir: &Path) -> Option<SystemTime> {
        self.programs
            .iter()
            .filter(|(path, _)| path_within(path, dir))
            .map(|(_, t)| *t)
            .max()
    }

    /// The last launch through a shortcut named like one of `names` (`Everything.lnk` for
    /// "Everything"), case-insensitive.
    pub fn last_run_of_shortcut<'a>(
        &self,
        names: impl IntoIterator<Item = &'a str>,
    ) -> Option<SystemTime> {
        names
            .into_iter()
            .filter_map(|n| self.shortcuts.get(&n.trim().to_lowercase()).copied())
            .max()
    }

    /// The last run of an app of the MSIX package family `family`.
    pub fn last_run_of_family(&self, family: &str) -> Option<SystemTime> {
        self.families.get(&family.to_lowercase()).copied()
    }

    pub fn is_empty(&self) -> bool {
        self.programs.is_empty() && self.shortcuts.is_empty() && self.families.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Program {
    Path(PathBuf),
    /// Lower-case shortcut name without `.lnk` (the shortcut's folder does not matter).
    Shortcut(String),
    /// Lower-case package family name.
    Family(String),
}

impl Program {
    fn parse(name: &str, folders: &KnownFolders) -> Option<Self> {
        let name = name.trim();
        let file = name.rsplit(['\\', '/']).next().unwrap_or(name);
        if let Some(stem) = file
            .len()
            .checked_sub(4)
            .filter(|&i| file.is_char_boundary(i) && file[i..].eq_ignore_ascii_case(".lnk"))
            .map(|i| &file[..i])
        {
            return (!stem.is_empty()).then(|| Program::Shortcut(stem.to_lowercase()));
        }
        if let Some(rest) = name.strip_prefix('{') {
            let (guid, tail) = rest.split_once('}')?;
            let base = folders.by_guid(guid)?;
            let tail = tail.trim_start_matches('\\');
            return Some(Program::Path(base.join(tail)));
        }
        let b = name.as_bytes();
        if b.len() > 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && b[2] == b'\\' {
            return Some(Program::Path(PathBuf::from(name)));
        }
        // Packaged app: `Family_publisherhash!AppId` (no path separators).
        let (family, app) = name.split_once('!')?;
        (family.contains('_') && !family.contains('\\') && !app.is_empty())
            .then(|| Program::Family(family.to_lowercase()))
    }
}

/// ROT13 on ASCII letters (UserAssist's "encryption").
pub fn rot13(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'a'..='z' => char::from((c as u8 - b'a' + 13) % 26 + b'a'),
            'A'..='Z' => char::from((c as u8 - b'A' + 13) % 26 + b'A'),
            _ => c,
        })
        .collect()
}

/// The last-run FILETIME of a Windows 7+ record (`None` when never run or in the old format).
fn last_run(data: &[u8]) -> Option<SystemTime> {
    let bytes: [u8; 8] = data
        .get(LAST_RUN_OFFSET..LAST_RUN_OFFSET + 8)?
        .try_into()
        .ok()?;
    filetime_to_system(u64::from_le_bytes(bytes))
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, UNIX_EPOCH};

    use super::*;
    use crate::source::{MemoryRegistry, RegKeyData};

    const TICKS_1970: u64 = 116_444_736_000_000_000;

    /// A 72-byte record that last ran `secs` after the Unix epoch.
    fn record(secs: u64) -> RegData {
        let mut data = vec![0_u8; 72];
        data[4..8].copy_from_slice(&3_u32.to_le_bytes());
        let ticks = TICKS_1970 + secs * 10_000_000;
        data[60..68].copy_from_slice(&ticks.to_le_bytes());
        RegData::Binary(data)
    }

    fn at(secs: u64) -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(secs)
    }

    fn folders() -> KnownFolders {
        KnownFolders {
            program_files: Some(PathBuf::from(r"C:\Program Files")),
            local_app_data: Some(PathBuf::from(r"C:\Users\u\AppData\Local")),
            ..KnownFolders::default()
        }
    }

    #[test]
    fn rot13_round_trips() {
        assert_eq!(rot13("Bofvqvna.rkr"), "Obsidian.exe");
        assert_eq!(rot13(&rot13("C:\\Tools\\x-1.exe")), "C:\\Tools\\x-1.exe");
        assert_eq!(rot13("{6Q809377}"), "{6D809377}");
    }

    #[test]
    fn records_parse_paths_known_folders_and_packages() {
        let f = folders();
        let mut index = UsageIndex::default();
        let enc = |s: &str| rot13(s);
        index.add(
            &enc(r"{6D809377-6AF0-444B-8957-A3773F02200E}\7-Zip\7zFM.exe"),
            &record(1_000),
            &f,
        );
        index.add(
            &enc(r"C:\Users\u\AppData\Local\Programs\Obsidian\Obsidian.exe"),
            &record(2_000),
            &f,
        );
        index.add(
            &enc(r"C:\Users\u\AppData\Local\Programs\Obsidian\resources\helper.exe"),
            &record(3_000),
            &f,
        );
        index.add(
            &enc("8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy!bitwardendesktop"),
            &record(4_000),
            &f,
        );
        index.add(
            &enc(r"C:\Users\Public\Desktop\Everything.lnk"),
            &record(6_000),
            &f,
        );
        // Shortcuts count by name, whatever folder they are in (Start menu, taskbar).
        index.add(
            &enc(r"{A77F5D77-2E2B-44C3-A6A2-ABA601054A51}\Paparats\Everything.LNK"),
            &record(7_000),
            &f,
        );
        index.add(&enc(r"C:\x\.lnk"), &record(8_000), &f);
        index.add(
            &enc("8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy!other"),
            &record(3_500),
            &f,
        );
        // Ignored: session counters, unknown folders, never-run and old-format records.
        index.add(&enc("UEME_CTLSESSION"), &record(9_000), &f);
        index.add(
            &enc(r"{00000000-0000-0000-0000-000000000000}\x.exe"),
            &record(9_000),
            &f,
        );
        index.add(&enc(r"C:\Never\run.exe"), &RegData::Binary(vec![0; 72]), &f);
        index.add(
            &enc(r"C:\Old\format.exe"),
            &RegData::Binary(vec![1; 16]),
            &f,
        );
        index.add(&enc(r"C:\Wrong\type.exe"), &RegData::Dword(1), &f);

        assert_eq!(
            index.last_run_under(Path::new(r"C:\Program Files\7-Zip")),
            Some(at(1_000))
        );
        assert_eq!(
            index.last_run_under(Path::new(r"c:\users\u\appdata\local\programs\obsidian\")),
            Some(at(3_000))
        );
        assert_eq!(
            index.last_run_under(Path::new(r"C:\Program Files\7-Zip2")),
            None
        );
        assert_eq!(
            index.last_run_of_family("8bitSolutionsLLC.BitwardenDesktop_h4e712dmw3xyy"),
            Some(at(4_000))
        );
        assert_eq!(index.last_run_under(Path::new(r"C:\Never")), None);
        assert_eq!(index.last_run_under(Path::new(r"C:\Old")), None);
        assert_eq!(index.last_run_under(Path::new(r"C:\Wrong")), None);
        assert_eq!(index.programs.len(), 3);
        assert_eq!(
            index.last_run_of_shortcut(["Tool", "EVERYTHING"]),
            Some(at(7_000))
        );
        assert_eq!(index.shortcuts.len(), 1, "an unnamed shortcut is skipped");
        assert_eq!(index.last_run_of_shortcut(["Everything Toolbar"]), None);
    }

    #[test]
    fn reads_count_keys_from_the_registry() {
        let guid = "{CEBFF5CD-ACE2-4F4F-9178-9926F41749EA}";
        let reg = MemoryRegistry::new()
            .with(
                RegRoot::CurrentUser,
                USER_ASSIST_PATH,
                RegKeyData::new(guid),
            )
            .with(
                RegRoot::CurrentUser,
                &format!("{USER_ASSIST_PATH}\\{guid}"),
                RegKeyData::new("Count").with(rot13(r"D:\Apps\Tool\tool.exe"), record(5_000)),
            );
        let index = UsageIndex::read(&reg, &folders()).unwrap();
        assert_eq!(
            index.last_run_under(Path::new(r"D:\Apps\Tool")),
            Some(at(5_000))
        );
        assert!(
            UsageIndex::read(&MemoryRegistry::new(), &folders())
                .unwrap()
                .is_empty()
        );
    }
}
