//! The wire format of every remote manifest and the keys that vouch for it.
//!
//! A manifest is served as an envelope:
//!
//! ```json
//! { "payload": "<base64 JSON>", "signature": "<base64 Ed25519>", "keyId": "paparats-2026" }
//! ```
//!
//! The signature covers the decoded payload bytes exactly. [`KeyRing::open`] checks it with the
//! [`Ed25519Verifier`] against a pinned key picked by `keyId`, and only then hands the payload
//! out — nothing inside an unverified manifest (hashes, hosts) is ever looked at. Community
//! channels may publish unsigned or self-signed envelopes; [`open_community`] accepts those on
//! the typed community path with [`TrustWarning`]s, never as verified.

use std::collections::BTreeMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{CatalogError, Ed25519Verifier, ManifestVerifier, hex};

/// A manifest as served.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEnvelope {
    /// The manifest JSON, base64 (standard alphabet, padded).
    pub payload: String,
    /// Detached Ed25519 signature over the decoded payload, base64. Absent = unsigned (accepted
    /// for community channels only, with a warning).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    /// The key that made `signature`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_id: Option<String>,
    /// A community channel's own public key (base64), for self-signed envelopes. It proves the
    /// payload was not altered on the way, never who published it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub public_key: Option<String>,
}

impl ManifestEnvelope {
    /// Parses an envelope from the bytes served.
    pub fn from_slice(body: &[u8]) -> Result<Self, CatalogError> {
        serde_json::from_slice(body).map_err(|e| CatalogError::MalformedEnvelope(e.to_string()))
    }

    /// The decoded payload bytes. Not verified: only for [`KeyRing::open`] and
    /// [`open_community`].
    fn payload_bytes(&self) -> Result<Vec<u8>, CatalogError> {
        BASE64
            .decode(self.payload.trim())
            .map_err(|e| CatalogError::MalformedEnvelope(format!("payload is not base64: {e}")))
    }

    fn signature_bytes(&self) -> Result<Option<Vec<u8>>, CatalogError> {
        self.signature
            .as_deref()
            .map(|s| {
                BASE64
                    .decode(s.trim())
                    .map_err(|e| CatalogError::MalformedSignature(format!("not base64: {e}")))
            })
            .transpose()
    }
}

/// Signs `payload` (the exact bytes that will be verified) with `key`, under `key_id`.
pub fn sign_envelope(key: &SigningKey, key_id: &str, payload: &[u8]) -> ManifestEnvelope {
    ManifestEnvelope {
        payload: BASE64.encode(payload),
        signature: Some(BASE64.encode(key.sign(payload).to_bytes())),
        key_id: Some(key_id.to_owned()),
        public_key: None,
    }
}

/// The default key id of a public key: the first 8 bytes of its SHA-256, in hex.
pub fn key_fingerprint(key: &VerifyingKey) -> String {
    let digest = Sha256::digest(key.as_bytes());
    hex::encode(digest.get(..8).unwrap_or_default())
}

/// A public key as text: 64 hex digits or base64 of the 32 bytes.
pub fn parse_public_key(text: &str) -> Result<VerifyingKey, CatalogError> {
    let bytes = decode_key_bytes(text)
        .ok_or_else(|| CatalogError::MalformedKey("expected 32 bytes of hex or base64".into()))?;
    let key =
        VerifyingKey::from_bytes(&bytes).map_err(|e| CatalogError::MalformedKey(e.to_string()))?;
    if key.is_weak() {
        return Err(CatalogError::MalformedKey("weak public key".into()));
    }
    Ok(key)
}

/// 32 key bytes from 64 hex digits or base64 (public keys, signing seeds).
pub fn decode_key_bytes(text: &str) -> Option<[u8; 32]> {
    let text = text.trim();
    let bytes = if text.len() == 64 {
        hex::decode(text)?
    } else {
        BASE64.decode(text).ok()?
    };
    bytes.try_into().ok()
}

/// Pinned public keys by key id: the official Paparats keys, plus — for a verified channel's
/// own manifest — the keys the (official, signed) channel directory lists for it.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct KeyRing {
    keys: BTreeMap<String, VerifyingKey>,
}

impl KeyRing {
    pub fn new() -> Self {
        Self::default()
    }

