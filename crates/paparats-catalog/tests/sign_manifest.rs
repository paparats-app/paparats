//! The `sign-manifest` tool produces envelopes the catalog accepts.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::process::Command;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use ed25519_dalek::SigningKey;
use paparats_catalog::{KeyRing, ManifestEnvelope, hex, key_fingerprint, open_community};

const SEED: [u8; 32] = [42; 32];

fn tool() -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_sign-manifest"));
    cmd.env_remove("PAPARATS_SIGNING_KEY")
        .env_remove("PAPARATS_SIGNING_KEY_ID");
    cmd
}

#[test]
fn signs_a_json_file_with_the_key_from_the_environment() {
    let dir = tempfile::tempdir().unwrap();
    let input = dir.path().join("catalog.json");
    let output = dir.path().join("catalog.signed.json");
    let payload = b"{\n  \"generated\": \"2026-09-15\",\n  \"x\": [1, 2]\n}\n";
    std::fs::write(&input, payload).unwrap();

    let status = tool()
        .env("PAPARATS_SIGNING_KEY", hex::encode(&SEED))
        .env("PAPARATS_SIGNING_KEY_ID", "fixture-key")
        .arg(&input)
        .arg("--out")
        .arg(&output)
        .status()
        .unwrap();
    assert!(status.success());

    let envelope = ManifestEnvelope::from_slice(&std::fs::read(&output).unwrap()).unwrap();
    assert_eq!(envelope.key_id.as_deref(), Some("fixture-key"));
    let public = SigningKey::from_bytes(&SEED).verifying_key();
    let ring = KeyRing::new().with("fixture-key", public).unwrap();
    // Signed byte for byte, whitespace included.
    assert_eq!(ring.open(&envelope).unwrap(), payload);

    // --public-key prints a KeyRing spec for the same key (default id = fingerprint).
    let out = tool()
        .env("PAPARATS_SIGNING_KEY", BASE64.encode(SEED))
        .arg("--public-key")
        .output()
        .unwrap();
    assert!(out.status.success());
    let spec = String::from_utf8(out.stdout).unwrap();
    let ring = KeyRing::from_spec(spec.trim()).unwrap();
    assert_eq!(ring.ids().collect::<Vec<_>>(), [key_fingerprint(&public)]);

    // Self-signed community envelope.
    let out = tool()
        .env("PAPARATS_SIGNING_KEY", hex::encode(&SEED))
        .arg(&input)
        .arg("--self-signed")
        .output()
        .unwrap();
    assert!(out.status.success());
    let envelope = ManifestEnvelope::from_slice(&out.stdout).unwrap();
    let opened = open_community(&KeyRing::new(), &envelope, None).unwrap();
    assert_eq!(opened.payload, payload);
    assert_eq!(opened.warnings.len(), 1);
}

#[test]
fn refuses_without_a_key_or_with_a_non_json_payload() {
    let dir = tempfile::tempdir().unwrap();
    let input = dir.path().join("m.json");
    std::fs::write(&input, b"{}").unwrap();
    let out = tool().arg(&input).output().unwrap();
    assert!(!out.status.success());
    assert!(String::from_utf8_lossy(&out.stderr).contains("PAPARATS_SIGNING_KEY"));

    let out = tool()
        .env("PAPARATS_SIGNING_KEY", "tooshort")
        .arg(&input)
        .output()
        .unwrap();
    assert!(!out.status.success());

    std::fs::write(&input, b"not json").unwrap();
    let out = tool()
        .env("PAPARATS_SIGNING_KEY", hex::encode(&SEED))
        .arg(&input)
        .output()
        .unwrap();
    assert!(!out.status.success());

    // A generated key is a usable seed.
    let out = tool().arg("--generate-key").output().unwrap();
    assert!(out.status.success());
    let seed = String::from_utf8(out.stdout).unwrap();
    assert_eq!(BASE64.decode(seed.trim()).unwrap().len(), 32);
}
