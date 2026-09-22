//! Network allowlist — the only hosts the client may contact. No telemetry, ever.
//!
//! Catalog/channel hosts, download hosts from signed manifests, the account API and the updater
//! endpoint. Download and channel hosts are added at runtime from verified manifests; this list
//! holds the fixed first-party ones.

/// First-party hosts the client talks to.
pub const FIRST_PARTY: &[&str] = &[
    "paparats.app",
    "cdn.paparats.app",
    "api.paparats.app",
    "updates.paparats.app",
];

/// Whether `host` is a first-party Paparats host (exact match or subdomain of `paparats.app`).
pub fn is_first_party(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    FIRST_PARTY.contains(&host.as_str()) || host.ends_with(".paparats.app")
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
}
