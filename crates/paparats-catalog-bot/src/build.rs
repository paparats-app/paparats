//! `catalog-bot build`: turns the app files and `lock.json` into the signed manifests the client
//! reads (`channels.json`, `catalog.json`, `platform.json`, `official.json`) plus the icons, in a
//! folder GitHub Pages serves as `<base-url>`.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use ed25519_dalek::SigningKey;
use paparats_catalog::{
    CatalogManifest, ChannelDirectory, ChannelEntry, ChannelManifest, PlatformManifest,
    sign_envelope,
};
use paparats_core::{
    AboutInfo, App, AppSource, BrowseHero, Catalog, Category, CategoryId, ChannelInfo, ChannelKind,
    Collection, Features, FileHost, HeroSlide, InstallStrategy, Localized, OFFICIAL_CHANNEL,
    Package, PlatformInfo, PlatformStats, TrustLevel, UpdateManifest,
};
use serde::Serialize;

use crate::BotError;
use crate::lock::{Lock, LockedApp};
use crate::spec::{self, AppSpec, Scope, Strategy};
use crate::text;

/// The nine store categories with the prototype's tile icons and photograph tints.
const CATEGORIES: [(CategoryId, &str, &str); 9] = [
    (CategoryId::Productivity, "laptop", "#2f7a58"),
    (CategoryId::Development, "code", "#2c5d8a"),
    (CategoryId::Design, "palette", "#8a3e78"),
    (CategoryId::Media, "play", "#a3562c"),
    (CategoryId::Utilities, "wrench", "#4f6070"),
    (CategoryId::System, "layout-grid", "#2f5f9a"),
    (CategoryId::Lifestyle, "leaf", "#3f7a4a"),
    (CategoryId::Games, "gamepad-2", "#7a4a2f"),
    (CategoryId::Education, "graduation-cap", "#5a5a9a"),
];

fn mib(bytes: u64) -> f64 {
    (bytes as f64 / 1_048_576.0 * 10.0).round() / 10.0
}

fn strategy(app: &AppSpec) -> InstallStrategy {
    match app.install.strategy {
        Strategy::Msi => InstallStrategy::Msi,
        Strategy::ExeSilent => InstallStrategy::ExeSilent {
            args: app.install.args.clone(),
        },
        Strategy::Msix => InstallStrategy::Msix,
        Strategy::PortableZip => InstallStrategy::PortableZip,
        Strategy::PortableExe => InstallStrategy::PortableExe,
    }
}

fn package(app: &AppSpec, locked: &LockedApp) -> Package {
    Package {
        app_id: app.id.clone(),
        version: locked.release.version.clone(),
        url: Some(locked.file.url.clone()),
        sha256: Some(locked.file.sha256.clone()),
        size_bytes: locked.file.size,
        strategy: strategy(app),
        // The signer the bot saw is pinned: a release signed by someone else will not install.
        signer: locked.file.signer.clone(),
        unsigned: locked.file.unsigned,
        machine_wide: app.install.scope == Scope::Machine,
        launch: app.install.launch.clone(),
    }
}

fn app_entry(app: &AppSpec, locked: &LockedApp, base_url: &str, root: &Path) -> App {
    // Only young projects carry the badge: mature apps on 0.x (PowerToys) are not "early".
    let early =
        app.rising.is_some() && text::is_early(&locked.release.version, locked.release.prerelease);
    let icon = root.join("icons").join(format!("{}.png", app.id));
    App {
        id: app.id.clone(),
        name: app.name.clone(),
        publisher: app.publisher.clone(),
        category: app.category,
        tint: app.tint.clone().unwrap_or_else(|| text::tint_for(&app.id)),
        mono: app
            .mono
            .clone()
            .unwrap_or_else(|| text::monogram(&app.name)),
        version: locked.release.version.clone(),
        size_mb: mib(locked.file.size),
        updated: locked.release.published.clone(),
        license: app
            .license
            .clone()
            .or_else(|| locked.repo.license.clone())
            .unwrap_or_else(|| "—".to_owned()),
        portable: matches!(
            app.install.strategy,
            Strategy::PortableZip | Strategy::PortableExe
        ),
        pro: false,
        pro_note: None,
        tagline: Localized {
            en: app.text.en.tagline.clone(),
            be: app.text.be.tagline.clone(),
            ru: app.text.ru.tagline.clone(),
        },
        long: Localized {
            en: app.text.en.long.trim().to_owned(),
            be: app.text.be.long.trim().to_owned(),
            ru: app.text.ru.long.trim().to_owned(),
        },
        channel: None,
        also_in: Vec::new(),
        icon_url: icon
            .is_file()
            .then(|| format!("{base_url}icons/{}.png", app.id)),
        detection: app
            .detection
            .as_ref()
            .map(spec::DetectionSpec::to_detection),
        source: Some(AppSource {
            repo: app.source.repo.clone(),
            stars: locked.repo.stars,
            since: locked.repo.created.clone(),
            homepage: locked.repo.homepage.clone(),
            funding: locked.repo.funding.clone(),
            early,
            unsigned: locked.file.unsigned,
            needs_admin: app.install.scope == Scope::Machine,
            by_paparats_author: app.by_paparats_author,
        }),
    }
}

