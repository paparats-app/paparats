//! Portable apps: a verified ZIP archive (extracted) or a single verified `.exe` (copied) →
//! `<apps>\<app-id>\<version>\` (staged, then renamed into place, so a failed or cancelled
//! install leaves nothing) → a Start-menu shortcut to the main program. Uninstall removes both.
//! Blocking; run on the blocking pool.

use std::fs::{self, File};
use std::io::{self, Seek};
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::archive::{self, check_component};
use crate::receipt::remove_file_if_exists;
use crate::{InstallError, InstallerConfig, sys, verify};

/// Where a portable install landed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortableInstall {
    pub dir: PathBuf,
    pub shortcut: Option<PathBuf>,
}

fn remove_dir_if_exists(dir: &Path) -> Result<(), InstallError> {
    match fs::remove_dir_all(dir) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

fn staging_dir(app_dir: &Path, version: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    app_dir.join(format!(".{version}.partial-{}-{nanos}", std::process::id()))
}

/// Verifies `package` against `sha256`, extracts it and creates the shortcut. `launch` names the
/// main program inside the archive (a relative path); without it the program is found by name.
pub fn install(
    config: &InstallerConfig,
    app_id: &str,
    version: &str,
    package: &Path,
    sha256: Option<&str>,
    launch: Option<&str>,
    cancel: &AtomicBool,
) -> Result<PortableInstall, InstallError> {
    check_component(app_id, "app id")?;
    check_component(version, "version")?;
    let file = verify::open_verified(package, sha256)?;

    let app_dir = config.apps_dir.join(app_id);
    fs::create_dir_all(&app_dir)?;
    let staging = staging_dir(&app_dir, version);
    fs::create_dir(&staging)?;
    let extracted = archive::extract(&file, &staging, config.archive_limits, cancel);
    drop(file);
    if let Err(e) = extracted {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }

    let dest = app_dir.join(version);
    let placed = remove_dir_if_exists(&dest).and_then(|()| Ok(fs::rename(&staging, &dest)?));
    if let Err(e) = placed {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }

    let named = launch
        .map(|rel| launch_path(&dest, rel))
        .transpose()?
        .filter(|exe| exe.is_file());
    let main = match named {
        Some(exe) => Some(exe),
        None => archive::find_main_exe(&dest, app_id)?,
    };
    let shortcut = match main {
        Some(exe) => {
            let link = shortcut_path(config, &exe)?;
            let dir = exe.parent().unwrap_or(&dest);
            let created = fs::create_dir_all(&config.shortcuts_dir)
                .map_err(InstallError::from)
                .and_then(|()| sys::create_shortcut(&link, &exe, dir));
            if let Err(e) = created {
                let _ = fs::remove_dir_all(&dest);
                return Err(e);
            }
            Some(link)
        }
        None => {
            tracing::warn!(app = %app_id, "portable app has no program to link from the Start menu");
            None
        }
    };
    Ok(PortableInstall {
        dir: dest,
        shortcut,
    })
}

/// `dest` joined with a manifest's relative `launch` path, refusing anything that could leave
/// `dest` (absolute paths, `..`, drive or stream syntax).
fn launch_path(dest: &Path, rel: &str) -> Result<PathBuf, InstallError> {
    let mut path = dest.to_path_buf();
    for part in rel.split(['/', '\\']).filter(|p| !p.is_empty()) {
        if !archive::is_plain_component(part) {
            return Err(InstallError::invalid(
                "the package's program path is not a plain path",
            ));
        }
        path.push(part);
    }
    if path == dest {
        return Err(InstallError::invalid("the package names no program"));
    }
    Ok(path)
}

/// Copies a verified single-file program (`file`, still locked, hashed and signature-checked by
/// the caller) to `<apps>\<app-id>\<version>\<name>` and links it from the Start menu. `name` is
/// the manifest's `launch` file name, or `<app-id>.exe`.
pub fn install_exe(
    config: &InstallerConfig,
    app_id: &str,
    version: &str,
    file: &mut File,
    launch: Option<&str>,
) -> Result<PortableInstall, InstallError> {
    check_component(app_id, "app id")?;
    check_component(version, "version")?;
    let name = match launch {
        Some(name) => name.to_owned(),
        None => format!("{app_id}.exe"),
    };
    let is_exe = Path::new(&name)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("exe"));
    if !archive::is_plain_component(&name) || !is_exe {
        return Err(InstallError::invalid(
            "a portable program must be a plain .exe file name",
        ));
    }

    let app_dir = config.apps_dir.join(app_id);
    fs::create_dir_all(&app_dir)?;
    let staging = staging_dir(&app_dir, version);
    fs::create_dir(&staging)?;
    let copied = file
        .rewind()
        .and_then(|()| {
            let mut out = File::create(staging.join(&name))?;
            io::copy(file, &mut out)?;
            out.sync_all()
        })
        .map_err(InstallError::from);
    if let Err(e) = copied {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }

    let dest = app_dir.join(version);
    let placed = remove_dir_if_exists(&dest).and_then(|()| Ok(fs::rename(&staging, &dest)?));
    if let Err(e) = placed {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }
    let exe = dest.join(&name);
    let link = shortcut_path(config, &exe)?;
    let created = fs::create_dir_all(&config.shortcuts_dir)
        .map_err(InstallError::from)
        .and_then(|()| sys::create_shortcut(&link, &exe, &dest));
    if let Err(e) = created {
        let _ = fs::remove_dir_all(&dest);
        return Err(e);
    }
    Ok(PortableInstall {
        dir: dest,
        shortcut: Some(link),
    })
}

