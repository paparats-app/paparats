//! `sign-manifest` — wraps a JSON file into a manifest envelope (test fixtures, a staging CDN).
//!
//! ```text
//! sign-manifest <payload.json> [--out <envelope.json>] [--self-signed | --unsigned]
//! sign-manifest --public-key       prints "<keyId>:<base64 public key>" (a KeyRing spec)
//! sign-manifest --generate-key     prints a new random seed for PAPARATS_SIGNING_KEY
//! ```
//!
//! The key comes from the environment, never from an argument (so it stays out of shell
//! history): `PAPARATS_SIGNING_KEY` is the 32-byte Ed25519 seed as 64 hex digits or base64;
//! `PAPARATS_SIGNING_KEY_ID` names it (default: the public key's fingerprint). The payload is
//! signed byte for byte as read (after checking that it is JSON). `--self-signed` also embeds
//! the public key (a community channel's self-signed envelope); `--unsigned` needs no key.
//!
//! `node scripts/sign-manifest.mjs …` runs this through cargo.

use std::path::PathBuf;
use std::process::ExitCode;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use ed25519_dalek::SigningKey;
use paparats_catalog::{ManifestEnvelope, decode_key_bytes, key_fingerprint, sign_envelope};

const KEY_VAR: &str = "PAPARATS_SIGNING_KEY";
const KEY_ID_VAR: &str = "PAPARATS_SIGNING_KEY_ID";

const USAGE: &str =
    "usage: sign-manifest <payload.json> [--out <envelope.json>] [--self-signed | --unsigned]
       sign-manifest --public-key
       sign-manifest --generate-key
key: PAPARATS_SIGNING_KEY (32-byte seed, hex or base64), PAPARATS_SIGNING_KEY_ID (optional)";

#[derive(Debug, PartialEq, Eq)]
enum Mode {
    Unsigned,
    Signed,
    SelfSigned,
}

#[derive(Debug, PartialEq, Eq)]
enum Command {
    Sign {
        input: PathBuf,
        out: Option<PathBuf>,
        mode: Mode,
    },
    PublicKey,
    GenerateKey,
    Help,
}

fn parse_args(args: &[String]) -> Result<Command, String> {
    let mut input = None;
    let mut out = None;
    let mut mode = Mode::Signed;
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--help" | "-h" => return Ok(Command::Help),
            "--public-key" if args.len() == 1 => return Ok(Command::PublicKey),
            "--generate-key" if args.len() == 1 => return Ok(Command::GenerateKey),
            "--out" | "-o" => {
                let path = iter.next().ok_or("--out needs a path")?;
                out = Some(PathBuf::from(path));
            }
            "--self-signed" if mode == Mode::Signed => mode = Mode::SelfSigned,
            "--unsigned" if mode == Mode::Signed => mode = Mode::Unsigned,
            flag if flag.starts_with('-') => return Err(format!("unexpected {flag}")),
            path if input.is_none() => input = Some(PathBuf::from(path)),
            extra => return Err(format!("unexpected argument {extra}")),
        }
    }
    let input = input.ok_or("no payload file given")?;
    Ok(Command::Sign { input, out, mode })
}

fn signing_key() -> Result<(SigningKey, String), String> {
    let seed = std::env::var(KEY_VAR).map_err(|_| format!("{KEY_VAR} is not set"))?;
    let bytes = decode_key_bytes(&seed)
        .ok_or_else(|| format!("{KEY_VAR} must be 32 bytes as 64 hex digits or base64"))?;
    let key = SigningKey::from_bytes(&bytes);
    let id = std::env::var(KEY_ID_VAR)
        .ok()
        .map(|id| id.trim().to_owned())
        .filter(|id| !id.is_empty())
        .unwrap_or_else(|| key_fingerprint(&key.verifying_key()));
    Ok((key, id))
}

fn envelope(payload: &[u8], mode: &Mode) -> Result<ManifestEnvelope, String> {
    serde_json::from_slice::<serde_json::Value>(payload)
        .map_err(|e| format!("the payload is not JSON: {e}"))?;
    if *mode == Mode::Unsigned {
        return Ok(ManifestEnvelope {
            payload: BASE64.encode(payload),
            signature: None,
            key_id: None,
            public_key: None,
        });
    }
    let (key, id) = signing_key()?;
    let mut envelope = sign_envelope(&key, &id, payload);
    if *mode == Mode::SelfSigned {
        envelope.public_key = Some(BASE64.encode(key.verifying_key().as_bytes()));
    }
    Ok(envelope)
}

fn run(args: &[String]) -> Result<(), String> {
    match parse_args(args)? {
        Command::Help => println!("{USAGE}"),
        Command::GenerateKey => {
            let mut seed = [0_u8; 32];
            getrandom::fill(&mut seed).map_err(|e| format!("no randomness: {e}"))?;
            println!("{}", BASE64.encode(seed));
        }
        Command::PublicKey => {
            let (key, id) = signing_key()?;
            println!("{id}:{}", BASE64.encode(key.verifying_key().as_bytes()));
        }
        Command::Sign { input, out, mode } => {
            let payload = std::fs::read(&input)
                .map_err(|e| format!("cannot read {}: {e}", input.display()))?;
            let envelope = envelope(&payload, &mode)?;
            let mut text = serde_json::to_string_pretty(&envelope)
                .map_err(|e| format!("cannot encode the envelope: {e}"))?;
            text.push('\n');
            match out {
                Some(path) => std::fs::write(&path, text)
                    .map_err(|e| format!("cannot write {}: {e}", path.display()))?,
                None => print!("{text}"),
            }
        }
    }
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("sign-manifest: {message}\n{USAGE}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(args: &[&str]) -> Result<Command, String> {
        parse_args(&args.iter().map(|a| (*a).to_owned()).collect::<Vec<_>>())
    }

    #[test]
    fn arguments() {
        assert_eq!(
            parse(&["m.json"]).unwrap(),
            Command::Sign {
                input: "m.json".into(),
                out: None,
                mode: Mode::Signed
            }
        );
        assert_eq!(
            parse(&["--self-signed", "m.json", "-o", "e.json"]).unwrap(),
            Command::Sign {
                input: "m.json".into(),
                out: Some("e.json".into()),
                mode: Mode::SelfSigned
            }
        );
        assert_eq!(
            parse(&["m.json", "--unsigned"]).unwrap(),
            Command::Sign {
                input: "m.json".into(),
                out: None,
                mode: Mode::Unsigned
            }
        );
        assert_eq!(parse(&["--public-key"]).unwrap(), Command::PublicKey);
        assert_eq!(parse(&["--generate-key"]).unwrap(), Command::GenerateKey);
        assert_eq!(parse(&["--help"]).unwrap(), Command::Help);
        for bad in [
            &[][..],
            &["a.json", "b.json"],
            &["m.json", "--out"],
            &["m.json", "--unsigned", "--self-signed"],
            &["m.json", "--key", "secret"],
            &["--public-key", "m.json"],
        ] {
            assert!(parse(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn unsigned_envelopes_need_json_but_no_key() {
        let e = envelope(br#"{"a":1}"#, &Mode::Unsigned).unwrap();
        assert_eq!(e.signature, None);
        assert_eq!(BASE64.decode(e.payload).unwrap(), br#"{"a":1}"#);
        assert!(envelope(b"not json", &Mode::Unsigned).is_err());
    }
}
