//! `catalog-bot resolve`: finds each app's release on GitHub and records it in `lock.json`.
//!
//! For every app: the repository's facts, the release (latest stable unless the app file says
//! otherwise) and its file by the app's pattern. A file that is new since the lock is downloaded,
//! hashed, compared with GitHub's own digest, signature-checked (EXE/MSI) and scanned. A
//! newer release is held back instead of shipped when the signer changed, the file is unsigned
//! without the app file saying `signer = "none"`, the signature is broken, the digest disagrees
//! or the scanner objects; the lock keeps the release it had and notes why.
//!
//! A newer release that passes waits out a quarantine (48 hours by default) as `pending` before
//! it replaces the shipped one: compromised releases are usually noticed and pulled within
//! hours. An app new to the catalog ships at once — a person has just reviewed it.

use std::collections::BTreeSet;
use std::path::Path;

use chrono::{DateTime, Utc};
use regex::Regex;

use crate::github::{Asset, GitHub, ReleaseInfo};
use crate::lock::{Lock, LockedApp, Pending, Release, ReleaseFile, RepoFacts};
use crate::scan::{self, Signature};
use crate::spec::{AppSpec, Catalog, Strategy};
use crate::text;
use crate::{BotError, today};

/// A Rising project without a release for this long should leave the shelf (the bot says so).
const STALE_RISING_DAYS: i64 = 120;

/// What happened to one app.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    Unchanged,
    Added(String),
    Updated {
        from: String,
        to: String,
    },
    /// A newer release passed the checks and waits out the quarantine.
    Quarantined {
        version: String,
        hours_left: i64,
    },
    Held(String),
    Failed(String),
}

pub struct Report {
    pub lines: Vec<(String, Outcome)>,
    /// Things a person should look at that stop nothing (stale or archived projects).
    pub warnings: Vec<String>,
}

impl Report {
    /// Something needs a person: a release held back, an app that failed, a warning.
    pub fn needs_attention(&self) -> bool {
        !self.warnings.is_empty()
            || self
                .lines
                .iter()
                .any(|(_, o)| matches!(o, Outcome::Held(_) | Outcome::Failed(_)))
    }

    /// Markdown for the commit's summary and the bot's issue.
    pub fn markdown(&self) -> String {
        let mut out = String::new();
        for (id, outcome) in &self.lines {
            let line = match outcome {
                Outcome::Unchanged => continue,
                Outcome::Added(v) => format!("- **{id}**: added, {v}"),
                Outcome::Updated { from, to } => format!("- **{id}**: {from} → {to}"),
                Outcome::Quarantined {
                    version,
                    hours_left,
                } => format!("- **{id}**: {version} in quarantine, {hours_left} h left"),
                Outcome::Held(why) => format!("- **{id}**: held back — {why}"),
                Outcome::Failed(why) => format!("- **{id}**: failed — {why}"),
            };
            out.push_str(&line);
            out.push('\n');
        }
        for warning in &self.warnings {
            out.push_str(&format!("- ⚠ {warning}\n"));
        }
        if out.is_empty() {
            out.push_str("Nothing changed.\n");
        }
        out
    }
}

fn signer_policy(app: &AppSpec) -> &str {
    app.install.signer.trim()
}

fn checks_signature(app: &AppSpec) -> bool {
    matches!(
        app.install.strategy,
        Strategy::Msi | Strategy::ExeSilent | Strategy::PortableExe
    )
}

async fn repo_facts(github: &GitHub, app: &AppSpec) -> Result<RepoFacts, BotError> {
    let info = github.repo(&app.source.repo).await?;
    let funding = match github.funding_file(&app.source.repo).await? {
        Some(yaml) => text::funding_links(&yaml),
        None => Vec::new(),
    };
    Ok(RepoFacts {
        stars: info.stargazers_count,
        license: info
            .license
            .and_then(|l| l.spdx_id)
            .filter(|id| id != "NOASSERTION"),
        created: info.created_at.chars().take(10).collect(),
        homepage: info.homepage.filter(|h| h.starts_with("https://")),
        funding,
        archived: info.archived,
    })
}

