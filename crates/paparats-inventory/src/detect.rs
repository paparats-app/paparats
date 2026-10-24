//! Catalog apps' [`AppDetection`] rules, compiled once and matched against Uninstall entries and
//! MSIX packages.

use paparats_core::{App, AppDetection, AppId};
use regex::{Regex, RegexBuilder};

use crate::source::MsixPackage;
use crate::uninstall::{UninstallEntry, strip_architecture};

/// A `displayNameRegex` that does not compile. The app keeps its other matchers.
#[derive(Debug, thiserror::Error)]
#[error("detection rule of {app_id}: {source}")]
pub struct RuleError {
    pub app_id: AppId,
    #[source]
    pub source: regex::Error,
}

/// How an entry matched its app; stronger wins when several apps claim one entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum MatchKind {
    DisplayNameRegex,
    DisplayName,
    ProductCode,
    MsixFamily,
    /// A version folder under Paparats' portable apps folder (`<apps>\<app-id>\<version>`).
    PortableFolder,
}

#[derive(Debug, Clone)]
struct Rule {
    app_id: AppId,
    catalog_version: String,
    /// The catalog name, for shortcut evidence.
    app_name: String,
    /// Display names, lower-case.
    names: Vec<String>,
    regex: Option<Regex>,
    publisher: Option<String>,
    product_codes: Vec<String>,
    families: Vec<String>,
}

impl Rule {
    fn compile(app: &App, detection: &AppDetection) -> (Self, Option<RuleError>) {
        let (regex, error) = match detection.display_name_regex.as_deref() {
            None => (None, None),
            Some(pattern) => match RegexBuilder::new(&format!("^(?:{pattern})$"))
                .case_insensitive(true)
                // Rules come from signed manifests, but a pathological one must not balloon.
                .size_limit(1 << 20)
                .build()
            {
                Ok(r) => (Some(r), None),
                Err(source) => (
                    None,
                    Some(RuleError {
                        app_id: app.id.clone(),
                        source,
                    }),
                ),
            },
        };
        let lower = |v: &[String]| -> Vec<String> {
            v.iter()
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty())
                .collect()
        };
        let rule = Self {
            app_id: app.id.clone(),
            catalog_version: app.version.clone(),
            app_name: app.name.clone(),
            names: lower(&detection.display_names),
            regex,
            publisher: detection
                .publisher
                .as_deref()
                .map(|p| p.trim().to_lowercase())
                .filter(|p| !p.is_empty()),
            product_codes: lower(&detection.product_codes),
            families: lower(&detection.msix_family_names),
        };
        (rule, error)
    }

    fn match_entry(&self, entry: &Entry<'_>) -> Option<MatchKind> {
        if self.product_codes.contains(&entry.key) {
            return Some(MatchKind::ProductCode);
        }
        let publisher_ok = match (&self.publisher, &entry.publisher) {
            (None, _) => true,
            (Some(want), Some(have)) => have.contains(want.as_str()),
            (Some(_), None) => false,
        };
        if !publisher_ok {
            return None;
        }
        if self
            .names
            .iter()
            .any(|n| *n == entry.name || *n == entry.arch_free || *n == entry.base)
        {
            return Some(MatchKind::DisplayName);
        }
        self.regex
            .as_ref()
            .filter(|r| r.is_match(entry.raw_name))
            .map(|_| MatchKind::DisplayNameRegex)
    }
}

/// An Uninstall entry's matchable fields, lower-cased once: the name as written, without
/// architecture tags, and without versions and architecture tags.
struct Entry<'a> {
    key: String,
    name: String,
    arch_free: String,
    base: String,
    raw_name: &'a str,
    publisher: Option<String>,
}

/// A catalog app found on this PC.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hit<'r> {
    /// Position of the app in the catalog (rules keep catalog order).
    pub index: usize,
    pub app_id: &'r str,
    pub catalog_version: &'r str,
    pub kind: MatchKind,
}

