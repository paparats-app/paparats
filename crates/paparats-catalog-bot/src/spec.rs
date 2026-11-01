//! The hand-edited side of the catalog repository: one `apps/<id>.toml` per app and one
//! `editorial.toml`. Everything here is what people decide; versions, files, hashes and signers
//! come from the bot ([`crate::lock`]).

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use paparats_core::{AppDetection, CategoryId, HeroTarget, Localized};
use regex::Regex;
use serde::Deserialize;

use crate::BotError;

/// `apps/<id>.toml`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppSpec {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub category: CategoryId,
    /// Monogram tile colour `#rrggbb`, shown until (or instead of) the icon.
    #[serde(default)]
    pub tint: Option<String>,
    /// Two letters for the monogram tile; default: the name's initials.
    #[serde(default)]
    pub mono: Option<String>,
    /// SPDX id or a short phrase; default: the repository's license from GitHub.
    #[serde(default)]
    pub license: Option<String>,
    pub source: SourceSpec,
    pub install: InstallSpec,
    /// How the inventory recognises the app; required for everything but portable apps.
    #[serde(default)]
    pub detection: Option<DetectionSpec>,
    pub text: Localized<AppText>,
    /// On the "Rising" shelf (young projects), with the editors' note.
    #[serde(default)]
    pub rising: Option<RisingSpec>,
    /// Made by the owner of Paparats: the app page says so.
    #[serde(default)]
    pub by_paparats_author: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceSpec {
    /// `owner/name` on GitHub.
    pub repo: String,
    /// Regular expression the release file's name must match.
    pub asset: String,
    /// Only releases whose tag starts with this (monorepos).
    #[serde(default)]
    pub tag_prefix: Option<String>,
    /// Accept pre-releases (projects that publish nothing else).
    #[serde(default)]
    pub prerelease: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Strategy {
    Msi,
    ExeSilent,
    Msix,
    PortableZip,
    PortableExe,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Scope {
    /// Installs for the current user, no administrator rights.
    #[default]
    User,
    /// Installs for all users: the installer elevates.
    Machine,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstallSpec {
    pub strategy: Strategy,
    /// Silent arguments, verbatim (`exeSilent` only).
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub scope: Scope,
    /// The program to start: the file a portable package copies or links, a hint for "Open".
    #[serde(default)]
    pub launch: Option<String>,
    /// `auto` (pin the signer seen first), `none` (the author signs nothing) or a signer's
    /// common name. Ignored for ZIP and MSIX.
    #[serde(default = "auto")]
    pub signer: String,
}

fn auto() -> String {
    "auto".to_owned()
}

/// [`AppDetection`] with every matcher optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DetectionSpec {
    #[serde(default)]
    pub display_names: Vec<String>,
    #[serde(default)]
    pub display_name_regex: Option<String>,
    #[serde(default)]
    pub publisher: Option<String>,
    #[serde(default)]
    pub product_codes: Vec<String>,
    #[serde(default)]
    pub msix_family_names: Vec<String>,
}

impl DetectionSpec {
    pub fn to_detection(&self) -> AppDetection {
        AppDetection {
            display_names: self.display_names.clone(),
            display_name_regex: self.display_name_regex.clone(),
            publisher: self.publisher.clone(),
            product_codes: self.product_codes.clone(),
            msix_family_names: self.msix_family_names.clone(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AppText {
    pub tagline: String,
    pub long: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RisingSpec {
    /// Why the editors picked it (one or two sentences), shown on Browse's big banner.
    pub note: Localized<String>,
}

/// `editorial.toml`: what Home and Browse feature.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EditorialSpec {
    #[serde(default)]
    pub featured: Vec<String>,
    #[serde(default)]
    pub notable: Vec<String>,
    #[serde(default)]
    pub hero_slides: Vec<HeroSlideSpec>,
    #[serde(default)]
    pub browse_heroes: Vec<BrowseHeroSpec>,
    #[serde(default)]
    pub collections: Vec<CollectionSpec>,
    pub generic_notes: Localized<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HeroSlideSpec {
    pub kicker: Localized<String>,
    pub title1: Localized<String>,
    pub title2: Localized<String>,
    pub body: Localized<String>,
    pub cta: Localized<String>,
    pub quote: Localized<String>,
    pub target: HeroTarget,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseHeroSpec {
    pub app_id: String,
    pub title1: Localized<String>,
    pub title2: Localized<String>,
    pub body: Localized<String>,
    /// Empty: the app's rising note.
    #[serde(default)]
    pub note: Option<Localized<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CollectionSpec {
    pub id: String,
    pub icon: String,
    pub title: Localized<String>,
    pub sub: Localized<String>,
    /// Empty for `rising`: every app with a `[rising]` table, in file order.
    #[serde(default)]
    pub apps: Vec<String>,
}

/// The catalog repository: every app and the editorial file.
#[derive(Debug, Clone)]
pub struct Catalog {
    pub apps: Vec<AppSpec>,
    pub editorial: EditorialSpec,
}

fn read(path: &Path) -> Result<String, BotError> {
    fs::read_to_string(path).map_err(|e| BotError::io(path, e))
}

/// Loads `apps/*.toml` (sorted by file name) and `editorial.toml`, then validates them.
pub fn load(root: &Path) -> Result<Catalog, BotError> {
    let dir = root.join("apps");
    let mut files: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| BotError::io(&dir, e))?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "toml"))
        .collect();
    files.sort();
    let mut apps = Vec::with_capacity(files.len());
    for path in &files {
        let app: AppSpec = toml::from_str(&read(path)?)
            .map_err(|e| BotError::Spec(format!("{}: {e}", path.display())))?;
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        if stem != app.id {
            return Err(BotError::Spec(format!(
                "{}: the file must be named after its id ({}.toml)",
                path.display(),
                app.id
            )));
        }
        apps.push(app);
    }
    let path = root.join("editorial.toml");
    let editorial: EditorialSpec = toml::from_str(&read(&path)?)
        .map_err(|e| BotError::Spec(format!("{}: {e}", path.display())))?;
    let catalog = Catalog { apps, editorial };
    validate(&catalog, root)?;
    Ok(catalog)
}

fn non_empty(text: &Localized<String>) -> bool {
    [&text.en, &text.be, &text.ru]
        .iter()
        .all(|t| !t.trim().is_empty())
}

/// Ids are unique lower-case slugs, regular expressions compile, every text exists in three
/// languages, installers have detection rules, the editorial file names only known apps.
pub fn validate(catalog: &Catalog, root: &Path) -> Result<(), BotError> {
    let slug = Regex::new(r"^[a-z0-9][a-z0-9-]{0,40}$").map_err(BotError::regex)?;
    let colour = Regex::new(r"^#[0-9a-fA-F]{6}$").map_err(BotError::regex)?;
    let mut problems = Vec::new();
    let mut ids = BTreeSet::new();
    for app in &catalog.apps {
        let id = &app.id;
        if !slug.is_match(id) {
            problems.push(format!("{id}: the id must be a lower-case slug"));
        }
        if !ids.insert(id.clone()) {
            problems.push(format!("{id}: duplicate id"));
        }
        if let Err(e) = Regex::new(&app.source.asset) {
            problems.push(format!("{id}: source.asset does not compile: {e}"));
        }
        if !app.source.repo.contains('/') || app.source.repo.split('/').count() != 2 {
            problems.push(format!("{id}: source.repo must be owner/name"));
        }
        let texts = [&app.text.en, &app.text.be, &app.text.ru];
        if texts
            .iter()
            .any(|t| t.tagline.trim().is_empty() || t.long.trim().is_empty())
        {
            problems.push(format!(
                "{id}: tagline and long are needed in en, be and ru"
            ));
        }
        let portable = matches!(
            app.install.strategy,
            Strategy::PortableZip | Strategy::PortableExe
        );
        if !portable && app.detection.is_none() {
            problems.push(format!("{id}: installers need [detection] rules"));
        }
        if app.install.strategy == Strategy::ExeSilent && app.install.args.is_empty() {
            problems.push(format!("{id}: exeSilent needs silent args"));
        }
        if let Some(detection) = &app.detection
            && let Some(rx) = &detection.display_name_regex
            && let Err(e) = Regex::new(rx)
        {
            problems.push(format!(
                "{id}: detection.displayNameRegex does not compile: {e}"
            ));
        }
        if let Some(rising) = &app.rising
            && !non_empty(&rising.note)
        {
            problems.push(format!("{id}: rising.note is needed in en, be and ru"));
        }
        if let Some(tint) = &app.tint
            && !colour.is_match(tint)
        {
            problems.push(format!("{id}: tint must be #rrggbb"));
        }
        if !root.join("icons").join(format!("{id}.png")).is_file() {
            // Not fatal: the tile falls back to the monogram.
            eprintln!("warning: {id}: no icons/{id}.png, the monogram tile is shown");
        }
    }
    let e = &catalog.editorial;
    for id in e.featured.iter().chain(&e.notable) {
        if !ids.contains(id) {
            problems.push(format!("editorial: unknown app {id}"));
        }
    }
    for hero in &e.browse_heroes {
        if !ids.contains(&hero.app_id) {
            problems.push(format!(
                "editorial: browse hero for unknown app {}",
                hero.app_id
            ));
        }
    }
    for c in &e.collections {
        for id in &c.apps {
            if !ids.contains(id) {
                problems.push(format!(
                    "editorial: collection {} names unknown app {id}",
                    c.id
                ));
            }
        }
    }
    if problems.is_empty() {
        Ok(())
    } else {
        Err(BotError::Spec(problems.join("\n")))
    }
}
