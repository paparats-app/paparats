//! Authenticode: `WinVerifyTrust` with `WINTRUST_ACTION_GENERIC_VERIFY_V2`, no UI, revocation
//! checked for the whole chain. An embedded signature is checked first; a file without one is
//! looked up in the system catalogs (how Windows signs its own binaries, e.g. `notepad.exe`).
//! The signer is read from the leaf certificate of the verified chain.

use std::fs::File;
use std::path::Path;

use crate::sys;

/// Who signed a file, from the leaf certificate of a signature Windows trusts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignerInfo {
    /// Full subject, most specific first: `CN=Microsoft Windows, O=Microsoft Corporation, …`
    /// (the form `Get-AuthenticodeSignature` shows).
    pub subject: String,
    /// The certificate's display name (its CN): `Microsoft Windows`.
    pub common_name: String,
    /// Display name of the issuing CA.
    pub issuer: String,
    pub source: SignatureSource,
}

/// Where the trusted signature was found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignatureSource {
    /// Embedded in the file.
    Embedded,
    /// A signed system catalog lists the file's hash.
    Catalog,
}

impl SignerInfo {
    /// Whether this signer is the one a manifest names: the common name or the full subject,
    /// compared ignoring ASCII case and the spacing around RDN separators.
    pub fn matches(&self, expected: &str) -> bool {
        let expected = normalize_name(expected);
        !expected.is_empty()
            && (expected == normalize_name(&self.common_name)
                || expected == normalize_name(&self.subject))
    }
}

fn normalize_name(name: &str) -> String {
    name.split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
        .to_ascii_lowercase()
}

/// Why Windows rejected a signature that is present.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum TrustFailure {
    #[error("the file was changed after it was signed")]
    Tampered,
    #[error("the certificate chain does not end in a trusted root")]
    UntrustedRoot,
    #[error("a certificate in the chain was revoked")]
    Revoked,
    #[error("the revocation status could not be checked")]
    RevocationUnknown,
    #[error("the signing certificate has expired")]
    Expired,
    #[error("the signer is explicitly distrusted on this PC")]
    Distrusted,
    #[error("the certificate is not valid for code signing")]
    WrongUsage,
    #[error("the signature was rejected ({0:#010x})")]
    Other(u32),
}

#[derive(Debug, thiserror::Error)]
pub enum AuthenticodeError {
    /// No embedded signature and no catalog entry (or a format that cannot carry one).
    #[error("the file is not signed")]
    Unsigned,
    #[error("the signature is not trusted: {0}")]
    Untrusted(TrustFailure),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("Windows error: {0}")]
    System(String),
}

/// Verifies the Authenticode signature of `path` and returns its signer.
pub fn verify_authenticode(path: &Path) -> Result<SignerInfo, AuthenticodeError> {
    let file = File::open(path)?;
    verify_file(&file, path)
}

/// Verifies an already opened file (the installer holds it locked against writes from the hash
/// check until the install ends). The file position is undefined afterwards.
pub(crate) fn verify_file(file: &File, path: &Path) -> Result<SignerInfo, AuthenticodeError> {
    sys::verify_trust(file, path)
}

/// The outcome of one `WinVerifyTrust` call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Verdict {
    Trusted,
    Unsigned,
    Untrusted(TrustFailure),
}