    /// Pins `key` under `id`. Rejects an empty id and weak keys; a second key under the same id
    /// replaces the first.
    pub fn insert(&mut self, id: &str, key: VerifyingKey) -> Result<(), CatalogError> {
        let id = id.trim();
        if id.is_empty() {
            return Err(CatalogError::MalformedKey("empty key id".into()));
        }
        if key.is_weak() {
            return Err(CatalogError::MalformedKey("weak public key".into()));
        }
        self.keys.insert(id.to_owned(), key);
        Ok(())
    }

    /// Builder form of [`KeyRing::insert`].
    pub fn with(mut self, id: &str, key: VerifyingKey) -> Result<Self, CatalogError> {
        self.insert(id, key)?;
        Ok(self)
    }

    /// Parses `id:key[,id:key…]` (key as hex or base64; base64 never contains `:` or `,`), the
    /// form an environment override can carry. Empty input is an empty ring.
    pub fn from_spec(spec: &str) -> Result<Self, CatalogError> {
        let mut ring = Self::new();
        for pair in spec.split(',').map(str::trim).filter(|p| !p.is_empty()) {
            let (id, key) = pair
                .split_once(':')
                .ok_or_else(|| CatalogError::MalformedKey("expected id:key".into()))?;
            ring.insert(id, parse_public_key(key)?)?;
        }
        Ok(ring)
    }

    pub fn is_empty(&self) -> bool {
        self.keys.is_empty()
    }

    pub fn len(&self) -> usize {
        self.keys.len()
    }

    pub fn contains(&self, id: &str) -> bool {
        self.keys.contains_key(id)
    }

    /// Key ids, sorted.
    pub fn ids(&self) -> impl Iterator<Item = &str> {
        self.keys.keys().map(String::as_str)
    }

    /// This ring plus `other`'s keys; on an id clash this ring's key wins, so a channel cannot
    /// shadow an official key id.
    pub fn merged(&self, other: &KeyRing) -> KeyRing {
        let mut keys = other.keys.clone();
        keys.extend(self.keys.iter().map(|(id, key)| (id.clone(), *key)));
        KeyRing { keys }
    }

    /// Verifies the envelope's signature with the pinned key named by its `keyId` and returns the
    /// payload bytes. Unsigned → [`CatalogError::Unsigned`]; an id this ring does not pin →
    /// [`CatalogError::UnknownKey`]; a signature that does not match → [`CatalogError::BadSignature`].
    pub fn open(&self, envelope: &ManifestEnvelope) -> Result<Vec<u8>, CatalogError> {
        let signature = envelope.signature_bytes()?.ok_or(CatalogError::Unsigned)?;
        let key_id = envelope.key_id.as_deref().unwrap_or_default();
        let key = self
            .keys
            .get(key_id)
            .ok_or_else(|| CatalogError::UnknownKey(key_id.to_owned()))?;
        let payload = envelope.payload_bytes()?;
        Ed25519Verifier::new(vec![*key])?.verify(&payload, &signature)?;
        Ok(payload)
    }
}

/// Why a manifest is on the community path instead of being verified.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrustWarning {
    /// No signature at all: the content is whatever the channel's server sent.
    Unsigned,
    /// Signed with a key the channel publishes itself: intact in transit, identity unproven.
    SelfSigned { key_id: String },
    /// The self-signed key differs from the one this channel used before.
    KeyChanged { key_id: String },
}

/// A community envelope, opened: the payload and why it is not verified.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommunityPayload {
    pub payload: Vec<u8>,
    pub warnings: Vec<TrustWarning>,
    /// The self-published key (base64) when the envelope was self-signed.
    pub self_signed_key: Option<String>,
}