/// The detection rules of the catalog, in catalog order.
#[derive(Debug, Clone, Default)]
pub struct DetectionRules {
    rules: Vec<Rule>,
}

impl DetectionRules {
    /// Compiles one rule per catalog app. An app without `detection` matches no Uninstall entry
    /// or package; it is only found in Paparats' own portable apps folder.
    pub fn compile(apps: &[App]) -> (Self, Vec<RuleError>) {
        let none = AppDetection::default();
        let mut errors = Vec::new();
        let rules = apps
            .iter()
            .map(|app| {
                let (rule, error) = Rule::compile(app, app.detection.as_ref().unwrap_or(&none));
                errors.extend(error);
                rule
            })
            .collect();
        (Self { rules }, errors)
    }

    /// The position of `app_id` in the catalog.
    pub fn index_of(&self, app_id: &str) -> Option<usize> {
        self.rules.iter().position(|r| r.app_id == app_id)
    }

    /// The catalog name of the app at `index`.
    pub fn app_name(&self, index: usize) -> Option<&str> {
        self.rules.get(index).map(|r| r.app_name.as_str())
    }

    pub fn len(&self) -> usize {
        self.rules.len()
    }

    pub fn is_empty(&self) -> bool {
        self.rules.is_empty()
    }

    /// App ids and catalog versions, in catalog order.
    pub fn apps(&self) -> impl Iterator<Item = (&str, &str)> {
        self.rules
            .iter()
            .map(|r| (r.app_id.as_str(), r.catalog_version.as_str()))
    }

    /// A hit on the app at `index` (the portable folder scan).
    pub fn hit(&self, index: usize, kind: MatchKind) -> Option<Hit<'_>> {
        let rule = self.rules.get(index)?;
        Some(Hit {
            index,
            app_id: &rule.app_id,
            catalog_version: &rule.catalog_version,
            kind,
        })
    }

    /// The app an Uninstall entry belongs to: the strongest match (key name > display name >
    /// regex), the first app in catalog order on a tie.
    pub fn match_entry(&self, entry: &UninstallEntry) -> Option<Hit<'_>> {
        let e = Entry {
            key: entry.key.to_lowercase(),
            name: entry.display_name.to_lowercase(),
            arch_free: strip_architecture(&entry.display_name).to_lowercase(),
            base: entry.base_name.to_lowercase(),
            raw_name: &entry.display_name,
            publisher: entry.publisher.as_deref().map(str::to_lowercase),
        };
        let mut best: Option<(usize, MatchKind)> = None;
        for (i, rule) in self.rules.iter().enumerate() {
            if let Some(kind) = rule.match_entry(&e)
                && best.is_none_or(|(_, k)| kind > k)
            {
                best = Some((i, kind));
            }
        }
        best.and_then(|(i, kind)| self.hit(i, kind))
    }

    /// The app an MSIX package belongs to (by family name).
    pub fn match_package(&self, package: &MsixPackage) -> Option<Hit<'_>> {
        let family = package.family_name.to_lowercase();
        let index = self
            .rules
            .iter()
            .position(|r| r.families.contains(&family))?;
        self.hit(index, MatchKind::MsixFamily)
    }
}

#[cfg(test)]
mod tests {
    use paparats_core::Catalog;

    use super::*;
    use crate::source::{RegKeyData, RegRoot};

    fn catalog() -> Catalog {
        let text = include_str!("../../../fixtures/catalog.json");
        serde_json::from_str(text).unwrap()
    }

    fn app(id: &str, detection: AppDetection) -> App {
        let mut app = catalog().apps.remove(0);
        app.id = id.into();
        app.version = "1.0".into();
        app.detection = Some(detection);
        app
    }

    fn entry(key: &str, name: &str, publisher: Option<&str>) -> UninstallEntry {
        let mut k = RegKeyData::new(key).with_str("DisplayName", name);
        if let Some(p) = publisher {
            k = k.with_str("Publisher", p);
        }
        UninstallEntry::parse(RegRoot::LocalMachine, &k).unwrap()
    }

