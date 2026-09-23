//! Argument vectors per strategy. Installers are spawned with these vectors (never a shell or a
//! command line built from strings); only the elevated path, whose `ShellExecuteExW` takes one
//! parameter string, serialises a vector with the standard Windows quoting rules.

use std::ffi::{OsStr, OsString};
use std::path::Path;

use crate::InstallError;

/// Who an MSI is installed for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MsiScope {
    /// The current user only (`MSIINSTALLPERUSER=1 ALLUSERS=2`), no elevation.
    PerUser,
    /// Every user (`ALLUSERS=1`); elevates through UAC.
    MachineWide,
}

/// `msiexec /i <file> /qn /norestart` plus the scope properties.
pub fn msi_install(file: &Path, scope: MsiScope) -> Vec<OsString> {
    let mut args: Vec<OsString> = vec![
        "/i".into(),
        file.as_os_str().to_owned(),
        "/qn".into(),
        "/norestart".into(),
    ];
    match scope {
        MsiScope::PerUser => {
            args.push("MSIINSTALLPERUSER=1".into());
            args.push("ALLUSERS=2".into());
        }
        MsiScope::MachineWide => args.push("ALLUSERS=1".into()),
    }
    args
}

/// `msiexec /x <product code> /qn /norestart`.
pub fn msi_uninstall(product_code: &str) -> Result<Vec<OsString>, InstallError> {
    if !is_product_code(product_code) {
        return Err(InstallError::invalid("malformed MSI product code"));
    }
    Ok(vec![
        "/x".into(),
        product_code.into(),
        "/qn".into(),
        "/norestart".into(),
    ])
}

/// The manifest's silent arguments, verbatim (Inno: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART
/// /SP-`, NSIS: `/S`, …). Each manifest string is exactly one argument.
pub fn exe_silent(args: &[String]) -> Result<Vec<OsString>, InstallError> {
    if args.iter().any(|a| a.contains('\0')) {
        return Err(InstallError::invalid("installer argument contains NUL"));
    }
    Ok(args.iter().map(OsString::from).collect())
}

/// `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}` (hex digits, any case).
pub fn is_product_code(code: &str) -> bool {
    let bytes = code.as_bytes();
    if bytes.len() != 38 || bytes[0] != b'{' || bytes[37] != b'}' {
        return false;
    }
    bytes[1..37].iter().enumerate().all(|(i, &b)| match i {
        8 | 13 | 18 | 23 => b == b'-',
        _ => b.is_ascii_hexdigit(),
    })
}

/// Serialises an argument vector into one Windows command-line tail, quoting each argument so
/// that `CommandLineToArgvW` (and the MSVC runtime) read the same vector back: arguments with
/// spaces, tabs or quotes are wrapped in quotes, backslashes before a quote are doubled.
pub fn join_windows_args(args: &[OsString]) -> Result<Vec<u16>, InstallError> {
    let mut out: Vec<u16> = Vec::new();
    for (i, arg) in args.iter().enumerate() {
        if i > 0 {
            out.push(u16::from(b' '));
        }
        quote_into(arg, &mut out)?;
    }
    Ok(out)
}

fn wide(s: &OsStr) -> Vec<u16> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        s.encode_wide().collect()
    }
    #[cfg(not(windows))]
    {
        s.to_string_lossy().encode_utf16().collect()
    }
}

fn quote_into(arg: &OsStr, out: &mut Vec<u16>) -> Result<(), InstallError> {
    const QUOTE: u16 = b'"' as u16;
    const BACKSLASH: u16 = b'\\' as u16;
    let units = wide(arg);
    if units.contains(&0) {
        return Err(InstallError::invalid("installer argument contains NUL"));
    }
    let needs_quotes = units.is_empty()
        || units
            .iter()
            .any(|&c| matches!(c, 0x20 | 0x09 | 0x0A | 0x0B | QUOTE));
    if !needs_quotes {
        out.extend_from_slice(&units);
        return Ok(());
    }
    out.push(QUOTE);
    let mut backslashes = 0usize;
    for &c in &units {
        if c == BACKSLASH {
            backslashes += 1;
            continue;
        }
        if c == QUOTE {
            // Backslashes before a quote are escaped, then the quote itself.
            out.extend(std::iter::repeat_n(BACKSLASH, backslashes * 2 + 1));
        } else {
            out.extend(std::iter::repeat_n(BACKSLASH, backslashes));
        }
        backslashes = 0;
        out.push(c);
    }
    // Backslashes before the closing quote are doubled so they stay literal.
    out.extend(std::iter::repeat_n(BACKSLASH, backslashes * 2));
    out.push(QUOTE);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(v: &[OsString]) -> Vec<String> {
        v.iter().map(|a| a.to_string_lossy().into_owned()).collect()
    }

    fn joined(args: &[&str]) -> String {
        let args: Vec<OsString> = args.iter().map(OsString::from).collect();
        String::from_utf16(&join_windows_args(&args).unwrap()).unwrap()
    }

    #[test]
    fn msi_vectors() {
        let file =
            Path::new(r"C:\Users\Test User\AppData\Local\Paparats\downloads\shell-1.9.15.msi");
        assert_eq!(
            strings(&msi_install(file, MsiScope::PerUser)),
            [
                "/i",
                r"C:\Users\Test User\AppData\Local\Paparats\downloads\shell-1.9.15.msi",
                "/qn",
                "/norestart",
                "MSIINSTALLPERUSER=1",
                "ALLUSERS=2",
            ]
        );
        assert_eq!(
            strings(&msi_install(file, MsiScope::MachineWide))[4..],
            ["ALLUSERS=1"]
        );
        let code = "{12345678-9ABC-def0-1234-56789ABCDEF0}";
        assert_eq!(
            strings(&msi_uninstall(code).unwrap()),
            ["/x", code, "/qn", "/norestart"]
        );
        assert!(msi_uninstall("{12345678-9ABC-def0-1234-56789ABCDEF0} /qb").is_err());
        assert!(msi_uninstall("12345678-9ABC-def0-1234-56789ABCDEF0").is_err());
        assert!(!is_product_code("{1234567G-9ABC-def0-1234-56789ABCDEF0}"));
    }

    #[test]
    fn exe_vectors_are_the_manifest_verbatim() {
        let inno: Vec<String> = ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-"]
            .map(String::from)
            .to_vec();
        assert_eq!(strings(&exe_silent(&inno).unwrap()), inno);
        // One manifest string stays one argument, spaces and shell metacharacters included.
        let tricky = vec![r"/DIR=C:\Program Files\A & B".to_owned(), "/S".to_owned()];
        assert_eq!(strings(&exe_silent(&tricky).unwrap()), tricky);
        assert!(exe_silent(&["/S\0/X".to_owned()]).is_err());
    }

    #[test]
    fn windows_quoting_round_trips() {
        assert_eq!(joined(&["/i", "C:\\a.msi", "/qn"]), r"/i C:\a.msi /qn");
        assert_eq!(
            joined(&["/i", r"C:\Users\Test User\x.msi"]),
            r#"/i "C:\Users\Test User\x.msi""#
        );
        assert_eq!(joined(&[""]), r#""""#);
        assert_eq!(joined(&[r#"say "hi""#]), r#""say \"hi\"""#);
        assert_eq!(joined(&[r"C:\dir with space\"]), r#""C:\dir with space\\""#);
        assert_eq!(joined(&[r#"a\"b"#]), r#""a\\\"b""#);
        assert_eq!(joined(&[r"no\space\needed\"]), r"no\space\needed\");
        let nul = [OsString::from("a\0b")];
        assert!(join_windows_args(&nul).is_err());
    }
}