/// `<shortcuts>\<program name>.lnk` (the program's file name without `.exe`, as the Start menu
/// shows it).
fn shortcut_path(config: &InstallerConfig, exe: &Path) -> Result<PathBuf, InstallError> {
    let name = exe
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| archive::is_plain_component(s))
        .ok_or_else(|| InstallError::invalid("the program name cannot name a shortcut"))?;
    Ok(config.shortcuts_dir.join(format!("{name}.lnk")))
}

/// Removes a portable install: the shortcut, the version folder and — when empty — the app's
/// folder and the Start-menu folder. Refuses paths outside the configured folders.
pub fn remove(
    config: &InstallerConfig,
    app_id: &str,
    dir: &Path,
    shortcut: Option<&Path>,
) -> Result<(), InstallError> {
    check_component(app_id, "app id")?;
    let app_dir = config.apps_dir.join(app_id);
    if !dir.starts_with(&app_dir) || dir == app_dir {
        return Err(InstallError::invalid(
            "the install receipt points outside the apps folder",
        ));
    }
    if let Some(link) = shortcut {
        if !link.starts_with(&config.shortcuts_dir) {
            return Err(InstallError::invalid(
                "the install receipt points outside the Start-menu folder",
            ));
        }
        remove_file_if_exists(link)?;
    }
    remove_dir_if_exists(dir)?;
    // Only succeed when empty; anything else stays.
    let _ = fs::remove_dir(&app_dir);
    let _ = fs::remove_dir(&config.shortcuts_dir);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive::tests::write_zip;
    use crate::verify::{hex, sha256_hex};
    use std::sync::atomic::AtomicBool;

    fn package(dir: &Path, entries: &[(&str, &[u8])]) -> (PathBuf, String) {
        let path = dir.join("pkg.zip");
        write_zip(&path, entries);
        let sha = sha256_hex(&mut fs::File::open(&path).unwrap()).unwrap();
        (path, sha)
    }

    #[test]
    fn staging_names_are_hidden_and_distinct() {
        let a = staging_dir(Path::new("apps"), "1.0");
        assert!(
            a.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with(".1.0.partial-")
        );
        assert_eq!(hex(&[1, 2]), "0102");
    }

    #[cfg(windows)]
    #[test]
    fn installs_and_removes_a_portable_app() {
        let root = tempfile::tempdir().unwrap();
        let config = InstallerConfig::in_dir(root.path());
        let (zip, sha) = package(
            root.path(),
            &[
                ("Tool-1.0/", b""),
                ("Tool-1.0/Tool.exe", b"MZ tool"),
                (
                    "Tool-1.0/unins000.exe",
                    b"MZ uninstaller, larger than the tool",
                ),
                ("Tool-1.0/data/cfg.ini", b"[x]"),
            ],
        );
        let installed = install(
            &config,
            "tool",
            "1.0",
            &zip,
            Some(&sha),
            None,
            &AtomicBool::new(false),
        )
        .unwrap();
        let dir = config.apps_dir.join("tool").join("1.0");
        assert_eq!(installed.dir, dir);
        assert_eq!(fs::read(dir.join("Tool-1.0/Tool.exe")).unwrap(), b"MZ tool");
        let link = installed.shortcut.clone().unwrap();
        assert_eq!(link, config.shortcuts_dir.join("Tool.lnk"));
        let bytes = fs::read(&link).unwrap();
        // A shell link: header size 0x4C and CLSID_ShellLink.
        assert_eq!(&bytes[..4], &[0x4C, 0, 0, 0]);
        // No staging leftovers.
        let names: Vec<_> = fs::read_dir(config.apps_dir.join("tool"))
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names, ["1.0"]);

        remove(
            &config,
            "tool",
            &installed.dir,
            installed.shortcut.as_deref(),
        )
        .unwrap();
        assert!(!link.exists());
        assert!(!config.apps_dir.join("tool").exists());
        assert!(!config.shortcuts_dir.exists());
        // Removing again is fine.
        remove(
            &config,
            "tool",
            &installed.dir,
            installed.shortcut.as_deref(),
        )
        .unwrap();
    }

    #[test]
    fn a_bad_archive_leaves_nothing_behind() {
        let root = tempfile::tempdir().unwrap();
        let config = InstallerConfig::in_dir(root.path());
        let (zip, sha) = package(root.path(), &[("ok.txt", b"1"), ("../../evil.txt", b"2")]);
        let err = install(
            &config,
            "tool",
            "1.0",
            &zip,
            Some(&sha),
            None,
            &AtomicBool::new(false),
        )
        .unwrap_err();
        assert!(matches!(err, InstallError::UnsafeArchivePath(_)));
        assert_eq!(
            fs::read_dir(config.apps_dir.join("tool")).unwrap().count(),
            0
        );
        assert!(!root.path().join("evil.txt").exists());

        let err = install(
            &config,
            "tool",
            "1.0",
            &zip,
            Some(&"0".repeat(64)),
            None,
            &AtomicBool::new(false),
        )
        .unwrap_err();
        assert!(matches!(err, InstallError::HashMismatch));

        let (zip, sha) = package(root.path(), &[("a.txt", b"1")]);
        let err = install(
            &config,
            "tool",
            "1.0",
            &zip,
            Some(&sha),
            None,
            &AtomicBool::new(true),
        )
        .unwrap_err();
        assert!(matches!(err, InstallError::Cancelled));
        assert_eq!(
            fs::read_dir(config.apps_dir.join("tool")).unwrap().count(),
            0
        );

        for (id, version) in [("../x", "1"), ("x", ".."), ("con", "1"), ("x", "a/b")] {
            assert!(matches!(
                install(
                    &config,
                    id,
                    version,
                    &zip,
                    Some(&sha),
                    None,
                    &AtomicBool::new(false)
                ),
                Err(InstallError::InvalidPackage(_))
            ));
        }
    }

    #[test]
    fn remove_refuses_foreign_paths() {
        let root = tempfile::tempdir().unwrap();
        let config = InstallerConfig::in_dir(root.path());
        let outside = root.path().join("elsewhere");
        fs::create_dir_all(&outside).unwrap();
        assert!(remove(&config, "tool", &outside, None).is_err());
        assert!(remove(&config, "tool", &config.apps_dir.join("tool"), None).is_err());
        assert!(
            remove(
                &config,
                "tool",
                &config.apps_dir.join("tool/1.0"),
                Some(&root.path().join("x.lnk"))
            )
            .is_err()
        );
        assert!(outside.exists());
    }
}
