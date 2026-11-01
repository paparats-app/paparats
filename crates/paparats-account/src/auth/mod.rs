//! Real sign-in (M7, `PAPARATS_REAL=account`): OAuth 2.0 Authorization Code + PKCE for a native
//! app (RFC 6749, RFC 7636, RFC 8252), tokens in the Windows Credential Manager.
//!
//! The flow, end to end:
//! 1. [`OAuthAccount::begin_sign_in`] creates a [`PkceSession`] (64-character verifier, S256
//!    challenge, random state) and returns the authorization URL
//!    (`https://api.paparats.app/oauth/authorize?…`); the Tauri layer opens it in the browser.
//! 2. The browser comes back through `paparats://auth/callback?code=…&state=…` (the deep link);
//!    [`OAuthAccount::complete`] checks that the state answers a pending sign-in, exchanges the
//!    code at `/oauth/token`, reads the profile from `GET /v1/me`, stores the tokens under the
//!    user id ([`TokenStore`], service `Paparats`) and signs the local account in.
//! 3. [`OAuthAccount::access_token`] refreshes ahead of expiry; a refused refresh ends the session.
//! 4. [`OAuthAccount::sign_out`] revokes the tokens (`/oauth/revoke`, best effort) and deletes
//!    them.
//!
//! Tokens, codes, the verifier and the state never reach a log line, an error message or a
//! `Debug` dump ([`Secret`]); neither do the user id or the email.

mod client;
mod pkce;
mod profile;
mod secret;
mod session;
mod token_store;
mod tokens;

use std::time::Duration;

use paparats_core::hosts::{self, Allowlist};
use paparats_storage::StorageError;

use crate::AccountError;

pub use client::OAuthClient;
pub use pkce::{Callback, PkceSession, VERIFIER_LEN};
pub use profile::RemoteProfile;
pub use secret::Secret;
pub use session::{OAuthAccount, PENDING_TTL, USER_ID_META};
#[cfg(windows)]
pub use token_store::CredentialManager;
pub use token_store::{CREDENTIAL_BLOB_MAX, MemoryTokenStore, TokenStore};
pub use tokens::{REFRESH_MARGIN_SECS, TokenSet};

/// The client id of the desktop app (a public client: PKCE, no secret).
pub const CLIENT_ID: &str = "paparats-desktop";
/// Where the browser returns after sign-in (the `paparats://` scheme is registered by the
/// installer, D48).
pub const REDIRECT_URI: &str = "paparats://auth/callback";
/// The Credential Manager service every token entry is filed under (account = user id).
pub const CREDENTIAL_SERVICE: &str = paparats_core::PRODUCT_NAME;

pub(crate) const AUTHORIZE_PATH: &str = "/oauth/authorize";
pub(crate) const TOKEN_PATH: &str = "/oauth/token";
pub(crate) const REVOKE_PATH: &str = "/oauth/revoke";
pub(crate) const ME_PATH: &str = "/v1/me";