/// Everything the four manifests carry, before signing.
pub struct Built {
    pub catalog: Catalog,
    pub directory: ChannelDirectory,
    pub platform: PlatformInfo,
    pub official: ChannelManifest,
    /// Apps in the repository that have no release in the lock yet (left out).
    pub missing: Vec<String>,
}

pub fn assemble(
    catalog: &spec::Catalog,
    lock: &Lock,
    base_url: &str,
    root: &Path,
    date: &str,
) -> Built {
    let mut apps = Vec::new();
    let mut updates = Vec::new();
    let mut packages = Vec::new();
    let mut missing = Vec::new();
    for app in &catalog.apps {
        let Some(locked) = lock.apps.get(&app.id) else {
            missing.push(app.id.clone());
            continue;
        };
        apps.push(app_entry(app, locked, base_url, root));
        let pkg = package(app, locked);
        let lines = if locked.release.notes.is_empty() {
            vec![format!("{} {}", app.name, locked.release.version)]
        } else {
            locked.release.notes.clone()
        };
        updates.push(UpdateManifest {
            app_id: app.id.clone(),
            download_mb: mib(locked.file.size),
            notes: Localized {
                en: lines.clone(),
                be: lines.clone(),
                ru: lines,
            },
            package: Some(pkg.clone()),
        });
        packages.push(pkg);
    }
    let shipped: BTreeSet<String> = apps.iter().map(|a| a.id.clone()).collect();
    let keep = |ids: &[String]| -> Vec<String> {
        ids.iter()
            .filter(|id| shipped.contains(*id))
            .cloned()
            .collect()
    };
    let rising: Vec<String> = catalog
        .apps
        .iter()
        .filter(|a| a.rising.is_some() && shipped.contains(&a.id))
        .map(|a| a.id.clone())
        .collect();
    let e = &catalog.editorial;
    let collections = e
        .collections
        .iter()
        .map(|c| Collection {
            id: c.id.clone(),
            icon: c.icon.clone(),
            title: c.title.clone(),
            sub: c.sub.clone(),
            apps: if c.apps.is_empty() && c.id == "rising" {
                rising.clone()
            } else {
                keep(&c.apps)
            },
        })
        .filter(|c| !c.apps.is_empty())
        .collect();
    let browse_heroes = e
        .browse_heroes
        .iter()
        .filter(|h| shipped.contains(&h.app_id))
        .filter_map(|h| {
            let note = h.note.clone().or_else(|| {
                catalog
                    .apps
                    .iter()
                    .find(|a| a.id == h.app_id)
                    .and_then(|a| a.rising.as_ref())
                    .map(|r| r.note.clone())
            })?;
            Some(BrowseHero {
                app_id: h.app_id.clone(),
                title1: h.title1.clone(),
                title2: h.title2.clone(),
                body: h.body.clone(),
                note,
            })
        })
        .collect();
    let hero_slides = e
        .hero_slides
        .iter()
        .map(|s| HeroSlide {
            kicker: s.kicker.clone(),
            title1: s.title1.clone(),
            title2: s.title2.clone(),
            body: s.body.clone(),
            cta: s.cta.clone(),
            quote: s.quote.clone(),
            target: s.target,
        })
        .collect();
    let categories = CATEGORIES
        .iter()
        .map(|(id, icon, hue)| Category {
            id: *id,
            catalog_count: apps.iter().filter(|a| a.category == *id).count() as u32,
            icon: (*icon).to_owned(),
            hue: (*hue).to_owned(),
        })
        .collect();
    let publishers: BTreeSet<&str> = apps.iter().map(|a| a.publisher.as_str()).collect();
    let platform = PlatformInfo {
        platform_stats: PlatformStats {
            developers: publishers.len() as u32,
            apps: apps.len() as u32,
            pro_members: 0,
        },
        plans: Vec::new(),
        // The client puts its own version here.
        about: AboutInfo {
            version: String::new(),
            build: date.replace('-', ""),
        },
        features: Features {
            pro: false,
            account: false,
            ideas: false,
            channels: false,
            reviews: false,
        },
    };
    let official_info = ChannelInfo {
        id: OFFICIAL_CHANNEL.to_owned(),
        name: "Paparats".to_owned(),
        kind: ChannelKind::Catalog,
        trust: TrustLevel::Official,
        author: "Paparats".to_owned(),
        addr: "paparats-app.github.io/catalog".to_owned(),
        handle: "@paparats".to_owned(),
        tint: "#1f6f52".to_owned(),
        mono: "Pp".to_owned(),
        subscribers: 0,
        synced: Some(date.to_owned()),
        files: FileHost::Author,
        support: "github.com/paparats-app/catalog/issues".to_owned(),
        desc: Localized {
            en: "The curated Paparats catalog: hand-picked apps for Windows from their authors' GitHub Releases. Every file is checked against this signed catalog.".to_owned(),
            be: "Курыраваны каталог Paparats: адабраныя праграмы для Windows з GitHub Releases іх аўтараў. Кожны файл правяраецца па гэтым падпісаным каталогу.".to_owned(),
            ru: "Курируемый каталог Paparats: отобранные программы для Windows из GitHub Releases их авторов. Каждый файл проверяется по этому подписанному каталогу.".to_owned(),
        },
        reviewed: None,
        outage: None,
    };
    let directory = ChannelDirectory {
        generated: date.to_owned(),
        channels: vec![ChannelEntry {
            info: official_info,
            manifest_url: format!("{base_url}official.json"),
            keys: Vec::new(),
        }],
    };
    let catalog_out = Catalog {
        apps,
        categories,
        collections,
        hero_slides,
        browse_heroes,
        featured: keep(&e.featured),
        notable: keep(&e.notable),
        pro_apps: Vec::new(),
        updates,
        generic_notes: e.generic_notes.clone(),
        review_pool: Vec::new(),
    };
    Built {
        catalog: catalog_out,
        directory,
        platform,
        official: ChannelManifest {
            channel_id: OFFICIAL_CHANNEL.to_owned(),
            generated: date.to_owned(),
            packages,
        },
        missing,
    }
}