// HRESULTs of WinVerifyTrust (wintrust.h / winerror.h).
const TRUST_E_SUBJECT_FORM_UNKNOWN: u32 = 0x800B_0003;
const TRUST_E_SUBJECT_NOT_TRUSTED: u32 = 0x800B_0004;
const TRUST_E_NOSIGNATURE: u32 = 0x800B_0100;
const CERT_E_EXPIRED: u32 = 0x800B_0101;
const CERT_E_UNTRUSTEDROOT: u32 = 0x800B_0109;
const CERT_E_CHAINING: u32 = 0x800B_010A;
const CERT_E_REVOKED: u32 = 0x800B_010C;
const CERT_E_UNTRUSTEDTESTROOT: u32 = 0x800B_010D;
const CERT_E_REVOCATION_FAILURE: u32 = 0x800B_010E;
const CERT_E_WRONG_USAGE: u32 = 0x800B_0110;
const TRUST_E_EXPLICIT_DISTRUST: u32 = 0x800B_0111;
const TRUST_E_BAD_DIGEST: u32 = 0x8009_6010;
const CRYPT_E_REVOKED: u32 = 0x8009_2010;
const CRYPT_E_NO_REVOCATION_CHECK: u32 = 0x8009_2012;
const CRYPT_E_REVOCATION_OFFLINE: u32 = 0x8009_2013;
const CRYPT_E_SECURITY_SETTINGS: u32 = 0x8009_2026;