/// Opens a community channel's envelope. Unsigned → [`TrustWarning::Unsigned`]. Signed with an
/// official key → no warning. Self-signed (a `publicKey` in the envelope) → the signature must
/// still match ([`CatalogError::BadSignature`] otherwise) and gives [`TrustWarning::SelfSigned`],
/// plus [`TrustWarning::KeyChanged`] when `previous_key` was a different key. Signed with neither
/// → [`CatalogError::UnknownKey`].
pub fn open_community(
    official: &KeyRing,
    envelope: &ManifestEnvelope,
    previous_key: Option<&str>,
) -> Result<CommunityPayload, CatalogError> {
    if envelope.signature.is_none() {
        return Ok(CommunityPayload {
            payload: envelope.payload_bytes()?,
            warnings: vec![TrustWarning::Unsigned],
            self_signed_key: None,
        });
    }
    let key_id = envelope.key_id.as_deref().unwrap_or_default();
    if official.contains(key_id) {
        return Ok(CommunityPayload {
            payload: official.open(envelope)?,
            warnings: Vec::new(),
            self_signed_key: None,
        });
    }
    let Some(published) = envelope.public_key.as_deref() else {
        return Err(CatalogError::UnknownKey(key_id.to_owned()));
    };
    let key = parse_public_key(published)?;
    let key_id = if key_id.is_empty() {
        key_fingerprint(&key)
    } else {
        key_id.to_owned()
    };
    let signature = envelope.signature_bytes()?.ok_or(CatalogError::Unsigned)?;
    let payload = envelope.payload_bytes()?;
    Ed25519Verifier::new(vec![key])?.verify(&payload, &signature)?;

    let encoded = BASE64.encode(key.as_bytes());
    let mut warnings = vec![TrustWarning::SelfSigned {
        key_id: key_id.clone(),
    }];
    let changed = previous_key
        .and_then(|p| parse_public_key(p).ok())
        .is_some_and(|previous| previous != key);
    if changed {
        warnings.push(TrustWarning::KeyChanged { key_id });
    }
    Ok(CommunityPayload {
        payload,
        warnings,
        self_signed_key: Some(encoded),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn generate() -> SigningKey {
        let mut seed = [0u8; 32];
        getrandom::fill(&mut seed).unwrap();
        SigningKey::from_bytes(&seed)
    }

    fn ring(id: &str, key: &SigningKey) -> KeyRing {
        KeyRing::new().with(id, key.verifying_key()).unwrap()
    }

    const PAYLOAD: &[u8] = br#"{"channelId":"kvetka","generated":"2026-09-15","packages":[]}"#;

    #[test]
    fn opens_an_envelope_signed_by_a_pinned_key() {
        let key = generate();
        let envelope = sign_envelope(&key, "paparats-2026", PAYLOAD);
        // Round-trips through its JSON form with camelCase names and no empty fields.
        let json = serde_json::to_value(&envelope).unwrap();
        assert_eq!(json["keyId"], "paparats-2026");
        assert!(json.get("publicKey").is_none());
        let parsed = ManifestEnvelope::from_slice(json.to_string().as_bytes()).unwrap();
        assert_eq!(ring("paparats-2026", &key).open(&parsed).unwrap(), PAYLOAD);
    }

    #[test]
    fn rejects_tampering_unknown_keys_and_missing_signatures() {
        let (key, stranger) = (generate(), generate());
        let pinned = ring("paparats-2026", &key);

        let mut tampered = sign_envelope(&key, "paparats-2026", PAYLOAD);
        tampered.payload = BASE64.encode(br#"{"channelId":"evil"}"#);
        assert!(matches!(
            pinned.open(&tampered),
            Err(CatalogError::BadSignature)
        ));

        // A stranger claiming the pinned id, and a stranger under its own id.
        let impostor = sign_envelope(&stranger, "paparats-2026", PAYLOAD);
        assert!(matches!(
            pinned.open(&impostor),
            Err(CatalogError::BadSignature)
        ));
        let foreign = sign_envelope(&stranger, "stranger", PAYLOAD);
        assert!(matches!(
            pinned.open(&foreign),
            Err(CatalogError::UnknownKey(id)) if id == "stranger"
        ));

        let mut unsigned = sign_envelope(&key, "paparats-2026", PAYLOAD);
        unsigned.signature = None;
        assert!(matches!(
            pinned.open(&unsigned),
            Err(CatalogError::Unsigned)
        ));

        let mut garbled = sign_envelope(&key, "paparats-2026", PAYLOAD);
        garbled.signature = Some("!!".into());
        assert!(matches!(
            pinned.open(&garbled),
            Err(CatalogError::MalformedSignature(_))
        ));
        garbled.signature = Some(BASE64.encode([1, 2, 3]));
        assert!(matches!(
            pinned.open(&garbled),
            Err(CatalogError::MalformedSignature(_))
        ));
        assert!(matches!(
            ManifestEnvelope::from_slice(b"not json"),
            Err(CatalogError::MalformedEnvelope(_))
        ));
    }

    #[test]
    fn key_parsing_and_specs() {
        let key = generate().verifying_key();
        let hex_text = hex::encode(key.as_bytes());
        let b64_text = BASE64.encode(key.as_bytes());
        assert_eq!(parse_public_key(&hex_text).unwrap(), key);
        assert_eq!(parse_public_key(&b64_text).unwrap(), key);
        assert!(matches!(
            parse_public_key("abcd"),
            Err(CatalogError::MalformedKey(_))
        ));
        // The identity point is a weak (small-order) key.
        let mut identity = [0u8; 32];
        identity[0] = 1;
        assert!(parse_public_key(&hex::encode(&identity)).is_err());

        let ring = KeyRing::from_spec(&format!(" a:{b64_text} , b:{hex_text} ")).unwrap();
        assert_eq!(ring.ids().collect::<Vec<_>>(), ["a", "b"]);
        assert!(KeyRing::from_spec("").unwrap().is_empty());
        assert!(KeyRing::from_spec("nocolon").is_err());
        assert!(KeyRing::from_spec(&format!(":{b64_text}")).is_err());

        assert_eq!(key_fingerprint(&key).len(), 16);
        assert_eq!(key_fingerprint(&key), key_fingerprint(&key));
    }

    #[test]
    fn merged_rings_keep_official_ids() {
        let (official, channel) = (generate(), generate());
        let ring = ring("paparats-2026", &official);
        let channel_ring = KeyRing::new()
            .with("paparats-2026", channel.verifying_key())
            .unwrap()
            .with("kvetka-1", channel.verifying_key())
            .unwrap();
        let merged = ring.merged(&channel_ring);
        assert_eq!(merged.len(), 2);
        let by_channel_as_official = sign_envelope(&channel, "paparats-2026", PAYLOAD);
        assert!(matches!(
            merged.open(&by_channel_as_official),
            Err(CatalogError::BadSignature)
        ));
        assert!(
            merged
                .open(&sign_envelope(&channel, "kvetka-1", PAYLOAD))
                .is_ok()
        );
    }

    #[test]
    fn community_envelopes_carry_warnings() {
        let (official, author, other) = (generate(), generate(), generate());
        let pinned = ring("paparats-2026", &official);

        let unsigned = ManifestEnvelope {
            payload: BASE64.encode(PAYLOAD),
            signature: None,
            key_id: None,
            public_key: None,
        };
        let opened = open_community(&pinned, &unsigned, None).unwrap();
        assert_eq!(opened.payload, PAYLOAD);
        assert_eq!(opened.warnings, [TrustWarning::Unsigned]);

        let mut self_signed = sign_envelope(&author, "", PAYLOAD);
        self_signed.key_id = None;
        self_signed.public_key = Some(BASE64.encode(author.verifying_key().as_bytes()));
        let opened = open_community(&pinned, &self_signed, None).unwrap();
        let fingerprint = key_fingerprint(&author.verifying_key());
        assert_eq!(
            opened.warnings,
            [TrustWarning::SelfSigned {
                key_id: fingerprint.clone()
            }]
        );
        let first_key = opened.self_signed_key.unwrap();
        // Same key again: no change. Another key later: KeyChanged.
        assert_eq!(
            open_community(&pinned, &self_signed, Some(&first_key))
                .unwrap()
                .warnings
                .len(),
            1
        );
        let mut rekeyed = sign_envelope(&other, "author-2", PAYLOAD);
        rekeyed.public_key = Some(BASE64.encode(other.verifying_key().as_bytes()));
        assert_eq!(
            open_community(&pinned, &rekeyed, Some(&first_key))
                .unwrap()
                .warnings,
            [
                TrustWarning::SelfSigned {
                    key_id: "author-2".into()
                },
                TrustWarning::KeyChanged {
                    key_id: "author-2".into()
                }
            ]
        );

        // A self-signed envelope whose payload was altered is rejected, not downgraded.
        let mut tampered = self_signed.clone();
        tampered.payload = BASE64.encode(br#"{"channelId":"x"}"#);
        assert!(matches!(
            open_community(&pinned, &tampered, None),
            Err(CatalogError::BadSignature)
        ));
        // Signed by the official key: opened without warnings.
        let co_signed = sign_envelope(&official, "paparats-2026", PAYLOAD);
        assert!(
            open_community(&pinned, &co_signed, None)
                .unwrap()
                .warnings
                .is_empty()
        );
        // Signed, but with no key to check it against.
        let orphan = sign_envelope(&author, "who", PAYLOAD);
        assert!(matches!(
            open_community(&pinned, &orphan, None),
            Err(CatalogError::UnknownKey(_))
        ));
    }
}
