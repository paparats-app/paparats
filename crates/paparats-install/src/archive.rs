//! Portable ZIP extraction with zip-slip protection. Every entry name is checked on its own
//! (never trusted, never "sanitised" into a different path): it must be a relative path of plain
//! Windows file-name components, or the whole archive is rejected before anything is written.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use zip::ZipArchive;
use zip::result::ZipError;

use crate::InstallError;

/// Caps against archive bombs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    /// Total bytes written for all entries.
    pub max_bytes: u64,
    pub max_entries: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_bytes: 16 * 1024 * 1024 * 1024,
            max_entries: 200_000,
        }
    }
}

const RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$", "CLOCK$", "COM0", "COM1", "COM2", "COM3",
    "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "COM¹", "COM²", "COM³", "LPT0", "LPT1", "LPT2",
    "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9", "LPT¹", "LPT²", "LPT³",
];

/// Whether `name` can be used as one file or folder name on Windows without surprises: no
/// separators, drive or stream colons, wildcards, control characters, trailing dots or spaces
/// (Windows strips them, so two names could alias), `.`/`..`, or device names (`NUL.txt`).
pub fn is_plain_component(name: &str) -> bool {
    if name.is_empty() || name == "." || name == ".." || name.len() > 255 {
        return false;
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return false;
    }
    if name.chars().any(|c| {
        c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
    }) {
        return false;
    }
    let stem = name.split('.').next().unwrap_or(name).trim_end();
    !RESERVED_NAMES.iter().any(|r| r.eq_ignore_ascii_case(stem))
}

/// Validates an app id or version before it becomes a folder name.
pub fn check_component(value: &str, what: &str) -> Result<(), InstallError> {
    if is_plain_component(value) {
        Ok(())
    } else {
        Err(InstallError::invalid(format!(
            "{what} is not a valid folder name"
        )))
    }
}

/// The relative path a ZIP entry name stands for, or [`InstallError::UnsafeArchivePath`]. Both
/// `/` and `\` separate components; empty and `.` components are dropped; anything absolute,
/// rooted, drive-qualified or climbing (`..`) is refused.
pub fn safe_relative_path(name: &str) -> Result<PathBuf, InstallError> {
    let unsafe_path = || InstallError::UnsafeArchivePath(name.chars().take(200).collect());
    if name.starts_with(['/', '\\']) {
        return Err(unsafe_path());
    }
    let mut path = PathBuf::new();
    for part in name.split(['/', '\\']) {
        if part.is_empty() || part == "." {
            continue;
        }
        if !is_plain_component(part) {
            return Err(unsafe_path());
        }
        path.push(part);
    }
    // Belt and braces: what we built must be purely relative, plain components.
    if path.as_os_str().is_empty() || !path.components().all(|c| matches!(c, Component::Normal(_)))
    {
        return Err(unsafe_path());
    }
    Ok(path)
}

fn zip_error(e: ZipError) -> InstallError {
    match e {
        ZipError::Io(e) => InstallError::Io(e),
        other => InstallError::invalid(format!("unreadable ZIP archive: {other}")),
    }
}

/// What an extraction wrote.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Extracted {
    pub files: usize,
    pub bytes: u64,
}

