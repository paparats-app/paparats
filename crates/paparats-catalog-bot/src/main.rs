//! `catalog-bot` — the official catalog's bot (`paparats-app/catalog`).
//!
//! ```text
//! catalog-bot validate <catalog-dir>
//! catalog-bot resolve  <catalog-dir> [--only <id>]… [--summary <file.md>] [--quarantine-hours <n>]
//! catalog-bot build    <catalog-dir> --out <site-dir> [--base-url <url>] [--unsigned]
//! ```
//!
//! - `validate` checks the app files and `editorial.toml`.
//! - `resolve` finds each app's release on GitHub, downloads new files, checks them (hash against
//!   GitHub's digest, Authenticode, Microsoft Defender) and rewrites `lock.json`. Newer releases
//!   wait `--quarantine-hours` (default 48) before they ship. It needs no key; `GITHUB_TOKEN`
//!   raises the API limit. Under GitHub Actions it sets the step output `attention=true` when a
//!   person should look (a release held back, an app failed, a stale or archived project).
//! - `build` writes the signed manifests and icons for GitHub Pages. The signing key comes from
//!   the environment, never from an argument: `PAPARATS_SIGNING_KEY` (the 32-byte Ed25519 seed,
//!   hex or base64) and `PAPARATS_SIGNING_KEY_ID` (default: the key's fingerprint). `--unsigned`
//!   writes unsigned envelopes for local previews; the client refuses them.

mod build;
mod github;
mod lock;
mod resolve;
mod scan;
mod spec;
mod text;

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use ed25519_dalek::SigningKey;
use paparats_catalog::{decode_key_bytes, key_fingerprint};

/// The default `--base-url`: where GitHub Pages serves the catalog repository's site.
const BASE_URL: &str = "https://paparats-app.github.io/catalog/v1/";

/// How long a newer release waits before it replaces the shipped one.
const QUARANTINE_HOURS: i64 = 48;

#[derive(Debug, thiserror::Error)]
pub enum BotError {
    #[error("{path}: {source}")]
    Io {
        path: String,
        source: std::io::Error,
    },
    #[error("{0}")]
    Spec(String),
    #[error("{0}")]
    Http(String),
    #[error("{0}")]
    Usage(String),
}

impl BotError {
    pub fn io(path: &Path, source: std::io::Error) -> Self {
        Self::Io {
            path: path.display().to_string(),
            source,
        }
    }

    pub fn regex(e: regex::Error) -> Self {
        Self::Spec(format!("regex: {e}"))
    }
}

/// Today in UTC, `YYYY-MM-DD` (the runners' clock).
pub fn today() -> String {
    paparats_core::dates::format(chrono::Utc::now().date_naive())
}

fn signing_key() -> Result<(SigningKey, String), BotError> {
    let seed = std::env::var("PAPARATS_SIGNING_KEY").map_err(|_| {
        BotError::Usage("PAPARATS_SIGNING_KEY is not set (or pass --unsigned)".into())
    })?;
    let bytes = decode_key_bytes(&seed)
        .ok_or_else(|| BotError::Usage("PAPARATS_SIGNING_KEY is not a 32-byte key".into()))?;
    let key = SigningKey::from_bytes(&bytes);
    let id = std::env::var("PAPARATS_SIGNING_KEY_ID")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| key_fingerprint(&key.verifying_key()));
    Ok((key, id))
}

struct Args {
    command: String,
    dir: PathBuf,
    only: BTreeSet<String>,
    summary: Option<PathBuf>,
    out: Option<PathBuf>,
    base_url: String,
    unsigned: bool,
    quarantine_hours: i64,
}

