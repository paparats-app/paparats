//! Where "Open" looks when an app's Uninstall entry names no program (MSI products whose
//! `DisplayIcon` is an `.ico`, Squirrel and Burn installs, portable apps with several programs):
//! the Start-menu shortcut named like the app, as a person would look for it, then a program
//! named like the app in its install folder.

use std::path::{Path, PathBuf};

use crate::source::KnownFolders;

/// How deep the Start menu and an install folder are searched.
const DEPTH: usize = 3;

/// Letters and digits only, lower-case: "Flow Launcher" and `Flow.Launcher.exe` meet as
/// `flowlauncher`.
fn normalize(text: &str) -> String {
    text.chars()
        .filter(char::is_ascii_alphanumeric)
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn files(dir: &Path, extension: &str, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            if depth > 0 {
                files(&path, extension, depth - 1, out);
            }
        } else if path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case(extension))
        {
            out.push(path);
        }
    }
}

fn stem(path: &Path) -> String {
    normalize(
        &path
            .file_stem()
            .map(|s| s.to_string_lossy())
            .unwrap_or_default(),
    )
}

/// The Start-menu folders: the user's, then everyone's.
fn start_menus(folders: &KnownFolders) -> Vec<PathBuf> {
    let programs = |root: &Path| root.join(r"Microsoft\Windows\Start Menu\Programs");
    [&folders.roaming_app_data, &folders.program_data]
        .into_iter()
        .flatten()
        .map(|root| programs(root))
        .collect()
}

/// A shortcut named like the app: exactly (`Anki.lnk`), else starting with its name
/// (`PowerToys (Preview).lnk`). Uninstaller shortcuts never count.
pub fn start_menu_shortcut(names: &[&str], folders: &KnownFolders) -> Option<PathBuf> {
    let wanted: Vec<String> = names
        .iter()
        .map(|n| normalize(n))
        .filter(|n| !n.is_empty())
        .collect();
    let mut shortcuts = Vec::new();
    for menu in start_menus(folders) {
        files(&menu, "lnk", DEPTH, &mut shortcuts);
    }
    shortcuts.retain(|s| !stem(s).contains("uninstall"));
    shortcuts
        .iter()
        .find(|s| wanted.contains(&stem(s)))
        .or_else(|| {
            shortcuts
                .iter()
                .find(|s| wanted.iter().any(|w| stem(s).starts_with(w.as_str())))
        })
        .cloned()
}

/// A program named like the app (`anki.exe`, `Flow.Launcher.exe`) in one of `dirs`.
pub fn program_in(names: &[&str], dirs: &[PathBuf]) -> Option<PathBuf> {
    let wanted: Vec<String> = names
        .iter()
        .map(|n| normalize(n))
        .filter(|n| !n.is_empty())
        .collect();
    dirs.iter().find_map(|dir| {
        let mut programs = Vec::new();
        files(dir, "exe", DEPTH, &mut programs);
        programs.sort();
        programs.into_iter().find(|p| wanted.contains(&stem(p)))
    })
}

/// "Open"'s last resort: a Start-menu shortcut, else a program in the install folders.
pub fn find_program(names: &[&str], dirs: &[PathBuf], folders: &KnownFolders) -> Option<PathBuf> {
    start_menu_shortcut(names, folders).or_else(|| program_in(names, dirs))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(path: &Path) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"").unwrap();
    }

    #[test]
    fn finds_the_shortcut_named_like_the_app() {
        let root = tempfile::tempdir().unwrap();
        let folders = KnownFolders {
            roaming_app_data: Some(root.path().join("user")),
            program_data: Some(root.path().join("all")),
            ..KnownFolders::default()
        };
        let menu = |base: &str, name: &str| {
            root.path()
                .join(base)
                .join(r"Microsoft\Windows\Start Menu\Programs")
                .join(name)
        };
        touch(&menu("all", "Anki.lnk"));
        touch(&menu("all", r"Stellarium\Uninstall Stellarium.lnk"));
        touch(&menu("all", r"Stellarium\Stellarium.lnk"));
        touch(&menu("user", "PowerToys (Preview).lnk"));
        touch(&menu("user", r"Flow Launcher\Flow Launcher.lnk"));

        let find = |name: &str| start_menu_shortcut(&[name], &folders).map(|p| stem(&p));
        assert_eq!(find("Anki").as_deref(), Some("anki"));
        assert_eq!(find("Stellarium").as_deref(), Some("stellarium"));
        assert_eq!(find("PowerToys").as_deref(), Some("powertoyspreview"));
        assert_eq!(find("Flow Launcher").as_deref(), Some("flowlauncher"));
        assert_eq!(find("Kando"), None);
    }

    #[test]
    fn finds_the_program_named_like_the_app() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("luanti-5.18.0-win64");
        touch(&dir.join(r"bin\luanti.exe"));
        touch(&dir.join(r"bin\luanti-server.exe"));
        let flow = root.path().join("FlowLauncher");
        touch(&flow.join(r"app-2.1.4\Flow.Launcher.exe"));
        touch(&flow.join("Update.exe"));

        let found = |names: &[&str], dir: &Path| program_in(names, &[dir.to_path_buf()]);
        assert_eq!(
            found(&["Luanti", "luanti"], &dir),
            Some(dir.join(r"bin\luanti.exe"))
        );
        assert_eq!(
            found(&["Flow Launcher"], &flow),
            Some(flow.join(r"app-2.1.4\Flow.Launcher.exe"))
        );
        assert_eq!(found(&["Kando"], &flow), None);
    }
}