/// Extracts `archive` into the empty folder `dest`. All names are validated before the first
/// byte is written; `cancel` is checked between entries. On error `dest` may hold a partial
/// extraction — the caller removes it.
pub fn extract(
    archive: &File,
    dest: &Path,
    limits: Limits,
    cancel: &AtomicBool,
) -> Result<Extracted, InstallError> {
    let mut zip = ZipArchive::new(archive).map_err(zip_error)?;
    if zip.len() > limits.max_entries {
        return Err(InstallError::invalid("the archive has too many entries"));
    }

    // Pass 1: every entry must be a safe, plain file or folder.
    let mut plan: Vec<(usize, PathBuf, bool)> = Vec::with_capacity(zip.len());
    let mut declared: u64 = 0;
    for i in 0..zip.len() {
        let entry = zip.by_index_raw(i).map_err(zip_error)?;
        let path = safe_relative_path(entry.name())?;
        if entry.is_symlink() {
            return Err(InstallError::UnsafeArchivePath(
                entry.name().chars().take(200).collect(),
            ));
        }
        if entry.encrypted() {
            return Err(InstallError::invalid("the archive is encrypted"));
        }
        declared = declared.saturating_add(entry.size());
        plan.push((i, path, entry.is_dir()));
    }
    if declared > limits.max_bytes {
        return Err(InstallError::invalid("the archive is too large to unpack"));
    }

    // Pass 2: write. Files are created new (a duplicate name is an error, never an overwrite).
    let mut written = Extracted { files: 0, bytes: 0 };
    for (i, rel, is_dir) in plan {
        if cancel.load(Ordering::Relaxed) {
            return Err(InstallError::Cancelled);
        }
        let target = dest.join(&rel);
        if is_dir {
            fs::create_dir_all(&target)?;
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut entry = zip.by_index(i).map_err(zip_error)?;
        let mut out = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map_err(|e| match e.kind() {
                io::ErrorKind::AlreadyExists => {
                    InstallError::invalid("the archive lists the same file twice")
                }
                _ => InstallError::Io(e),
            })?;
        let budget = limits.max_bytes.saturating_sub(written.bytes);
        let copied = io::copy(&mut (&mut entry).take(budget.saturating_add(1)), &mut out)?;
        if copied > budget {
            return Err(InstallError::invalid("the archive is too large to unpack"));
        }
        written.bytes += copied;
        written.files += 1;
    }
    Ok(written)
}

/// Picks the program a Start-menu shortcut should open: among the `.exe` files at the top of
/// `dir` (or inside its only sub-folder, a common ZIP layout), the one named after the app,
/// else the only one that is not an uninstaller/updater/helper, else the largest.
pub fn find_main_exe(dir: &Path, app_id: &str) -> io::Result<Option<PathBuf>> {
    let mut exes = exes_in(dir)?;
    if exes.is_empty() {
        let subdirs: Vec<PathBuf> = fs::read_dir(dir)?
            .filter_map(Result::ok)
            .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
            .map(|e| e.path())
            .collect();
        if let [only] = subdirs.as_slice() {
            exes = exes_in(only)?;
        }
    }
    let key = |s: &str| -> String {
        s.chars()
            .filter(|c| c.is_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect()
    };
    let app = key(app_id);
    if let Some((path, _)) = exes
        .iter()
        .find(|(p, _)| stem(p).is_some_and(|s| key(s) == app))
    {
        return Ok(Some(path.clone()));
    }
    let helper = |p: &Path| {
        stem(p).is_some_and(|s| {
            let s = s.to_ascii_lowercase();
            [
                "unins",
                "uninstall",
                "setup",
                "update",
                "crashpad",
                "crashreport",
                "helper",
            ]
            .iter()
            .any(|h| s.starts_with(h))
        })
    };
    let main: Vec<&(PathBuf, u64)> = exes.iter().filter(|(p, _)| !helper(p)).collect();
    if let [only] = main.as_slice() {
        return Ok(Some(only.0.clone()));
    }
    let pool: Vec<&(PathBuf, u64)> = if main.is_empty() {
        exes.iter().collect()
    } else {
        main
    };
    Ok(pool
        .into_iter()
        .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(&a.0)))
        .map(|(p, _)| p.clone()))
}

fn stem(path: &Path) -> Option<&str> {
    path.file_stem().and_then(|s| s.to_str())
}

