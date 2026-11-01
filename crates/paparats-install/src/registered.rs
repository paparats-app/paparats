//! Uninstalling an app through the entry Windows keeps for it ("Installed apps"): what an EXE
//! installer registered, or any app installed outside Paparats. The inventory finds the entry;
//! this module turns its command into an argument vector (never a shell) and makes it silent
//! where the uninstaller's kind is known.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use crate::InstallError;
use crate::args;

/// An Uninstall entry's commands, as the inventory found them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegisteredUninstall {
    /// The entry's key: an MSI product code, an Inno Setup id (`…_is1`) or the installer's name.
    pub key: String,
    /// `WindowsInstaller` = 1: an MSI product whose key is its product code.
    pub windows_installer: bool,
    pub uninstall_string: Option<String>,
    pub quiet_uninstall_string: Option<String>,
    /// Registered for all users (HKLM): the uninstaller runs elevated.
    pub machine_wide: bool,
}

/// How a registered uninstaller is run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UninstallPlan {
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub elevate: bool,
    /// The kind recognised, for the log: `msi`, `quiet`, `inno`, `squirrel`, `burn`, `nsis`.
    pub kind: &'static str,
}

/// Programs an Uninstall entry must never make Paparats start: shells and script hosts.
const REFUSED: [&str; 8] = [
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
    "wscript.exe",
    "cscript.exe",
    "mshta.exe",
    "rundll32.exe",
    "regsvr32.exe",
];

/// Splits a command line the way `CommandLineToArgvW` does for ordinary input: whitespace
/// separates arguments, double quotes group, `\"` is a literal quote.
pub fn split_command_line(line: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut started = false;
    let mut chars = line.trim().chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' if chars.peek() == Some(&'"') => {
                current.push('"');
                chars.next();
                started = true;
            }
            '"' => {
                quoted = !quoted;
                started = true;
            }
            c if c.is_whitespace() && !quoted => {
                if started {
                    args.push(std::mem::take(&mut current));
                    started = false;
                }
            }
            c => {
                current.push(c);
                started = true;
            }
        }
    }
    if started {
        args.push(current);
    }
    args
}

/// The program and its arguments of a registry command line. An unquoted path with spaces
/// (`C:\Program Files\X\uninst.exe /S`) is taken up to `.exe`, as Windows itself does.
fn program_and_args(line: &str) -> Option<(PathBuf, Vec<String>)> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    if !line.starts_with('"') {
        let lower = line.to_ascii_lowercase();
        if let Some(end) = lower.find(".exe") {
            let program = &line[..end + 4];
            let rest = split_command_line(&line[end + 4..]);
            return Some((PathBuf::from(program), rest));
        }
    }
    let mut parts = split_command_line(line).into_iter();
    let program = PathBuf::from(parts.next()?);
    Some((program, parts.collect()))
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

/// Inno Setup's uninstaller: `unins000.exe`, `unins001.exe`, …
fn is_inno_uninstaller(name: &str) -> bool {
    name.strip_prefix("unins")
        .and_then(|rest| rest.strip_suffix(".exe"))
        .is_some_and(|digits| digits.len() == 3 && digits.bytes().all(|b| b.is_ascii_digit()))
}

fn has(args: &[String], flag: &str) -> bool {
    args.iter().any(|a| a.eq_ignore_ascii_case(flag))
}

