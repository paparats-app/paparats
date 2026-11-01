//! The one place that decides which real strategies replace the simulated ones.
//!
//! By default the app is real: the catalog from GitHub Pages, the installed apps from Windows and
//! real installs ([`RealFlags::RELEASE`]; sign-in stays off, there is no account service yet).
//! `--demo` on the command line or `PAPARATS_DEMO=1` runs the demo world from the design
//! instead: the mock catalog, library and account with the prototype's timings (D68).
//! `PAPARATS_REAL` picks the real strategies one by one (M7, development), overriding both.
//!
//! Its value is a list of names separated by commas, semicolons, `+` or whitespace, in any case:
//!
//! | name        | real strategy                                                             |
//! |-------------|---------------------------------------------------------------------------|
//! | `inventory` | installed apps from the registry, MSIX packages and the portable folder   |
//! | `install`   | MSI, EXE silent, MSIX and portable ZIP installers with Authenticode checks |
//! | `catalog`   | signed manifests from the CDN, real downloads of the packages they list   |
//! | `account`   | OAuth 2 PKCE sign-in in the browser, tokens in the Credential Manager     |
//! | `all`       | all four                                                                  |
//!
//! Unknown names are ignored with a warning. The remote catalog also reads two development
//! overrides, since no release signing key is pinned yet ([`CatalogEnv`]; development builds
//! only): `PAPARATS_CATALOG_URL` (base URL of the official manifests) and
//! `PAPARATS_CATALOG_KEYS` (`id:key[,id:key]`, the key as base64 or 64 hex digits — what
//! `sign-manifest --public-key` prints).

use paparats_catalog::{CatalogError, KeyRing, RemoteConfig};

/// The variable that picks real strategies one by one.
pub const ENV_REAL: &str = "PAPARATS_REAL";
/// The variable that runs the demo world (`1`, `true` or `yes`).
pub const ENV_DEMO: &str = "PAPARATS_DEMO";
/// The command-line switch that runs the demo world.
pub const ARG_DEMO: &str = "--demo";
/// Development override of the official manifests' base URL.
pub const ENV_CATALOG_URL: &str = "PAPARATS_CATALOG_URL";
/// Development override of the pinned official keys (`id:key[,id:key]`, base64 or hex keys).
pub const ENV_CATALOG_KEYS: &str = "PAPARATS_CATALOG_KEYS";

/// Which strategies are real. `Default` = everything simulated.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct RealFlags {
    pub inventory: bool,
    pub install: bool,
    pub catalog: bool,
    pub account: bool,
}

impl RealFlags {
    /// Every strategy real (`PAPARATS_REAL=all`).
    pub const ALL: Self = Self {
        inventory: true,
        install: true,
        catalog: true,
        account: true,
    };

    /// What the app runs by default: everything real except sign-in.
    pub const RELEASE: Self = Self {
        inventory: true,
        install: true,
        catalog: true,
        account: false,
    };

    /// Parses the value of `PAPARATS_REAL`; also returns the names it did not recognise.
    pub fn parse(value: &str) -> (Self, Vec<String>) {
        let mut flags = Self::default();
        let mut unknown = Vec::new();
        let names = value
            .split(|c: char| matches!(c, ',' | ';' | '+') || c.is_whitespace())
            .map(str::trim)
            .filter(|name| !name.is_empty());
        for name in names {
            match name.to_ascii_lowercase().as_str() {
                "inventory" => flags.inventory = true,
                "install" => flags.install = true,
                "catalog" => flags.catalog = true,
                "account" => flags.account = true,
                "all" => flags = Self::ALL,
                _ => unknown.push(name.to_owned()),
            }
        }
        (flags, unknown)
    }

    /// The strategies for this launch: `PAPARATS_REAL` when set, else the demo world for
    /// `--demo` / `PAPARATS_DEMO`, else [`RealFlags::RELEASE`].
    pub fn from_env(args: &[String]) -> Self {
        let demo_env = std::env::var(ENV_DEMO).ok();
        Self::choose(
            std::env::var(ENV_REAL).ok().as_deref(),
            demo_env.as_deref(),
            args,
        )
    }

