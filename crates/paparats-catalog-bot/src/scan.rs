//! What the bot checks in a downloaded release file before the catalog may point at it: the
//! Authenticode signature of EXE/MSI files and a Microsoft Defender scan (when the machine has
//! one — the Windows runners do).

use std::path::{Path, PathBuf};

/// The signature of an EXE/MSI.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Signature {
    /// Signed and trusted by Windows; the signer's common name.
    Signed(String),
    Unsigned,
    /// A signature Windows does not trust (tampered, expired root, revoked …): never shipped.
    Broken(String),
    /// Not checked: not an EXE/MSI, or not on Windows.
    NotApplicable,
}

pub fn signature(path: &Path) -> Signature {
    let is_signed_kind = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("exe") || e.eq_ignore_ascii_case("msi"));
    if !is_signed_kind || !cfg!(windows) {
        return Signature::NotApplicable;
    }
    match paparats_install::verify_authenticode(path) {
        Ok(info) => Signature::Signed(info.common_name),
        Err(paparats_install::AuthenticodeError::Unsigned) => Signature::Unsigned,
        Err(e) => Signature::Broken(e.to_string()),
    }
}

fn defender() -> Option<PathBuf> {
    let program_files = std::env::var_os("ProgramFiles")?;
    let path = PathBuf::from(program_files)
        .join("Windows Defender")
        .join("MpCmdRun.exe");
    path.is_file().then_some(path)
}

/// `clean`, `skipped` (no Defender here) or `threat: …` / `error …`.
pub async fn antivirus(path: &Path) -> String {
    let Some(exe) = defender() else {
        return "skipped".to_owned();
    };
    let output = tokio::process::Command::new(exe)
        .args(["-Scan", "-ScanType", "3", "-DisableRemediation", "-File"])
        .arg(path)
        .output()
        .await;
    match output {
        Ok(out) => match out.status.code() {
            Some(0) => "clean".to_owned(),
            Some(2) => {
                let text = String::from_utf8_lossy(&out.stdout);
                let found = text
                    .lines()
                    .filter(|l| l.contains("Threat") || l.contains("threat"))
                    .collect::<Vec<_>>()
                    .join("; ");
                format!("threat: {}", found.trim())
            }
            code => format!("error {code:?}"),
        },
        Err(e) => format!("error {e}"),
    }
}
