//! `lock.json`: what the bot found for every app — the release it picked, the file, its hash,
//! size, signer and scan verdict, and the repository facts. The bot writes it and commits it;
//! the history of this file is the catalog's audit log. Stable order (by app id) keeps diffs
//! small.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use paparats_core::IsoDate;
use serde::{Deserialize, Serialize};

use crate::BotError;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lock {
    pub generated: IsoDate,
    pub apps: BTreeMap<String, LockedApp>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LockedApp {
    pub release: Release,
    pub file: ReleaseFile,
    pub repo: RepoFacts,
    /// Set when the bot found something newer but held it back (signer changed, scan hit, …):
    /// the catalog keeps the release above until a person decides.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub held: Option<String>,
    /// A newer release that passed every check and waits out the quarantine; the catalog keeps
    /// shipping the release above until it is promoted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending: Option<Pending>,
    /// Last time the bot looked.
    pub checked: IsoDate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pending {
    pub release: Release,
    pub file: ReleaseFile,
    /// When the bot first accepted it (RFC 3339, UTC).
    pub since: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub tag: String,
    pub version: String,
    pub prerelease: bool,
    pub published: IsoDate,
    /// The release notes as plain text lines (no HTML, no Markdown markup), shortened.
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseFile {
    pub name: String,
    pub url: String,
    pub size: u64,
    pub sha256: String,
    /// GitHub's own `digest` for the asset agreed with our hash (absent on old releases).
    pub digest_checked: bool,
    /// Authenticode signer's common name; `None` = unsigned or not applicable (ZIP, MSIX).
    pub signer: Option<String>,
    /// An EXE/MSI without an Authenticode signature.
    pub unsigned: bool,
    /// `clean`, `skipped` (no scanner on this machine) or what the scanner reported.
    pub scan: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoFacts {
    pub stars: u32,
    pub license: Option<String>,
    pub created: IsoDate,
    pub homepage: Option<String>,
    pub funding: Vec<String>,
    pub archived: bool,
}

pub fn load(path: &Path) -> Result<Lock, BotError> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|e| BotError::Spec(format!("{}: {e}", path.display()))),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Lock::default()),
        Err(e) => Err(BotError::io(path, e)),
    }
}

pub fn save(path: &Path, lock: &Lock) -> Result<(), BotError> {
    let mut json = serde_json::to_string_pretty(lock)
        .map_err(|e| BotError::Spec(format!("lock.json: {e}")))?;
    json.push('\n');
    fs::write(path, json).map_err(|e| BotError::io(path, e))
}
