//! The signature policy for EXE/MSI installers: they run only with an Authenticode signature
//! Windows trusts (and, when the manifest names one, by that signer). The single exception is a
//! package from a community channel whose unsigned-binary warning the user accepted.

use paparats_core::{Package, TrustLevel};

use crate::InstallError;
use crate::authenticode::{AuthenticodeError, SignerInfo};

/// Where a package comes from, as far as the signature policy is concerned.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PackageTrust {
    /// Trust level of the channel whose manifest published the package.
    pub channel: TrustLevel,
    /// The user accepted the "unsigned binary" warning for this package.
    pub unsigned_accepted: bool,
}

impl PackageTrust {
    /// Official channel, nothing accepted: every EXE/MSI must be signed.
    pub const STRICT: Self = Self {
        channel: TrustLevel::Official,
        unsigned_accepted: false,
    };

    /// Whether an unsigned EXE/MSI may run.
    pub fn allows_unsigned(self) -> bool {
        self.channel == TrustLevel::Community && self.unsigned_accepted
    }
}

/// Tells the installer where a package comes from (the app knows the routing channel and what
/// the user accepted; the installer does not).
pub trait TrustSource: Send + Sync + 'static {
    fn trust(&self, package: &Package) -> PackageTrust;
}

/// Every package is held to the strictest policy.
#[derive(Debug, Clone, Copy, Default)]
pub struct StrictTrust;

impl TrustSource for StrictTrust {
    fn trust(&self, _package: &Package) -> PackageTrust {
        PackageTrust::STRICT
    }
}

impl<F> TrustSource for F
where
    F: Fn(&Package) -> PackageTrust + Send + Sync + 'static,
{
    fn trust(&self, package: &Package) -> PackageTrust {
        self(package)
    }
}

/// Decides whether an EXE/MSI with this Authenticode verdict may run. `Ok(None)` = unsigned but
/// allowed (community channel, warning accepted, no signer named by the manifest).
pub fn authorize(
    verdict: Result<SignerInfo, AuthenticodeError>,
    expected_signer: Option<&str>,
    trust: PackageTrust,
) -> Result<Option<SignerInfo>, InstallError> {
    match verdict {
        Ok(signer) => match expected_signer {
            Some(expected) if !signer.matches(expected) => Err(InstallError::SignerMismatch {
                expected: expected.to_owned(),
                actual: signer.common_name,
            }),
            _ => Ok(Some(signer)),
        },
        // A manifest that names a signer promises a signature: its absence is never waived.
        Err(AuthenticodeError::Unsigned)
            if expected_signer.is_none() && trust.allows_unsigned() =>
        {
            Ok(None)
        }
        Err(AuthenticodeError::Unsigned) => Err(InstallError::Unsigned),
        Err(AuthenticodeError::Untrusted(failure)) => Err(InstallError::BadSignature(failure)),
        Err(AuthenticodeError::Io(e)) => Err(InstallError::Io(e)),
        Err(AuthenticodeError::System(message)) => Err(InstallError::System(message)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::authenticode::{SignatureSource, TrustFailure};

    fn signer(cn: &str) -> SignerInfo {
        SignerInfo {
            subject: format!("CN={cn}, O={cn}, C=BY"),
            common_name: cn.into(),
            issuer: "Some CA".into(),
            source: SignatureSource::Embedded,
        }
    }

    const COMMUNITY_ACCEPTED: PackageTrust = PackageTrust {
        channel: TrustLevel::Community,
        unsigned_accepted: true,
    };

    #[test]
    fn signed_installers_run_and_the_named_signer_must_match() {
        let ok = authorize(Ok(signer("Kvetka")), None, PackageTrust::STRICT).unwrap();
        assert_eq!(ok.map(|s| s.common_name), Some("Kvetka".into()));
        assert!(authorize(Ok(signer("Kvetka")), Some("kvetka"), PackageTrust::STRICT).is_ok());
        let err = authorize(Ok(signer("Mallory")), Some("Kvetka"), COMMUNITY_ACCEPTED).unwrap_err();
        assert!(matches!(
            err,
            InstallError::SignerMismatch { ref expected, ref actual }
                if expected == "Kvetka" && actual == "Mallory"
        ));
    }

    #[test]
    fn unsigned_runs_only_from_a_community_channel_after_the_warning() {
        let unsigned = || Err(AuthenticodeError::Unsigned);
        assert!(matches!(
            authorize(unsigned(), None, COMMUNITY_ACCEPTED),
            Ok(None)
        ));
        for trust in [
            PackageTrust::STRICT,
            PackageTrust {
                channel: TrustLevel::Verified,
                unsigned_accepted: true,
            },
            PackageTrust {
                channel: TrustLevel::Community,
                unsigned_accepted: false,
            },
        ] {
            assert!(matches!(
                authorize(unsigned(), None, trust),
                Err(InstallError::Unsigned)
            ));
        }
        // The manifest promised a signer: no waiver.
        assert!(matches!(
            authorize(unsigned(), Some("Kvetka"), COMMUNITY_ACCEPTED),
            Err(InstallError::Unsigned)
        ));
    }

    #[test]
    fn broken_signatures_are_never_waived() {
        let err = authorize(
            Err(AuthenticodeError::Untrusted(TrustFailure::Tampered)),
            None,
            COMMUNITY_ACCEPTED,
        )
        .unwrap_err();
        assert!(matches!(
            err,
            InstallError::BadSignature(TrustFailure::Tampered)
        ));
        assert_eq!(err.code(), "badSignature");
    }

    #[test]
    fn closures_are_trust_sources() {
        let source = |p: &Package| PackageTrust {
            channel: if p.app_id == "shell" {
                TrustLevel::Community
            } else {
                TrustLevel::Official
            },
            unsigned_accepted: true,
        };
        let shell = Package::simulated("shell", "1", 1.0);
        let vlc = Package::simulated("vlc", "1", 1.0);
        assert!(source.trust(&shell).allows_unsigned());
        assert!(!source.trust(&vlc).allows_unsigned());
        assert_eq!(StrictTrust.trust(&shell), PackageTrust::STRICT);
    }
}
