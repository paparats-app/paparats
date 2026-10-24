//! Install errors. Messages never carry file paths (they name the user) or anything else personal;
//! [`InstallError::code`] is the stable kind the UI maps to copy.

use crate::Cancelled;
use crate::authenticode::TrustFailure;

#[derive(Debug, thiserror::Error)]
pub enum InstallError {
    /// The queue item was cancelled (its gate). Never used for an installer that reports a
    /// cancel by itself — that is [`InstallError::InstallerCancelled`].
    #[error("installation was cancelled")]
    Cancelled,
    /// Something this build or this package cannot do (a Windows-only step on another
    /// platform; uninstalling an EXE install, whose own uninstaller is not run yet).
    #[error("not supported: {0}")]
    Unsupported(&'static str),
    #[error("the downloaded package file is missing")]
    MissingFile,
    #[error("installer failed: {0}")]
    Failed(String),
    /// The file or the manifest entry cannot be installed as declared (no SHA-256, not an MSI,
    /// not a ZIP, an unusable app id or version, an archive over the size limits, …).
    #[error("invalid package: {0}")]
    InvalidPackage(String),
    /// The file on disk is not the one the verified manifest describes.
    #[error("the package does not match the SHA-256 of its manifest")]
    HashMismatch,
    /// An EXE/MSI without an Authenticode signature, from a channel (or without the user's
    /// acceptance) that does not allow unsigned binaries.
    #[error("the installer is not signed")]
    Unsigned,
    /// The signature exists but Windows does not trust it (tampered, revoked, untrusted root, …).
    #[error("the installer's signature is not trusted: {0}")]
    BadSignature(TrustFailure),
    /// A valid signature by someone other than the signer the manifest names.
    #[error("the installer is signed by \"{actual}\", the manifest expects \"{expected}\"")]
    SignerMismatch { expected: String, actual: String },
    /// A ZIP entry that would land outside the install folder (zip slip) or is not a plain file.
    #[error("the archive entry \"{0}\" is not a safe relative path")]
    UnsafeArchivePath(String),
    /// A per-user install was asked for, but the package can only be installed for all users.
    #[error("this package can only be installed for all users")]
    NeedsMachineWide,
    /// The UAC prompt of a machine-wide install was declined.
    #[error("administrator permission was declined")]
    ElevationDeclined,
    /// The installer reported that the user cancelled it (MSI 1602, `ERROR_CANCELLED`).
    #[error("the installer was cancelled")]
    InstallerCancelled,
    /// Another installation is in progress (MSI 1618).
    #[error("another installation is in progress")]
    Busy,
    #[error("the installer did not finish in time")]
    TimedOut,
    /// The installer finished with a failure exit code.
    #[error("the installer exited with code {0}")]
    ExitCode(i32),
    #[error("file system error: {0}")]
    Io(#[from] std::io::Error),
    /// A Windows API failed (HRESULT or Win32 code in the message).
    #[error("Windows error: {0}")]
    System(String),
}

impl InstallError {
    /// A stable, machine-readable kind for the UI (camelCase, never localised).
    pub fn code(&self) -> &'static str {
        match self {
            Self::Cancelled => "cancelled",
            Self::Unsupported(_) => "unsupported",
            Self::MissingFile => "missingFile",
            Self::Failed(_) => "failed",
            Self::InvalidPackage(_) => "invalidPackage",
            Self::HashMismatch => "hashMismatch",
            Self::Unsigned => "unsigned",
            Self::BadSignature(_) => "badSignature",
            Self::SignerMismatch { .. } => "signerMismatch",
            Self::UnsafeArchivePath(_) => "unsafeArchive",
            Self::NeedsMachineWide => "needsMachineWide",
            Self::ElevationDeclined => "elevationDeclined",
            Self::InstallerCancelled => "installerCancelled",
            Self::Busy => "busy",
            Self::TimedOut => "timedOut",
            Self::ExitCode(_) => "exitCode",
            Self::Io(_) => "io",
            Self::System(_) => "system",
        }
    }

    pub(crate) fn invalid(message: impl Into<String>) -> Self {
        Self::InvalidPackage(message.into())
    }
}

impl From<Cancelled> for InstallError {
    fn from(_: Cancelled) -> Self {
        Self::Cancelled
    }
}

impl From<tokio::task::JoinError> for InstallError {
    fn from(e: tokio::task::JoinError) -> Self {
        if e.is_cancelled() {
            Self::Cancelled
        } else {
            Self::System("an install worker stopped unexpectedly".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable_and_messages_carry_no_paths() {
        assert_eq!(InstallError::Unsigned.code(), "unsigned");
        assert_eq!(
            InstallError::BadSignature(TrustFailure::Revoked).code(),
            "badSignature"
        );
        assert_eq!(InstallError::NeedsMachineWide.code(), "needsMachineWide");
        assert_eq!(
            InstallError::Unsupported("EXE uninstall").to_string(),
            "not supported: EXE uninstall"
        );
        assert_eq!(
            InstallError::ExitCode(1603).to_string(),
            "the installer exited with code 1603"
        );
        let e = InstallError::SignerMismatch {
            expected: "Kvetka".into(),
            actual: "Someone Else".into(),
        };
        assert_eq!(e.code(), "signerMismatch");
        assert!(e.to_string().contains("Kvetka"));
    }
}