/// Downloads and checks the file; `Err` is a reason to hold it back.
async fn check_file(
    github: &GitHub,
    app: &AppSpec,
    previous: Option<&LockedApp>,
    asset: &Asset,
    work: &Path,
) -> Result<Result<ReleaseFile, String>, BotError> {
    let path = work.join(&asset.name);
    let (size, sha256) = github.download(&asset.browser_download_url, &path).await?;
    if size != asset.size {
        return Ok(Err(format!(
            "downloaded {size} bytes, GitHub lists {}",
            asset.size
        )));
    }
    let mut digest_checked = false;
    if let Some(digest) = asset
        .digest
        .as_deref()
        .and_then(|d| d.strip_prefix("sha256:"))
    {
        if !digest.eq_ignore_ascii_case(&sha256) {
            return Ok(Err(format!(
                "GitHub's digest {digest} disagrees with the downloaded file's {sha256}"
            )));
        }
        digest_checked = true;
    }
    let (signer, unsigned) = if checks_signature(app) {
        match scan::signature(&path) {
            Signature::Signed(cn) => {
                let policy = signer_policy(app);
                let pinned = match policy {
                    "auto" => previous.and_then(|p| p.file.signer.clone()),
                    "none" => None,
                    explicit => Some(explicit.to_owned()),
                };
                if let Some(expected) = pinned
                    && !expected.eq_ignore_ascii_case(&cn)
                {
                    return Ok(Err(format!("signer changed: {expected} → {cn}")));
                }
                (Some(cn), false)
            }
            Signature::Unsigned if signer_policy(app) == "none" => (None, true),
            Signature::Unsigned => {
                return Ok(Err(
                    "the file is unsigned; set install.signer = \"none\" if the author signs nothing"
                        .to_owned(),
                ));
            }
            Signature::Broken(why) => return Ok(Err(format!("broken signature: {why}"))),
            // Off Windows the signature cannot be checked: keep what the lock knew.
            Signature::NotApplicable => (
                previous.and_then(|p| p.file.signer.clone()),
                previous.is_some_and(|p| p.file.unsigned),
            ),
        }
    } else {
        (None, false)
    };
    let scan = scan::antivirus(&path).await;
    if scan.starts_with("threat") {
        return Ok(Err(format!("Defender: {scan}")));
    }
    let _ = tokio::fs::remove_file(&path).await;
    Ok(Ok(ReleaseFile {
        name: asset.name.clone(),
        url: asset.browser_download_url.clone(),
        size,
        sha256,
        digest_checked,
        signer,
        unsigned,
        scan,
    }))
}

fn release_of(info: &ReleaseInfo) -> Release {
    Release {
        tag: info.tag_name.clone(),
        version: text::version_from_tag(&info.tag_name),
        prerelease: info.prerelease,
        published: info.date(),
        notes: text::notes_lines(info.body.as_deref().unwrap_or_default(), 8),
    }
}

/// The file `release` + `file` describe, by tag, name and (when GitHub has one) digest.
fn same_file(release: &Release, file: &ReleaseFile, tag: &str, asset: &Asset) -> bool {
    release.tag == tag
        && file.name == asset.name
        && asset
            .digest
            .as_deref()
            .and_then(|d| d.strip_prefix("sha256:"))
            .is_none_or(|d| d.eq_ignore_ascii_case(&file.sha256))
}

/// Hours of quarantine left for something accepted at `since` (0 = over).
fn hours_left(since: &str, now: DateTime<Utc>, quarantine_hours: i64) -> i64 {
    let Ok(since) = DateTime::parse_from_rfc3339(since) else {
        return 0;
    };
    let waited = now.signed_duration_since(since.with_timezone(&Utc));
    (quarantine_hours - waited.num_hours()).max(0)
}

struct Context<'a> {
    github: &'a GitHub,
    work: &'a Path,
    date: String,
    now: DateTime<Utc>,
    quarantine_hours: i64,
}