    fn hit_id(rules: &DetectionRules, e: &UninstallEntry) -> Option<(String, MatchKind)> {
        rules.match_entry(e).map(|h| (h.app_id.to_owned(), h.kind))
    }

    #[test]
    fn every_fixture_app_has_rules_that_compile() {
        let apps = catalog().apps;
        assert_eq!(apps.len(), 32);
        for app in &apps {
            let d = app.detection.as_ref();
            assert!(
                d.is_some_and(|d| !d.display_names.is_empty() || d.display_name_regex.is_some()),
                "{} needs detection rules",
                app.id
            );
        }
        let (rules, errors) = DetectionRules::compile(&apps);
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(rules.len(), 32);
        assert_eq!(rules.apps().next(), Some(("obsidian", "1.8.10")));
        assert_eq!(rules.index_of("sevenzip"), Some(12));
        assert_eq!(rules.app_name(12), Some("7-Zip"));
        assert_eq!(rules.index_of("nope"), None);
    }

    #[test]
    fn fixture_rules_recognise_real_world_names() {
        let (rules, _) = DetectionRules::compile(&catalog().apps);
        let cases = [
            (
                "7-Zip",
                "7-Zip 25.01 (x64)",
                Some("Igor Pavlov"),
                Some("sevenzip"),
            ),
            (
                "{23170F69-40C1-2702-2501-000001000000}",
                "7-Zip 25.01 (x64 edition)",
                None,
                Some("sevenzip"),
            ),
            (
                "Notepad++",
                "Notepad++ (64-bit x64)",
                Some("Notepad++ Team"),
                Some("notepadpp"),
            ),
            (
                "VLC media player",
                "VLC media player",
                Some("VideoLAN"),
                Some("vlc"),
            ),
            (
                "Everything",
                "Everything 1.4.1.1028 (x64)",
                Some("voidtools"),
                Some("everything"),
            ),
            ("x", "Everything", Some("Someone Else"), None),
            (
                "{771FD6B0-FA20-440A-A002-3B3BAC16DC50}_is1",
                "Microsoft Visual Studio Code (User)",
                Some("Microsoft Corporation"),
                Some("vscode"),
            ),
            (
                "y",
                "Microsoft Visual Studio Code",
                Some("Microsoft Corporation"),
                Some("vscode"),
            ),
            (
                "z",
                "Microsoft Visual Studio Code - Insiders",
                Some("Microsoft Corporation"),
                None,
            ),
            (
                "{GUID}",
                "PowerToys (Preview) x64",
                Some("Microsoft Corporation"),
                Some("powertoys"),
            ),
            ("{GUID}", "PowerToys (Preview)", Some("Someone Else"), None),
            (
                "Obsidian",
                "Obsidian 1.8.9",
                Some("Obsidian"),
                Some("obsidian"),
            ),
            (
                "LocalSend_is1",
                "LocalSend version 1.17.0",
                None,
                Some("localsend"),
            ),
            (
                "Krita_x64",
                "Krita (x64) 5.2.9",
                Some("Krita Foundation"),
                Some("krita"),
            ),
            ("Steam App 1127400", "Mindustry", None, Some("mindustry")),
            ("n", "Kvetka Shell", Some("Kvetka"), Some("shell")),
            ("s", "Слоўнік", None, Some("slounik")),
            ("f", "Files", None, None),
            ("g", "Git", Some("The Git Development Community"), None),
        ];
        for (key, name, publisher, want) in cases {
            let got = rules
                .match_entry(&entry(key, name, publisher))
                .map(|h| h.app_id);
            assert_eq!(got, want, "{key} / {name}");
        }
    }