fn exes_in(dir: &Path) -> io::Result<Vec<(PathBuf, u64)>> {
    let mut exes = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let is_exe = path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("exe"));
        let meta = entry.metadata()?;
        if is_exe && meta.is_file() {
            exes.push((path, meta.len()));
        }
    }
    exes.sort();
    Ok(exes)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    /// Writes a ZIP with `entries` (name, contents; a name ending in `/` is a folder).
    pub(crate) fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let mut zip = zip::ZipWriter::new(File::create(path).unwrap());
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for (name, data) in entries {
            if name.ends_with('/') {
                zip.add_directory(*name, options).unwrap();
            } else {
                zip.start_file(*name, options).unwrap();
                zip.write_all(data).unwrap();
            }
        }
        zip.finish().unwrap();
    }

    fn unpack(entries: &[(&str, &[u8])]) -> (tempfile::TempDir, Result<Extracted, InstallError>) {
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("pkg.zip");
        write_zip(&zip_path, entries);
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        let file = File::open(&zip_path).unwrap();
        let result = extract(&file, &dest, Limits::default(), &AtomicBool::new(false));
        (dir, result)
    }

    #[test]
    fn plain_components() {
        for ok in [
            "app.exe",
            "Data",
            "a b",
            "résumé.txt",
            ".config",
            "console.log",
            "COM10",
        ] {
            assert!(is_plain_component(ok), "{ok}");
        }
        for bad in [
            "",
            ".",
            "..",
            "a:b",
            "C:",
            "a/b",
            r"a\b",
            "a*",
            "a?",
            "a|b",
            "trail.",
            "trail ",
            "CON",
            "con.txt",
            "con.d",
            "NUL",
            "nul.tar.gz",
            "Com1.log",
            "LPT9",
            "AUX ",
            "a\u{1}",
        ] {
            assert!(!is_plain_component(bad), "{bad:?}");
        }
    }

    #[test]
    fn zip_slip_names_are_rejected() {
        for bad in [
            "../evil.txt",
            r"..\evil.txt",
            "a/../../evil.txt",
            "a/../b.txt",
            "/abs.txt",
            r"\abs.txt",
            r"\\server\share\x.txt",
            r"C:\Windows\evil.dll",
            "C:evil.dll",
            "c:/evil.dll",
            "file.txt:stream",
            "dir/NUL",
            "dir/con.txt",
            "trailing./x",
            "",
            "./",
        ] {
            assert!(
                matches!(
                    safe_relative_path(bad),
                    Err(InstallError::UnsafeArchivePath(_))
                ),
                "{bad:?} must be rejected"
            );
        }
        assert_eq!(
            safe_relative_path("App/bin//./app.exe").unwrap(),
            Path::new("App").join("bin").join("app.exe")
        );
        assert_eq!(
            safe_relative_path(r"App\data\x.dat").unwrap(),
            Path::new("App").join("data").join("x.dat")
        );
    }

    #[test]
    fn extracts_files_and_folders() {
        let (dir, result) = unpack(&[
            ("App/", b""),
            ("App/app.exe", b"MZ main"),
            ("App/data/readme.txt", b"hello"),
        ]);
        assert_eq!(
            result.unwrap(),
            Extracted {
                files: 2,
                bytes: 12
            }
        );
        let out = dir.path().join("out");
        assert_eq!(fs::read(out.join("App/app.exe")).unwrap(), b"MZ main");
        assert_eq!(fs::read(out.join("App/data/readme.txt")).unwrap(), b"hello");
    }

    #[test]
    fn a_slipping_archive_writes_nothing() {
        let (dir, result) = unpack(&[("ok.txt", b"fine"), ("../escaped.txt", b"pwned")]);
        assert!(matches!(result, Err(InstallError::UnsafeArchivePath(_))));
        assert!(!dir.path().join("escaped.txt").exists());
        assert!(
            !dir.path().join("out/ok.txt").exists(),
            "validated before writing"
        );
    }

    #[test]
    fn symlinks_duplicates_and_bombs_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("link.zip");
        let mut zip = zip::ZipWriter::new(File::create(&zip_path).unwrap());
        zip.add_symlink("link", "../../etc", SimpleFileOptions::default())
            .unwrap();
        zip.finish().unwrap();
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        let file = File::open(&zip_path).unwrap();
        assert!(matches!(
            extract(&file, &dest, Limits::default(), &AtomicBool::new(false)),
            Err(InstallError::UnsafeArchivePath(_))
        ));

        // Names that differ only in case are the same file on Windows: never an overwrite.
        #[cfg(windows)]
        {
            let (_dir, result) = unpack(&[("a.txt", b"1"), ("A.TXT", b"2")]);
            assert!(matches!(result, Err(InstallError::InvalidPackage(_))));
        }

        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("big.zip");
        write_zip(&zip_path, &[("big.bin", &[0u8; 4096])]);
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        let tight = Limits {
            max_bytes: 1024,
            max_entries: 10,
        };
        let file = File::open(&zip_path).unwrap();
        assert!(matches!(
            extract(&file, &dest, tight, &AtomicBool::new(false)),
            Err(InstallError::InvalidPackage(_))
        ));
        let file = File::open(&zip_path).unwrap();
        assert!(matches!(
            extract(&file, &dest, Limits::default(), &AtomicBool::new(true)),
            Err(InstallError::Cancelled)
        ));
    }

    #[test]
    fn not_a_zip_is_an_invalid_package() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.zip");
        fs::write(&path, b"MZ definitely not a zip").unwrap();
        let file = File::open(&path).unwrap();
        assert!(matches!(
            extract(
                &file,
                dir.path(),
                Limits::default(),
                &AtomicBool::new(false)
            ),
            Err(InstallError::InvalidPackage(_))
        ));
    }

    #[test]
    fn picks_the_main_program() {
        let dir = tempfile::tempdir().unwrap();
        let d = dir.path();
        let touch = |name: &str, size: usize| fs::write(d.join(name), vec![0u8; size]).unwrap();
        assert_eq!(find_main_exe(d, "vlc").unwrap(), None);

        touch("unins000.exe", 900);
        touch("Tool.exe", 100);
        assert_eq!(find_main_exe(d, "other").unwrap(), Some(d.join("Tool.exe")));

        touch("Helper.exe", 50);
        touch("Big.exe", 500);
        assert_eq!(find_main_exe(d, "other").unwrap(), Some(d.join("Big.exe")));

        touch("Share-X.exe", 10);
        assert_eq!(
            find_main_exe(d, "sharex").unwrap(),
            Some(d.join("Share-X.exe"))
        );

        let nested = tempfile::tempdir().unwrap();
        fs::create_dir(nested.path().join("App-1.0")).unwrap();
        fs::write(nested.path().join("App-1.0").join("app.exe"), b"MZ").unwrap();
        fs::write(nested.path().join("README.txt"), b"hi").unwrap();
        assert_eq!(
            find_main_exe(nested.path(), "app").unwrap(),
            Some(nested.path().join("App-1.0").join("app.exe"))
        );
    }
}