impl RegisteredUninstall {
    /// The silent uninstall for this entry. MSI products go through `msiexec /x … /qn`; a
    /// `QuietUninstallString` is run as written; otherwise the `UninstallString` gets the silent
    /// switches of its kind (Inno Setup, Squirrel, WiX Burn, NSIS and NSIS-like uninstallers).
    pub fn plan(&self, msiexec: &Path) -> Result<UninstallPlan, InstallError> {
        let elevate = self.machine_wide;
        if self.windows_installer && args::is_product_code(&self.key) {
            return Ok(UninstallPlan {
                program: msiexec.to_path_buf(),
                args: args::msi_uninstall(&self.key)?,
                elevate,
                kind: "msi",
            });
        }
        let (line, quiet) = match (&self.quiet_uninstall_string, &self.uninstall_string) {
            (Some(q), _) if !q.trim().is_empty() => (q.as_str(), true),
            (_, Some(u)) if !u.trim().is_empty() => (u.as_str(), false),
            _ => return Err(InstallError::invalid("the app registered no uninstaller")),
        };
        let (program, mut argv) = program_and_args(line)
            .ok_or_else(|| InstallError::invalid("the app's uninstall command is empty"))?;
        let name = file_name(&program);
        if !program.is_absolute() || REFUSED.contains(&name.as_str()) {
            return Err(InstallError::invalid(
                "the app's uninstall command is not a program Paparats runs",
            ));
        }
        if name == "msiexec.exe" {
            // `MsiExec.exe /I{code}` or `/X{code}` without WindowsInstaller = 1.
            let code = argv
                .iter()
                .find_map(|a| {
                    let upper = a.to_ascii_uppercase();
                    upper
                        .strip_prefix("/X")
                        .or_else(|| upper.strip_prefix("/I"))
                        .map(str::to_owned)
                })
                .filter(|c| args::is_product_code(c))
                .ok_or_else(|| {
                    InstallError::invalid("an msiexec command without a product code")
                })?;
            return Ok(UninstallPlan {
                program: msiexec.to_path_buf(),
                args: args::msi_uninstall(&code)?,
                elevate,
                kind: "msi",
            });
        }
        let kind = if quiet {
            "quiet"
        } else if is_inno_uninstaller(&name) {
            // `/LOG` leaves `Setup Log … .txt` in %TEMP%: what to read when an uninstall fails.
            for flag in ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/LOG"] {
                if !has(&argv, flag) {
                    argv.push(flag.to_owned());
                }
            }
            "inno"
        } else if name == "update.exe" && has(&argv, "--uninstall") {
            if !has(&argv, "-s") && !has(&argv, "--silent") {
                argv.push("-s".to_owned());
            }
            "squirrel"
        } else if has(&argv, "/uninstall")
            && program
                .to_string_lossy()
                .to_lowercase()
                .contains("\\package cache\\")
        {
            for flag in ["/quiet", "/norestart"] {
                if !has(&argv, flag) {
                    argv.push(flag.to_owned());
                }
            }
            "burn"
        } else {
            if !has(&argv, "/S") {
                argv.push("/S".to_owned());
            }
            "nsis"
        };
        Ok(UninstallPlan {
            program,
            args: argv.into_iter().map(OsString::from).collect(),
            elevate,
            kind,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MSIEXEC: &str = r"C:\Windows\System32\msiexec.exe";

    fn entry(key: &str, uninstall: Option<&str>, quiet: Option<&str>) -> RegisteredUninstall {
        RegisteredUninstall {
            key: key.into(),
            windows_installer: false,
            uninstall_string: uninstall.map(str::to_owned),
            quiet_uninstall_string: quiet.map(str::to_owned),
            machine_wide: false,
        }
    }

    fn plan(e: &RegisteredUninstall) -> UninstallPlan {
        e.plan(Path::new(MSIEXEC)).unwrap()
    }

    fn args_of(p: &UninstallPlan) -> Vec<String> {
        p.args
            .iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn splits_command_lines_like_windows() {
        assert_eq!(
            split_command_line(r#""C:\Program Files\X\Uninstall X.exe" /currentuser"#),
            [r"C:\Program Files\X\Uninstall X.exe", "/currentuser"]
        );
        assert_eq!(split_command_line(r#"a "b c" d\"e"#), ["a", "b c", "d\"e"]);
        assert!(split_command_line("   ").is_empty());
    }

    #[test]
    fn silent_switches_by_kind() {
        // Electron-builder / Tauri NSIS (Obsidian, Jan, Handy, …).
        let nsis = plan(&entry(
            "obsidian",
            Some(
                r#""C:\Users\u\AppData\Local\Programs\Obsidian\Uninstall Obsidian.exe" /currentuser"#,
            ),
            None,
        ));
        assert_eq!(nsis.kind, "nsis");
        assert_eq!(args_of(&nsis), ["/currentuser", "/S"]);
        assert!(!nsis.elevate);

        // Inno Setup (LocalSend, VSCodium, DeskBox).
        let inno = plan(&entry(
            "{00809252-FEC6-448E-83B4-E7F55AE7E47D}_is1",
            Some(r#""C:\Users\u\AppData\Local\Programs\LocalSend\unins000.exe""#),
            None,
        ));
        assert_eq!(inno.kind, "inno");
        assert_eq!(
            args_of(&inno),
            ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/LOG"]
        );

        // Squirrel (Flow Launcher, Kando).
        let squirrel = plan(&entry(
            "kando",
            Some(r#""C:\Users\u\AppData\Local\kando\Update.exe" --uninstall"#),
            None,
        ));
        assert_eq!(squirrel.kind, "squirrel");
        assert_eq!(args_of(&squirrel), ["--uninstall", "-s"]);

        // WiX Burn bundle (PowerToys).
        let burn = plan(&entry(
            "{3EBA0D9F-128D-4260-9800-FC268E8E5A0F}",
            Some(
                r#""C:\Users\u\AppData\Local\Package Cache\{3eba}\PowerToysUserSetup.exe" /uninstall"#,
            ),
            None,
        ));
        assert_eq!(burn.kind, "burn");
        assert_eq!(args_of(&burn), ["/uninstall", "/quiet", "/norestart"]);

        // An unquoted path with spaces is read up to `.exe`.
        let unquoted = plan(&entry(
            "x",
            Some(r"C:\Program Files\X Tool\uninst.exe /S"),
            None,
        ));
        assert_eq!(
            unquoted.program,
            PathBuf::from(r"C:\Program Files\X Tool\uninst.exe")
        );
        assert_eq!(args_of(&unquoted), ["/S"]);
    }

    #[test]
    fn msi_products_and_quiet_strings() {
        let mut msi = entry(
            "{74683A1C-A26F-4CF8-9DF9-1B80B14A43D3}",
            Some("MsiExec.exe /X{74683A1C-A26F-4CF8-9DF9-1B80B14A43D3}"),
            None,
        );
        msi.windows_installer = true;
        msi.machine_wide = true;
        let p = plan(&msi);
        assert_eq!((p.kind, p.elevate), ("msi", true));
        assert_eq!(p.program, PathBuf::from(MSIEXEC));
        assert_eq!(
            args_of(&p),
            [
                "/x",
                "{74683A1C-A26F-4CF8-9DF9-1B80B14A43D3}",
                "/qn",
                "/norestart"
            ]
        );

        let unflagged = entry(
            "app",
            Some(r"C:\Windows\System32\MsiExec.exe /I{74683A1C-A26F-4CF8-9DF9-1B80B14A43D3}"),
            None,
        );
        assert_eq!(plan(&unflagged).kind, "msi");

        let quiet = plan(&entry(
            "x",
            Some(r#""C:\X\uninstall.exe""#),
            Some(r#""C:\X\uninstall.exe" /S /quiet"#),
        ));
        assert_eq!(
            (quiet.kind, args_of(&quiet)),
            ("quiet", vec!["/S".to_owned(), "/quiet".to_owned()])
        );
    }

    #[test]
    fn refuses_what_is_not_an_uninstaller() {
        let refused = |line: &str| {
            entry("x", Some(line), None)
                .plan(Path::new(MSIEXEC))
                .is_err()
        };
        assert!(refused(r"C:\Windows\System32\cmd.exe /c del C:\x"));
        assert!(refused(
            r#""C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -c x"#
        ));
        assert!(refused("uninstall.exe /S"), "a relative program");
        assert!(refused("MsiExec.exe /X{not-a-code}"));
        assert!(entry("x", None, None).plan(Path::new(MSIEXEC)).is_err());
    }
}