fn parse(args: &[String]) -> Result<Args, BotError> {
    let usage = || {
        BotError::Usage(
            "usage: catalog-bot validate|resolve|build <catalog-dir> [--only id] [--summary f.md] \
             [--out dir] [--base-url url] [--unsigned] [--quarantine-hours n]"
                .into(),
        )
    };
    let mut iter = args.iter();
    let command = iter.next().ok_or_else(usage)?.clone();
    let dir = PathBuf::from(iter.next().ok_or_else(usage)?);
    let mut parsed = Args {
        command,
        dir,
        only: BTreeSet::new(),
        summary: None,
        out: None,
        base_url: BASE_URL.to_owned(),
        unsigned: false,
        quarantine_hours: QUARANTINE_HOURS,
    };
    while let Some(arg) = iter.next() {
        let mut value = || iter.next().cloned().ok_or_else(usage);
        match arg.as_str() {
            "--only" => {
                parsed.only.insert(value()?);
            }
            "--summary" => parsed.summary = Some(PathBuf::from(value()?)),
            "--out" => parsed.out = Some(PathBuf::from(value()?)),
            "--base-url" => {
                let mut url = value()?;
                if !url.ends_with('/') {
                    url.push('/');
                }
                parsed.base_url = url;
            }
            "--unsigned" => parsed.unsigned = true,
            "--quarantine-hours" => {
                parsed.quarantine_hours = value()?.parse().map_err(|_| usage())?;
            }
            _ => return Err(usage()),
        }
    }
    Ok(parsed)
}

async fn run(args: Args) -> Result<(), BotError> {
    let catalog = spec::load(&args.dir)?;
    let lock_path = args.dir.join("lock.json");
    match args.command.as_str() {
        "validate" => {
            println!("{} apps, editorial ok", catalog.apps.len());
            Ok(())
        }
        "resolve" => {
            let mut lock = lock::load(&lock_path)?;
            let token = std::env::var("GITHUB_TOKEN").ok().filter(|t| !t.is_empty());
            let github = github::GitHub::new(token)?;
            let work = std::env::temp_dir().join(format!("catalog-bot-{}", std::process::id()));
            std::fs::create_dir_all(&work).map_err(|e| BotError::io(&work, e))?;
            let report = resolve::run(
                &catalog,
                &mut lock,
                &github,
                &args.only,
                &work,
                args.quarantine_hours,
            )
            .await;
            let _ = std::fs::remove_dir_all(&work);
            let report = report?;
            lock::save(&lock_path, &lock)?;
            let markdown = report.markdown();
            if let Some(path) = &args.summary {
                std::fs::write(path, &markdown).map_err(|e| BotError::io(path, e))?;
            }
            print!("{markdown}");
            let attention = report.needs_attention();
            println!("attention: {attention}");
            if let Ok(output) = std::env::var("GITHUB_OUTPUT") {
                use std::io::Write;
                let path = PathBuf::from(output);
                std::fs::OpenOptions::new()
                    .append(true)
                    .open(&path)
                    .and_then(|mut f| writeln!(f, "attention={attention}"))
                    .map_err(|e| BotError::io(&path, e))?;
            }
            Ok(())
        }
        "build" => {
            let out = args
                .out
                .clone()
                .ok_or_else(|| BotError::Usage("build needs --out <site-dir>".into()))?;
            let lock = lock::load(&lock_path)?;
            let key = if args.unsigned {
                None
            } else {
                Some(signing_key()?)
            };
            let date = today();
            let built = build::assemble(&catalog, &lock, &args.base_url, &args.dir, &date);
            for id in &built.missing {
                eprintln!("warning: {id}: no release in lock.json yet, left out");
            }
            build::write_site(&built, &args.dir, &out, key.as_ref(), &date)?;
            println!(
                "{} apps → {} ({})",
                built.catalog.apps.len(),
                out.display(),
                match &key {
                    Some((_, id)) => format!("signed by {id}"),
                    None => "unsigned".to_owned(),
                }
            );
            Ok(())
        }
        other => Err(BotError::Usage(format!("unknown command {other}"))),
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let parsed = match parse(&args) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("{e}");
            return ExitCode::from(2);
        }
    };
    match run(parsed).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