/// Maps a `WinVerifyTrust` status to a verdict.
pub(crate) fn classify(status: i32) -> Verdict {
    // HRESULTs are compared as their unsigned bit pattern.
    let status = status as u32;
    match status {
        0 => Verdict::Trusted,
        // No signature, or a file format no signature provider handles (not signable).
        TRUST_E_NOSIGNATURE | TRUST_E_SUBJECT_FORM_UNKNOWN => Verdict::Unsigned,
        TRUST_E_BAD_DIGEST => Verdict::Untrusted(TrustFailure::Tampered),
        CERT_E_UNTRUSTEDROOT | CERT_E_CHAINING | CERT_E_UNTRUSTEDTESTROOT => {
            Verdict::Untrusted(TrustFailure::UntrustedRoot)
        }
        CERT_E_REVOKED | CRYPT_E_REVOKED => Verdict::Untrusted(TrustFailure::Revoked),
        CERT_E_REVOCATION_FAILURE | CRYPT_E_NO_REVOCATION_CHECK | CRYPT_E_REVOCATION_OFFLINE => {
            Verdict::Untrusted(TrustFailure::RevocationUnknown)
        }
        CERT_E_EXPIRED => Verdict::Untrusted(TrustFailure::Expired),
        TRUST_E_EXPLICIT_DISTRUST | TRUST_E_SUBJECT_NOT_TRUSTED | CRYPT_E_SECURITY_SETTINGS => {
            Verdict::Untrusted(TrustFailure::Distrusted)
        }
        CERT_E_WRONG_USAGE => Verdict::Untrusted(TrustFailure::WrongUsage),
        other => Verdict::Untrusted(TrustFailure::Other(other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn hr(code: u32) -> i32 {
        code as i32
    }

    #[test]
    fn classifies_win_verify_trust_statuses() {
        assert_eq!(classify(0), Verdict::Trusted);
        assert_eq!(classify(hr(TRUST_E_NOSIGNATURE)), Verdict::Unsigned);
        assert_eq!(
            classify(hr(TRUST_E_SUBJECT_FORM_UNKNOWN)),
            Verdict::Unsigned
        );
        assert_eq!(
            classify(hr(TRUST_E_BAD_DIGEST)),
            Verdict::Untrusted(TrustFailure::Tampered)
        );
        assert_eq!(
            classify(hr(CERT_E_REVOKED)),
            Verdict::Untrusted(TrustFailure::Revoked)
        );
        assert_eq!(
            classify(hr(CRYPT_E_REVOCATION_OFFLINE)),
            Verdict::Untrusted(TrustFailure::RevocationUnknown)
        );
        assert_eq!(
            classify(hr(CERT_E_CHAINING)),
            Verdict::Untrusted(TrustFailure::UntrustedRoot)
        );
        assert_eq!(
            classify(hr(TRUST_E_EXPLICIT_DISTRUST)),
            Verdict::Untrusted(TrustFailure::Distrusted)
        );
        assert_eq!(
            classify(hr(0x8000_4005)),
            Verdict::Untrusted(TrustFailure::Other(0x8000_4005))
        );
    }

    #[test]
    fn signer_matches_common_name_or_full_subject() {
        let s = SignerInfo {
            subject: "CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond, S=Washington, C=US"
                .into(),
            common_name: "Microsoft Windows".into(),
            issuer: "Microsoft Windows Production PCA 2011".into(),
            source: SignatureSource::Catalog,
        };
        assert!(s.matches("Microsoft Windows"));
        assert!(s.matches("  microsoft WINDOWS "));
        assert!(
            s.matches("CN=Microsoft Windows,O=Microsoft Corporation, L=Redmond,S=Washington, C=US")
        );
        assert!(!s.matches("Microsoft"));
        assert!(!s.matches("Microsoft Corporation"));
        assert!(!s.matches("CN=Microsoft Windows, O=Evil Corp"));
        assert!(!s.matches(""));
    }

    #[cfg(windows)]
    #[test]
    fn notepad_is_signed_by_microsoft() {
        let signer = verify_authenticode(Path::new(r"C:\Windows\System32\notepad.exe"))
            .unwrap_or_else(|e| panic!("notepad.exe should verify: {e}"));
        assert!(
            signer.common_name.starts_with("Microsoft"),
            "unexpected signer {signer:?}"
        );
        assert!(signer.subject.starts_with("CN="), "{signer:?}");
        assert!(
            signer.subject.contains("O=Microsoft Corporation"),
            "{signer:?}"
        );
        assert!(!signer.issuer.is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn an_unsigned_file_is_unsigned() {
        let dir = tempfile::tempdir().unwrap();
        // An unsigned PE: the test binary itself, as cargo built it.
        let exe = dir.path().join("unsigned.exe");
        std::fs::copy(std::env::current_exe().unwrap(), &exe).unwrap();
        assert!(matches!(
            verify_authenticode(&exe),
            Err(AuthenticodeError::Unsigned)
        ));
        // Not a signable format at all.
        let txt = dir.path().join("readme.exe");
        std::fs::File::create(&txt)
            .and_then(|mut f| f.write_all(b"not a program"))
            .unwrap();
        assert!(matches!(
            verify_authenticode(&txt),
            Err(AuthenticodeError::Unsigned)
        ));
    }

    #[cfg(windows)]
    #[test]
    fn a_modified_copy_of_a_catalog_signed_file_is_not_trusted() {
        let dir = tempfile::tempdir().unwrap();
        let copy = dir.path().join("notepad.exe");
        std::fs::copy(r"C:\Windows\System32\notepad.exe", &copy).unwrap();
        // The unmodified copy still matches the catalog hash.
        assert!(verify_authenticode(&copy).is_ok());
        let mut bytes = std::fs::read(&copy).unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 0xff;
        std::fs::write(&copy, bytes).unwrap();
        assert!(matches!(
            verify_authenticode(&copy),
            Err(AuthenticodeError::Unsigned | AuthenticodeError::Untrusted(_))
        ));
    }

    #[cfg(windows)]
    #[test]
    fn embedded_signatures_are_checked_and_tampering_is_caught() {
        let explorer = Path::new(r"C:\Windows\explorer.exe");
        let signer = verify_authenticode(explorer).unwrap();
        assert_eq!(signer.source, SignatureSource::Embedded);
        assert_eq!(signer.common_name, "Microsoft Windows");

        let dir = tempfile::tempdir().unwrap();
        let copy = dir.path().join("explorer.exe");
        let mut bytes = std::fs::read(explorer).unwrap();
        // A byte in the code, far from the signature at the end of the file.
        bytes[0x1000] ^= 0xff;
        std::fs::write(&copy, bytes).unwrap();
        assert!(matches!(
            verify_authenticode(&copy),
            Err(AuthenticodeError::Untrusted(TrustFailure::Tampered))
        ));
    }

    #[test]
    fn a_missing_file_is_an_io_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(matches!(
            verify_authenticode(&dir.path().join("nope.exe")),
            Err(AuthenticodeError::Io(_))
        ));
    }
}