    fn choose(real: Option<&str>, demo_env: Option<&str>, args: &[String]) -> Self {
        if let Some(value) = real {
            let (flags, unknown) = Self::parse(value);
            for name in &unknown {
                tracing::warn!(name = %name, "{ENV_REAL}: unknown strategy ignored");
            }
            return flags;
        }
        let demo_env = demo_env.is_some_and(|v| {
            matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes")
        });
        if demo_env || args.iter().any(|a| a == ARG_DEMO) {
            Self::default()
        } else {
            Self::RELEASE
        }
    }

    /// Whether everything is simulated (the default run).
    pub fn is_simulated(&self) -> bool {
        *self == Self::default()
    }

    /// The real strategies, by name (for the log).
    pub fn names(&self) -> Vec<&'static str> {
        [
            (self.inventory, "inventory"),
            (self.install, "install"),
            (self.catalog, "catalog"),
            (self.account, "account"),
        ]
        .into_iter()
        .filter_map(|(on, name)| on.then_some(name))
        .collect()
    }
}

/// The official catalog as GitHub Pages served it when this build was made
/// (`scripts/catalog-snapshot.mjs`, run by the release workflow). It seeds an empty cache, so a
/// first start without a network shows a verified catalog; the client checks its signatures like
/// anything it fetches, and the first refresh replaces it.
const CATALOG_SNAPSHOT: &[(&str, &[u8])] = &[
    (
        "channels.json",
        include_bytes!("../catalog-snapshot/channels.json"),
    ),
    (
        "catalog.json",
        include_bytes!("../catalog-snapshot/catalog.json"),
    ),
    (
        "platform.json",
        include_bytes!("../catalog-snapshot/platform.json"),
    ),
    (
        "official.json",
        include_bytes!("../catalog-snapshot/official.json"),
    ),
];

/// The remote catalog's development overrides (`PAPARATS_CATALOG_URL`, `PAPARATS_CATALOG_KEYS`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CatalogEnv {
    pub base_url: Option<String>,
    pub keys: Option<String>,
}

impl CatalogEnv {
    /// Reads the overrides — in development builds only. A release build ignores them (with a
    /// warning when they are set): there the keys compiled into the client are the only root of
    /// trust, and an environment variable must not be able to replace them.
    pub fn from_env() -> Self {
        let read = |name: &str| {
            std::env::var(name)
                .ok()
                .map(|v| v.trim().to_owned())
                .filter(|v| !v.is_empty())
        };
        let env = Self {
            base_url: read(ENV_CATALOG_URL),
            keys: read(ENV_CATALOG_KEYS),
        };
        if cfg!(debug_assertions) || env == Self::default() {
            return env;
        }
        tracing::warn!("{ENV_CATALOG_URL} and {ENV_CATALOG_KEYS} are ignored in release builds");
        Self::default()
    }