/// Errors of the real sign-in. Messages never carry tokens, codes, the state, the user id or the
/// email: server error codes are reduced to `[A-Za-z0-9._-]`, transport errors lose their URL.
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("invalid account API URL: {0}")]
    InvalidUrl(String),
    #[error("host is not on the network allowlist: {0}")]
    HostNotAllowed(String),
    #[error("plain HTTP is only allowed for loopback hosts: {0}")]
    InsecureUrl(String),
    /// The link is not `paparats://auth/callback`.
    #[error("not a sign-in callback")]
    NotCallback,
    #[error("malformed sign-in callback: {0}")]
    MalformedCallback(&'static str),
    /// The callback's state answers no pending sign-in (forged, replayed or expired).
    #[error("the sign-in callback does not match a pending sign-in")]
    StateMismatch,
    /// The authorization server sent the browser back with an error (`access_denied`, …).
    #[error("sign-in was not completed: {0}")]
    Denied(String),
    /// The token or revocation endpoint refused the request (`invalid_grant`, …).
    #[error("the authorization server refused the request: {0}")]
    OAuth(String),
    /// `GET /v1/me` answered 401: the access token is no longer accepted.
    #[error("the account API rejected the access token")]
    Unauthorized,
    /// The refresh token was refused or is missing; the session has been ended locally.
    #[error("the session has ended; sign in again")]
    SessionExpired,
    #[error("not signed in")]
    NotSignedIn,
    #[error("account API answered HTTP {0}")]
    Http(u16),
    #[error("network error: {0}")]
    Network(String),
    #[error("unexpected answer from the account API: {0}")]
    Protocol(String),
    #[error("credential store: {0}")]
    Credentials(String),
    #[error("the system random number generator failed")]
    Random,
    #[error("the Windows Credential Manager is not available on this platform")]
    Unsupported,
    #[error(transparent)]
    Account(#[from] AccountError),
}

impl From<StorageError> for AuthError {
    fn from(e: StorageError) -> Self {
        Self::Account(e.into())
    }
}

impl From<reqwest::Error> for AuthError {
    fn from(e: reqwest::Error) -> Self {
        // `without_url` keeps endpoints and any query out of messages and logs.
        Self::Network(e.without_url().to_string())
    }
}

pub type AuthResult<T> = std::result::Result<T, AuthError>;

/// Where and how the client talks to the account API.
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    /// Origin of the account API; endpoints are absolute paths on it (`/oauth/token`, `/v1/me`).
    pub api_base: String,
    pub client_id: String,
    pub redirect_uri: String,
    /// `scope` of the authorization request; omitted when `None`.
    pub scope: Option<String>,
    /// Hosts the client may contact (the API host must be on it; plain HTTP only for loopback).
    pub allowlist: Allowlist,
    /// Honour `HTTP(S)_PROXY` from the environment.
    pub use_env_proxy: bool,
    /// Whole-request timeout of the token and profile calls (revocation uses a shorter one).
    pub timeout: Duration,
}

impl OAuthConfig {
    /// The production account API (`https://api.paparats.app`, [`hosts::ACCOUNT_API`]), allowed
    /// explicitly: it is not a first-party host while no account service exists.
    pub fn production() -> Self {
        Self {
            api_base: format!("https://{}", hosts::ACCOUNT_API),
            client_id: CLIENT_ID.to_owned(),
            redirect_uri: REDIRECT_URI.to_owned(),
            scope: None,
            allowlist: Allowlist::new().with(hosts::ACCOUNT_API),
            use_env_proxy: true,
            timeout: Duration::from_secs(20),
        }
    }
}

/// Server-provided error codes (`invalid_grant`, `access_denied`) reduced to a short, safe token.
pub(crate) fn sanitize_code(raw: &str) -> String {
    let code: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
        .take(64)
        .collect();
    if code.is_empty() {
        "unknown".to_owned()
    } else {
        code
    }
}

/// Equality that takes the same time wherever the first difference is (state comparison).
pub(crate) fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0_u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_points_at_the_first_party_api() {
        let config = OAuthConfig::production();
        assert_eq!(config.api_base, "https://api.paparats.app");
        assert_eq!(config.redirect_uri, "paparats://auth/callback");
        assert_eq!(config.client_id, CLIENT_ID);
        assert!(config.allowlist.is_allowed(hosts::ACCOUNT_API));
        assert!(!hosts::is_first_party(hosts::ACCOUNT_API));
        assert_eq!(CREDENTIAL_SERVICE, "Paparats");
    }

    #[test]
    fn error_codes_are_sanitized() {
        assert_eq!(sanitize_code("invalid_grant"), "invalid_grant");
        assert_eq!(sanitize_code("bad\r\ncode <script>"), "badcodescript");
        assert_eq!(sanitize_code(""), "unknown");
        assert_eq!(sanitize_code(&"x".repeat(500)).len(), 64);
    }

    #[test]
    fn constant_time_equality() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"abcd"));
        assert!(constant_time_eq(b"", b""));
    }
}