async fn resolve_app(
    cx: &Context<'_>,
    app: &AppSpec,
    lock: &mut Lock,
    warnings: &mut Vec<String>,
) -> Result<Outcome, BotError> {
    let facts = repo_facts(cx.github, app).await?;
    if facts.archived {
        warnings.push(format!("{}: the repository is archived", app.id));
    }
    let info = cx.github.release(&app.source).await?;
    let pattern = Regex::new(&app.source.asset).map_err(BotError::regex)?;
    let Some(asset) = info.assets.iter().find(|a| pattern.is_match(&a.name)) else {
        if let Some(prev) = lock.apps.get_mut(&app.id) {
            prev.repo = facts;
            prev.checked = cx.date.clone();
        }
        return Ok(Outcome::Failed(format!(
            "no file in {} matches {}",
            info.tag_name, app.source.asset
        )));
    };
    let release = release_of(&info);
    if app.rising.is_some()
        && let Ok(published) = paparats_core::dates::parse(&release.published)
        && (cx.now.date_naive() - published).num_days() > STALE_RISING_DAYS
    {
        warnings.push(format!(
            "{}: no release since {}; time to take it off the Rising shelf?",
            app.id, release.published
        ));
    }

    let Some(mut prev) = lock.apps.get(&app.id).cloned() else {
        // New to the catalog: a person has just reviewed it, so it ships without quarantine.
        return match check_file(cx.github, app, None, asset, cx.work).await? {
            Ok(file) => {
                let version = release.version.clone();
                lock.apps.insert(
                    app.id.clone(),
                    LockedApp {
                        release,
                        file,
                        repo: facts,
                        held: None,
                        pending: None,
                        checked: cx.date.clone(),
                    },
                );
                Ok(Outcome::Added(version))
            }
            Err(why) => Ok(Outcome::Held(format!(
                "{} held back: {why}",
                release.version
            ))),
        };
    };
    prev.repo = facts;
    prev.checked = cx.date.clone();

    // Still the shipped file (a pending release the author withdrew is dropped).
    if same_file(&prev.release, &prev.file, &release.tag, asset) {
        prev.held = None;
        prev.pending = None;
        lock.apps.insert(app.id.clone(), prev);
        return Ok(Outcome::Unchanged);
    }

    // Already accepted and waiting: promoted when the quarantine is over. A pending release
    // that is no longer the latest is dropped; the newer one starts its own quarantine below.
    if let Some(pending) = prev.pending.take()
        && same_file(&pending.release, &pending.file, &release.tag, asset)
    {
        let left = hours_left(&pending.since, cx.now, cx.quarantine_hours);
        let outcome = if left == 0 {
            let from = prev.release.version.clone();
            prev.release = pending.release;
            prev.file = pending.file;
            Outcome::Updated {
                from,
                to: release.version,
            }
        } else {
            prev.pending = Some(pending);
            Outcome::Quarantined {
                version: release.version,
                hours_left: left,
            }
        };
        prev.held = None;
        lock.apps.insert(app.id.clone(), prev);
        return Ok(outcome);
    }

    let outcome = match check_file(cx.github, app, Some(&prev), asset, cx.work).await? {
        Ok(file) if cx.quarantine_hours <= 0 => {
            let from = prev.release.version.clone();
            prev.release = release;
            prev.file = file;
            prev.held = None;
            Outcome::Updated {
                from,
                to: prev.release.version.clone(),
            }
        }
        Ok(file) => {
            let version = release.version.clone();
            prev.pending = Some(Pending {
                release,
                file,
                since: cx.now.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            });
            prev.held = None;
            Outcome::Quarantined {
                version,
                hours_left: cx.quarantine_hours,
            }
        }
        Err(why) => {
            let held = format!("{} held back: {why}", release.version);
            prev.held = Some(held.clone());
            Outcome::Held(held)
        }
    };
    lock.apps.insert(app.id.clone(), prev);
    Ok(outcome)
}

/// Resolves every app (or the `only` ones), updating `lock` in place.
pub async fn run(
    catalog: &Catalog,
    lock: &mut Lock,
    github: &GitHub,
    only: &BTreeSet<String>,
    work: &Path,
    quarantine_hours: i64,
) -> Result<Report, BotError> {
    let cx = Context {
        github,
        work,
        date: today(),
        now: Utc::now(),
        quarantine_hours,
    };
    let mut lines = Vec::new();
    let mut warnings = Vec::new();
    let known: BTreeSet<&str> = catalog.apps.iter().map(|a| a.id.as_str()).collect();
    for app in &catalog.apps {
        if !only.is_empty() && !only.contains(&app.id) {
            continue;
        }
        let outcome = match resolve_app(&cx, app, lock, &mut warnings).await {
            Ok(outcome) => outcome,
            Err(e) => Outcome::Failed(e.to_string()),
        };
        eprintln!("{}: {outcome:?}", app.id);
        lines.push((app.id.clone(), outcome));
    }
    // Apps removed from the repository leave the lock too.
    if only.is_empty() {
        lock.apps.retain(|id, _| known.contains(id.as_str()));
    }
    lock.generated = cx.date;
    Ok(Report { lines, warnings })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_default()
    }

    #[test]
    fn quarantine_counts_down_in_whole_hours() {
        let now = at("2026-11-03T12:00:00Z");
        assert_eq!(hours_left("2026-11-03T12:00:00Z", now, 48), 48);
        assert_eq!(hours_left("2026-11-02T11:30:00Z", now, 48), 24);
        assert_eq!(hours_left("2026-11-01T12:00:00Z", now, 48), 0);
        assert_eq!(hours_left("2026-10-01T00:00:00Z", now, 48), 0);
        // An unreadable date never blocks a release forever.
        assert_eq!(hours_left("yesterday", now, 48), 0);
    }

    #[test]
    fn report_flags_what_needs_a_person() {
        let quiet = Report {
            lines: vec![
                ("a".into(), Outcome::Unchanged),
                (
                    "b".into(),
                    Outcome::Quarantined {
                        version: "2.0".into(),
                        hours_left: 30,
                    },
                ),
            ],
            warnings: Vec::new(),
        };
        assert!(!quiet.needs_attention());
        assert!(
            quiet
                .markdown()
                .contains("**b**: 2.0 in quarantine, 30 h left")
        );
        let loud = Report {
            lines: vec![(
                "c".into(),
                Outcome::Held("1.1 held back: signer changed".into()),
            )],
            warnings: vec!["d: the repository is archived".into()],
        };
        assert!(loud.needs_attention());
        assert!(loud.markdown().contains("⚠ d: the repository is archived"));
    }
}