    #[test]
    fn strongest_match_wins() {
        let by_name = app(
            "by-name",
            AppDetection {
                display_names: vec!["Tool".into()],
                ..AppDetection::default()
            },
        );
        let by_regex = app(
            "by-regex",
            AppDetection {
                display_name_regex: Some("tool.*".into()),
                ..AppDetection::default()
            },
        );
        let by_code = app(
            "by-code",
            AppDetection {
                product_codes: vec!["{ABC}".into()],
                ..AppDetection::default()
            },
        );
        let (rules, _) = DetectionRules::compile(&[by_regex.clone(), by_name.clone(), by_code]);
        let e = entry("{abc}", "Tool", None);
        assert_eq!(
            hit_id(&rules, &e),
            Some(("by-code".into(), MatchKind::ProductCode))
        );
        let e = entry("other", "TOOL 2.0", None);
        assert_eq!(
            hit_id(&rules, &e),
            Some(("by-name".into(), MatchKind::DisplayName))
        );
        let e = entry("other", "Toolbox", None);
        assert_eq!(
            hit_id(&rules, &e),
            Some(("by-regex".into(), MatchKind::DisplayNameRegex))
        );

        let twin = app("twin", by_name.detection.clone().unwrap());
        let (rules, _) = DetectionRules::compile(&[by_name, twin]);
        assert_eq!(
            hit_id(&rules, &entry("k", "Tool", None)).map(|h| h.0),
            Some("by-name".into()),
            "catalog order breaks ties"
        );
    }

    #[test]
    fn regex_is_anchored_and_bad_regex_is_reported() {
        let anchored = app(
            "a",
            AppDetection {
                display_name_regex: Some("Tool|Kit".into()),
                ..AppDetection::default()
            },
        );
        let broken = app(
            "b",
            AppDetection {
                display_names: vec!["Broken".into()],
                display_name_regex: Some("(unclosed".into()),
                ..AppDetection::default()
            },
        );
        let (rules, errors) = DetectionRules::compile(&[anchored, broken]);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].app_id, "b");
        assert_eq!(rules.len(), 2, "the broken app keeps its other matchers");
        assert!(rules.match_entry(&entry("k", "Kit", None)).is_some());
        assert!(rules.match_entry(&entry("k", "Toolkit", None)).is_none());
        assert_eq!(
            rules
                .match_entry(&entry("k", "Broken 1.0", None))
                .map(|h| h.app_id),
            Some("b")
        );
    }

    #[test]
    fn names_with_numbers_survive_architecture_tags() {
        let a = app(
            "heroes",
            AppDetection {
                display_names: vec!["Heroes 3".into()],
                ..AppDetection::default()
            },
        );
        let (rules, _) = DetectionRules::compile(&[a]);
        assert!(rules.match_entry(&entry("k", "Heroes 3", None)).is_some());
        assert!(
            rules
                .match_entry(&entry("k", "Heroes 3 (x64)", None))
                .is_some()
        );
        assert!(rules.match_entry(&entry("k", "Heroes 2", None)).is_none());
    }

    #[test]
    fn apps_without_detection_match_nothing() {
        let mut bare = app("bare", AppDetection::default());
        bare.detection = None;
        bare.name = "Tool".into();
        let (rules, errors) = DetectionRules::compile(&[bare]);
        assert!(errors.is_empty());
        assert_eq!(rules.len(), 1, "still a catalog app (portable folder)");
        assert!(rules.match_entry(&entry("Tool", "Tool", None)).is_none());
    }

    #[test]
    fn msix_packages_match_by_family() {
        let (rules, _) = DetectionRules::compile(&catalog().apps);
        let package = MsixPackage {
            name: "8bitSolutionsLLC.bitwardendesktop".into(),
            family_name: "8bitSolutionsLLC.BitwardenDesktop_h4e712dmw3xyy".into(),
            version: "2026.8.1.0".into(),
            install_location: None,
            installed: None,
        };
        let hit = rules.match_package(&package).unwrap();
        assert_eq!((hit.app_id, hit.kind), ("bitwarden", MatchKind::MsixFamily));
        let other = MsixPackage {
            family_name: "Microsoft.WindowsTerminal_8wekyb3d8bbwe".into(),
            ..package
        };
        assert!(rules.match_package(&other).is_none());
    }
}
