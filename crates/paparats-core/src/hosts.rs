//! Network allowlist — the only hosts the client may contact. No telemetry, ever.
//!
//! Catalog/channel hosts, download hosts from signed manifests, the account API and the updater
//! endpoint. Download and channel hosts are added at runtime from verified manifests
//! ([`Allowlist::allow`]); this module holds the fixed first-party ones.

use std::collections::BTreeSet;

/// First-party hosts the client talks to.
pub const FIRST_PARTY: &[&str] = &[
    "paparats.app",
    "cdn.paparats.app",
    "api.paparats.app",
    "updates.paparats.app",
];

/// The account API: OAuth 2 authorization server (`/oauth/*`) and `/v1/me`. One of
/// [`FIRST_PARTY`].
pub const ACCOUNT_API: &str = "api.paparats.app";

fn normalize(host: &str) -> String {
    host.trim_end_matches('.').to_ascii_lowercase()
}

/// Whether `host` is a first-party Paparats host (exact match or subdomain of `paparats.app`).
pub fn is_first_party(host: &str) -> bool {
    let host = normalize(host);
    FIRST_PARTY.contains(&host.as_str()) || host.ends_with(".paparats.app")
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
        assert!(is_first_party("paparats.app"));
        assert!(is_first_party("CDN.Paparats.App."));
        assert!(is_first_party("mirror.eu.paparats.app"));
        assert!(!is_first_party("paparats.app.evil.com"));
        assert!(!is_first_party("notpaparats.app"));
    }

    #[test]
    fn runtime_allowlist() {
        let list = Allowlist::new().with("Downloads.Nilesoft.org.");
        assert!(list.is_allowed("downloads.nilesoft.org"));
        assert!(list.is_allowed("cdn.paparats.app"));
        assert!(!list.is_allowed("nilesoft.org"));
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
    fn account_api_is_first_party() {
        assert!(FIRST_PARTY.contains(&ACCOUNT_API));
    }
}
