//! Signed manifests. Every catalog/channel manifest is Ed25519-signed and verified before any
//! hash or host inside it is trusted ("verify before trusting": manifest signature → download
//! hash → Authenticode). This is the hex `SignedManifest` form and the verifier; the served
//! envelope (base64, `keyId`) is [`crate::ManifestEnvelope`], fetched by [`crate::RemoteCatalog`].

use ed25519_dalek::{Signature, VerifyingKey};
use paparats_core::{ChannelId, IsoDate, Package};
use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::{CatalogError, hex};

/// Checks a detached signature over the exact manifest bytes.
pub trait ManifestVerifier: Send + Sync {
    fn verify(&self, payload: &[u8], signature: &[u8]) -> Result<(), CatalogError>;
}

/// Ed25519 (strict verification) against a set of trusted public keys, so keys can be rotated
/// by shipping the new key alongside the old one.
#[derive(Debug, Clone)]
pub struct Ed25519Verifier {
    keys: Vec<VerifyingKey>,
}

impl Ed25519Verifier {
    /// Trusts `keys`. Rejects an empty set and weak (small-order) keys.
    pub fn new(keys: Vec<VerifyingKey>) -> Result<Self, CatalogError> {
        if keys.is_empty() {
            return Err(CatalogError::NoTrustedKeys);
        }
        if keys.iter().any(VerifyingKey::is_weak) {
            return Err(CatalogError::MalformedKey("weak public key".into()));
        }
        Ok(Self { keys })
    }

    /// Trusts public keys given as 64 hex digits each.
    pub fn from_hex(keys: &[&str]) -> Result<Self, CatalogError> {
        let keys = keys
            .iter()
            .map(|k| {
                let bytes: [u8; 32] = hex::decode(k)
                    .and_then(|b| b.try_into().ok())
                    .ok_or_else(|| CatalogError::MalformedKey("expected 32 bytes of hex".into()))?;
                VerifyingKey::from_bytes(&bytes)
                    .map_err(|e| CatalogError::MalformedKey(e.to_string()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        Self::new(keys)
    }
}

impl ManifestVerifier for Ed25519Verifier {
    fn verify(&self, payload: &[u8], signature: &[u8]) -> Result<(), CatalogError> {
        let signature = Signature::from_slice(signature)
            .map_err(|e| CatalogError::MalformedSignature(e.to_string()))?;
        if self
            .keys
            .iter()
            .any(|key| key.verify_strict(payload, &signature).is_ok())
        {
            Ok(())
        } else {
            Err(CatalogError::BadSignature)
        }
    }
}

/// A manifest as served: the JSON text exactly as signed, and the detached signature in hex.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignedManifest {
    pub payload: String,
    pub signature: String,
}

/// The releases a channel (or the official catalog) publishes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelManifest {
    pub channel_id: ChannelId,
    pub generated: IsoDate,
    pub packages: Vec<Package>,
}

/// Verifies the signature first, then parses the payload. Nothing in an unverified manifest is
/// ever looked at.
pub fn verify_manifest<T: DeserializeOwned>(
    verifier: &dyn ManifestVerifier,
    signed: &SignedManifest,
) -> Result<T, CatalogError> {
    let signature = hex::decode(&signed.signature)
        .ok_or_else(|| CatalogError::MalformedSignature("not hex".into()))?;
    verifier.verify(signed.payload.as_bytes(), &signature)?;
    serde_json::from_str(&signed.payload).map_err(CatalogError::MalformedManifest)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use paparats_core::InstallStrategy;

    fn generate() -> SigningKey {
        let mut seed = [0u8; 32];
        getrandom::fill(&mut seed).unwrap();
        SigningKey::from_bytes(&seed)
    }

    fn manifest() -> ChannelManifest {
        ChannelManifest {
            channel_id: "kvetka".into(),
            generated: "2026-09-15".into(),
            packages: vec![Package {
                app_id: "shell".into(),
                version: "1.9.15".into(),
                url: Some("https://downloads.kvetka.example/shell-1.9.15.msi".into()),
                sha256: Some("ab".repeat(32)),
                size_bytes: 3_355_443,
                strategy: InstallStrategy::Msi,
                signer: Some("Kvetka".into()),
            }],
        }
    }

    fn sign(key: &SigningKey, payload: &str) -> SignedManifest {
        SignedManifest {
            payload: payload.to_owned(),
            signature: hex::encode(&key.sign(payload.as_bytes()).to_bytes()),
        }
    }

    #[test]
    fn accepts_a_manifest_signed_by_a_trusted_key() {
        let key = generate();
        let verifier =
            Ed25519Verifier::from_hex(&[&hex::encode(key.verifying_key().as_bytes())]).unwrap();
        let payload = serde_json::to_string(&manifest()).unwrap();
        let parsed: ChannelManifest = verify_manifest(&verifier, &sign(&key, &payload)).unwrap();
        assert_eq!(parsed, manifest());
    }

    #[test]
    fn supports_key_rotation() {
        let (old, new) = (generate(), generate());
        let verifier =
            Ed25519Verifier::new(vec![old.verifying_key(), new.verifying_key()]).unwrap();
        let payload = serde_json::to_string(&manifest()).unwrap();
        assert!(verify_manifest::<ChannelManifest>(&verifier, &sign(&old, &payload)).is_ok());
        assert!(verify_manifest::<ChannelManifest>(&verifier, &sign(&new, &payload)).is_ok());
    }

    #[test]
    fn rejects_tampered_payloads_and_foreign_keys() {
        let (key, stranger) = (generate(), generate());
        let verifier = Ed25519Verifier::new(vec![key.verifying_key()]).unwrap();
        let payload = serde_json::to_string(&manifest()).unwrap();

        let mut tampered = sign(&key, &payload);
        tampered.payload = tampered.payload.replace("1.9.15", "6.6.6");
        assert!(matches!(
            verify_manifest::<ChannelManifest>(&verifier, &tampered),
            Err(CatalogError::BadSignature)
        ));
        assert!(matches!(
            verify_manifest::<ChannelManifest>(&verifier, &sign(&stranger, &payload)),
            Err(CatalogError::BadSignature)
        ));
    }

    #[test]
    fn rejects_malformed_input() {
        let key = generate();
        let verifier = Ed25519Verifier::new(vec![key.verifying_key()]).unwrap();
        let mut signed = sign(&key, "{}");
        signed.signature = "zz".into();
        assert!(matches!(
            verify_manifest::<ChannelManifest>(&verifier, &signed),
            Err(CatalogError::MalformedSignature(_))
        ));
        signed.signature = "abcd".into();
        assert!(matches!(
            verify_manifest::<ChannelManifest>(&verifier, &signed),
            Err(CatalogError::MalformedSignature(_))
        ));
        // Correctly signed, but not a manifest.
        assert!(matches!(
            verify_manifest::<ChannelManifest>(&verifier, &sign(&key, "{}")),
            Err(CatalogError::MalformedManifest(_))
        ));
        assert!(matches!(
            Ed25519Verifier::new(vec![]),
            Err(CatalogError::NoTrustedKeys)
        ));
        assert!(matches!(
            Ed25519Verifier::from_hex(&["1234"]),
            Err(CatalogError::MalformedKey(_))
        ));
    }
}