    /// The production CDN and pinned keys, with the overrides applied. A base URL given here is
    /// also allowed on the network allowlist (the developer named it; plain HTTP still only for
    /// loopback hosts); a loopback one is reached without the environment's proxy.
    pub fn remote_config(&self) -> Result<RemoteConfig, CatalogError> {
        let mut config = RemoteConfig::production()?;
        if self.keys.is_none() && self.base_url.is_none() {
            config = config.with_seed(CATALOG_SNAPSHOT);
        }
        if let Some(keys) = &self.keys {
            config = config.with_official_keys(KeyRing::from_spec(keys)?);
        }
        if let Some(base) = &self.base_url {
            let host = tauri::Url::parse(base)
                .map_err(|e| CatalogError::InvalidUrl(e.to_string()))?
                .host_str()
                .map(str::to_owned)
                .ok_or_else(|| CatalogError::InvalidUrl("no host".into()))?;
            config = config.with_base_url(base.clone()).allow_host(&host);
            if paparats_core::hosts::is_loopback(&host) {
                config.use_env_proxy = false;
            }
        }
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(value: &str) -> RealFlags {
        RealFlags::parse(value).0
    }

    #[test]
    fn nothing_is_real_by_default() {
        assert!(RealFlags::default().is_simulated());
        for value in ["", "  ", ",", "none-of-these"] {
            assert!(parse(value).is_simulated(), "{value:?}");
        }
        assert!(RealFlags::default().names().is_empty());
    }

    #[test]
    fn names_and_separators() {
        assert_eq!(
            parse("inventory"),
            RealFlags {
                inventory: true,
                ..RealFlags::default()
            }
        );
        let two = parse(" Inventory , CATALOG ");
        assert!(two.inventory && two.catalog && !two.install && !two.account);
        let all_four = parse("inventory;install+catalog account");
        assert_eq!(all_four, RealFlags::ALL);
        assert_eq!(parse("all"), RealFlags::ALL);
        assert_eq!(parse("account,ALL"), RealFlags::ALL);
        assert_eq!(
            RealFlags::ALL.names(),
            ["inventory", "install", "catalog", "account"]
        );
    }

    #[test]
    fn real_by_default_demo_on_request() {
        let none: [String; 0] = [];
        assert_eq!(RealFlags::choose(None, None, &none), RealFlags::RELEASE);
        const { assert!(!RealFlags::RELEASE.account, "no account service yet") };
        let demo = ["paparats.exe".to_owned(), ARG_DEMO.to_owned()];
        assert!(RealFlags::choose(None, None, &demo).is_simulated());
        assert!(RealFlags::choose(None, Some("1"), &none).is_simulated());
        assert!(RealFlags::choose(None, Some(" Yes "), &none).is_simulated());
        assert_eq!(
            RealFlags::choose(None, Some("0"), &none),
            RealFlags::RELEASE
        );
        // PAPARATS_REAL wins over both.
        let only_inventory = RealFlags::choose(Some("inventory"), Some("1"), &demo);
        assert!(only_inventory.inventory && !only_inventory.catalog);
        assert!(RealFlags::choose(Some(""), None, &none).is_simulated());
    }

    #[test]
    fn unknown_names_are_reported() {
        let (flags, unknown) = RealFlags::parse("install, telemetry, 1");
        assert!(flags.install && !flags.inventory);
        assert_eq!(unknown, ["telemetry", "1"]);
    }

    #[test]
    fn catalog_overrides() {
        // Production pins the official keys.
        assert!(matches!(
            CatalogEnv::default()
                .remote_config()
                .map(|c| c.official_keys.is_empty()),
            Ok(false)
        ));
        // RFC 8032, test 1: a valid Ed25519 public key.
        const KEY: &str = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
        let env = CatalogEnv {
            base_url: Some("http://127.0.0.1:8787/v1/".into()),
            keys: Some(format!("dev:{KEY}")),
        };
        let config = env.remote_config().unwrap();
        assert_eq!(config.base_url, "http://127.0.0.1:8787/v1/");
        assert!(!config.official_keys.is_empty());
        assert!(config.allowlist.read().unwrap().is_allowed("127.0.0.1"));
        assert!(!config.use_env_proxy, "a local CDN needs no proxy");
        assert!(CatalogEnv::default().remote_config().unwrap().use_env_proxy);
        // The built-in snapshot seeds production only, never a development catalog.
        assert_eq!(CatalogEnv::default().remote_config().unwrap().seed.len(), 4);
        assert!(config.seed.is_empty());

        let bad = CatalogEnv {
            base_url: Some("not a url".into()),
            keys: None,
        };
        assert!(matches!(
            bad.remote_config(),
            Err(CatalogError::InvalidUrl(_))
        ));
        let bad_keys = CatalogEnv {
            base_url: None,
            keys: Some("dev:???".into()),
        };
        assert!(bad_keys.remote_config().is_err());
    }
}
