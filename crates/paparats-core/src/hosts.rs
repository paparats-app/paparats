//! Network allowlist — the only hosts the client may contact. No telemetry, ever.
//!
//! Catalog/channel hosts, download hosts from signed manifests, the account API and the updater
//! endpoint. Download and channel hosts are added at runtime from verified manifests
//! ([`Allowlist::allow`]); this module holds the fixed first-party ones.

use std::collections::BTreeSet;

/// First-party hosts the client talks to: the catalog on GitHub Pages, GitHub itself (the
/// updater's `latest.json` and the release downloads of Paparats and of the catalog's apps) and
/// the hosts GitHub redirects release downloads to. Only our own Pages host, never all of
/// `*.github.io`.
pub const FIRST_PARTY: &[&str] = &[
    "paparats-app.github.io",
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
];

/// The account API: OAuth 2 authorization server (`/oauth/*`) and `/v1/me`. Not first-party:
/// there is no account service yet (D68), so only the development-only real sign-in
/// (`PAPARATS_REAL=account`) allows it, explicitly.
pub const ACCOUNT_API: &str = "api.paparats.app";

fn normalize(host: &str) -> String {
    host.trim_end_matches('.').to_ascii_lowercase()
}

/// Whether `host` is a first-party host (exact match only).
pub fn is_first_party(host: &str) -> bool {
    FIRST_PARTY.contains(&normalize(host).as_str())
}

/// Whether `host` is this machine. Plain `http://` is only ever accepted for loopback hosts
/// (local test servers); everything else must be `https://`.
pub fn is_loopback(host: &str) -> bool {
    matches!(
        normalize(host).as_str(),
        "localhost" | "127.0.0.1" | "::1" | "[::1]"
    )
}

/// The runtime allowlist: first-party hosts plus the hosts named by verified manifests.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Allowlist {
    extra: BTreeSet<String>,
}

impl Allowlist {
    /// First-party hosts only.
    pub fn new() -> Self {
        Self::default()
    }

    /// Allows `host` (exact match, case-insensitive). Call only with hosts taken from a manifest
    /// whose signature has been verified.
    pub fn allow(&mut self, host: &str) {
        let host = normalize(host);
        if !host.is_empty() {
            self.extra.insert(host);
        }
    }

    /// Builder form of [`Allowlist::allow`].
    pub fn with(mut self, host: &str) -> Self {
        self.allow(host);
        self
    }

    pub fn is_allowed(&self, host: &str) -> bool {
        is_first_party(host) || self.extra.contains(&normalize(host))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_party_hosts() {
        assert!(is_first_party("Paparats-App.GitHub.io."));
        assert!(!is_first_party("paparats.app"), "a domain we do not own");
        assert!(!is_first_party("cdn.paparats.app"));
        assert!(!is_first_party("paparats-app.github.io.evil.com"));
        assert!(is_first_party("paparats-app.github.io"));
        assert!(is_first_party("GitHub.com"));
        assert!(is_first_party("release-assets.githubusercontent.com"));
        assert!(!is_first_party("evil-app.github.io"));
        assert!(!is_first_party("api.github.com"));
    }

    #[test]
    fn runtime_allowlist() {
        let list = Allowlist::new().with("Downloads.Kvetka.Example.");
        assert!(list.is_allowed("downloads.kvetka.example"));
        assert!(list.is_allowed("paparats-app.github.io"));
        assert!(!list.is_allowed("kvetka.example"));
        assert!(!list.is_allowed("evil.example"));
    }

    #[test]
    fn loopback_hosts() {
        assert!(is_loopback("127.0.0.1"));
        assert!(is_loopback("LOCALHOST"));
        assert!(is_loopback("[::1]"));
        assert!(!is_loopback("127.0.0.1.nip.io"));
    }

    #[test]
    fn the_account_api_is_not_first_party() {
        // No account service exists (D68): only the development-only real sign-in allows it.
        assert!(!is_first_party(ACCOUNT_API));
    }
}