fn envelope<T: Serialize>(
    value: &T,
    key: Option<&(SigningKey, String)>,
) -> Result<String, BotError> {
    let payload =
        serde_json::to_vec(value).map_err(|e| BotError::Spec(format!("manifest: {e}")))?;
    let envelope = match key {
        Some((key, id)) => sign_envelope(key, id, &payload),
        None => paparats_catalog::ManifestEnvelope {
            payload: base64_encode(&payload),
            signature: None,
            key_id: None,
            public_key: None,
        },
    };
    let mut json = serde_json::to_string_pretty(&envelope)
        .map_err(|e| BotError::Spec(format!("envelope: {e}")))?;
    json.push('\n');
    Ok(json)
}

fn write(path: &Path, text: &str) -> Result<(), BotError> {
    fs::write(path, text).map_err(|e| BotError::io(path, e))
}

/// Writes `<out>/v1/{channels,catalog,platform,official}.json`, the icons and a short
/// `index.html`. `key` = `None` writes unsigned envelopes (local previews only).
pub fn write_site(
    built: &Built,
    root: &Path,
    out: &Path,
    key: Option<&(SigningKey, String)>,
    date: &str,
) -> Result<(), BotError> {
    let v1 = out.join("v1");
    let icons = v1.join("icons");
    fs::create_dir_all(&icons).map_err(|e| BotError::io(&icons, e))?;
    write(
        &v1.join("catalog.json"),
        &envelope(
            &CatalogManifest {
                generated: date.to_owned(),
                catalog: built.catalog.clone(),
            },
            key,
        )?,
    )?;
    write(&v1.join("channels.json"), &envelope(&built.directory, key)?)?;
    write(
        &v1.join("platform.json"),
        &envelope(
            &PlatformManifest {
                generated: date.to_owned(),
                platform: built.platform.clone(),
            },
            key,
        )?,
    )?;
    write(&v1.join("official.json"), &envelope(&built.official, key)?)?;
    for app in &built.catalog.apps {
        let from = root.join("icons").join(format!("{}.png", app.id));
        if from.is_file() {
            let to = icons.join(format!("{}.png", app.id));
            fs::copy(&from, &to).map_err(|e| BotError::io(&to, e))?;
        }
    }
    let mut rows = String::new();
    for app in &built.catalog.apps {
        let repo = app
            .source
            .as_ref()
            .map(|s| s.repo.as_str())
            .unwrap_or_default();
        rows.push_str(&format!(
            "<li><a href=\"https://github.com/{repo}\">{}</a> {}</li>\n",
            html(&app.name),
            html(&app.version)
        ));
    }
    let page = format!(
        "<!doctype html>\n<html lang=\"en\"><meta charset=\"utf-8\"><title>Paparats catalog</title>\n\
         <body><h1>Paparats catalog</h1><p>The signed catalog the Paparats client reads, built {date}. \
         Source: <a href=\"https://github.com/paparats-app/catalog\">paparats-app/catalog</a>.</p>\n<ul>\n{rows}</ul></body></html>\n"
    );
    write(&out.join("index.html"), &page)?;
    Ok(())
}

fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
