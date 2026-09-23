//! HTTP calls to the account API: token exchange and refresh (`/oauth/token`), revocation
//! (`/oauth/revoke`, RFC 7009) and the profile (`GET /v1/me`).
//!
//! HTTPS only (plain HTTP to loopback hosts, for tests); the API host must be on the allowlist;
//! redirects are never followed (a token request must not travel anywhere else); answers are
//! capped at [`MAX_BODY`].

use std::time::Duration;

use reqwest::header::ACCEPT;
use reqwest::{Client, Response, StatusCode, redirect};
use serde::Deserialize;
use url::Url;

use paparats_core::hosts::is_loopback;

use super::profile::parse_me;
use super::tokens::{parse_token_response, unix_now};
use super::{
    AuthError, AuthResult, ME_PATH, OAuthConfig, REVOKE_PATH, RemoteProfile, Secret, TOKEN_PATH,
    TokenSet, sanitize_code,
};

/// Largest answer read from the account API.
pub const MAX_BODY: usize = 64 * 1024;
/// Revocation runs at sign-out and must not hold it up for long when offline.
const REVOKE_TIMEOUT: Duration = Duration::from_secs(5);

/// The checked API origin of `config`: `https` (or `http` to a loopback host) on an allowed host.
pub(crate) fn api_base(config: &OAuthConfig) -> AuthResult<Url> {
    let url = Url::parse(&config.api_base)
        .map_err(|_| AuthError::InvalidUrl("account API base".into()))?;
    let host = url
        .host_str()
        .ok_or_else(|| AuthError::InvalidUrl("no host".into()))?;
    match url.scheme() {
        "https" => {}
        "http" if is_loopback(host) => {}
        "http" => return Err(AuthError::InsecureUrl(host.to_owned())),
        other => return Err(AuthError::InvalidUrl(format!("scheme {other}"))),
    }
    if !config.allowlist.is_allowed(host) {
        return Err(AuthError::HostNotAllowed(host.to_owned()));
    }
    Ok(url)
}

/// `path` (absolute) on the API origin.
pub(crate) fn endpoint(base: &Url, path: &str) -> AuthResult<Url> {
    base.join(path)
        .map_err(|_| AuthError::InvalidUrl(format!("endpoint {path}")))
}

#[derive(Deserialize)]
struct ErrorAnswer {
    error: String,
}

/// Reads at most [`MAX_BODY`] bytes of an answer.
async fn read_body(mut response: Response) -> AuthResult<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|len| len > MAX_BODY as u64)
    {
        return Err(AuthError::Protocol("answer is too large".into()));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if body.len() + chunk.len() > MAX_BODY {
            return Err(AuthError::Protocol("answer is too large".into()));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

/// An OAuth error answer (`{"error": "invalid_grant", …}`) or the bare status.
fn refusal(status: StatusCode, body: &[u8]) -> AuthError {
    match serde_json::from_slice::<ErrorAnswer>(body) {
        Ok(answer) => AuthError::OAuth(sanitize_code(&answer.error)),
        Err(_) => AuthError::Http(status.as_u16()),
    }
}

/// A client for one account API. Cheap to clone (the connection pool is shared).
#[derive(Debug, Clone)]
pub struct OAuthClient {
    http: Client,
    config: OAuthConfig,
    token_url: Url,
    revoke_url: Url,
    me_url: Url,
}

impl OAuthClient {
    /// Checks the API origin against the allowlist and builds the HTTP client.
    pub fn new(config: OAuthConfig) -> AuthResult<Self> {
        let base = api_base(&config)?;
        let mut builder = Client::builder()
            .redirect(redirect::Policy::none())
            .user_agent(concat!("Paparats/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(15))
            .timeout(config.timeout);
        if !config.use_env_proxy {
            builder = builder.no_proxy();
        }
        Ok(Self {
            http: builder.build()?,
            token_url: endpoint(&base, TOKEN_PATH)?,
            revoke_url: endpoint(&base, REVOKE_PATH)?,
            me_url: endpoint(&base, ME_PATH)?,
            config,
        })
    }

    pub fn config(&self) -> &OAuthConfig {
        &self.config
    }

    async fn token_request(
        &self,
        form: &[(&str, &str)],
        previous_refresh: Option<&Secret>,
    ) -> AuthResult<TokenSet> {
        let response = self
            .http
            .post(self.token_url.clone())
            .header(ACCEPT, "application/json")
            .form(form)
            .send()
            .await?;
        let status = response.status();
        let body = read_body(response).await?;
        if status.is_success() {
            parse_token_response(&body, unix_now(), previous_refresh)
        } else {
            Err(refusal(status, &body))
        }
    }

    /// `grant_type=authorization_code` with the PKCE verifier.
    pub async fn exchange_code(&self, code: &Secret, verifier: &Secret) -> AuthResult<TokenSet> {
        self.token_request(
            &[
                ("grant_type", "authorization_code"),
                ("code", code.expose()),
                ("redirect_uri", self.config.redirect_uri.as_str()),
                ("client_id", self.config.client_id.as_str()),
                ("code_verifier", verifier.expose()),
            ],
            None,
        )
        .await
    }

    /// `grant_type=refresh_token`. An answer without a new refresh token keeps this one.
    pub async fn refresh(&self, refresh_token: &Secret) -> AuthResult<TokenSet> {
        self.token_request(
            &[
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token.expose()),
                ("client_id", self.config.client_id.as_str()),
            ],
            Some(refresh_token),
        )
        .await
    }

    /// Revokes a token (`hint`: `refresh_token` or `access_token`). RFC 7009: the server answers
    /// 200 also for tokens it no longer knows.
    pub async fn revoke(&self, token: &Secret, hint: &str) -> AuthResult<()> {
        let response = self
            .http
            .post(self.revoke_url.clone())
            .timeout(REVOKE_TIMEOUT)
            .form(&[
                ("token", token.expose()),
                ("token_type_hint", hint),
                ("client_id", self.config.client_id.as_str()),
            ])
            .send()
            .await?;
        let status = response.status();
        if status.is_success() {
            return Ok(());
        }
        let body = read_body(response).await?;
        Err(refusal(status, &body))
    }

    /// `GET /v1/me` with the access token. 401 → [`AuthError::Unauthorized`].
    pub async fn me(&self, access_token: &Secret) -> AuthResult<RemoteProfile> {
        let response = self
            .http
            .get(self.me_url.clone())
            .header(ACCEPT, "application/json")
            .bearer_auth(access_token.expose())
            .send()
            .await?;
        let status = response.status();
        if status == StatusCode::UNAUTHORIZED {
            return Err(AuthError::Unauthorized);
        }
        if !status.is_success() {
            return Err(AuthError::Http(status.as_u16()));
        }
        parse_me(&read_body(response).await?)
    }
}

#[cfg(test)]
mod tests {
    use paparats_core::hosts::Allowlist;

    use super::*;

    fn config(base: &str, allow: &[&str]) -> OAuthConfig {
        let mut allowlist = Allowlist::new();
        for host in allow {
            allowlist.allow(host);
        }
        OAuthConfig {
            api_base: base.into(),
            allowlist,
            ..OAuthConfig::production()
        }
    }

    #[test]
    fn api_origin_must_be_allowed_and_secure() {
        assert!(OAuthClient::new(OAuthConfig::production()).is_ok());
        assert!(OAuthClient::new(config("http://127.0.0.1:9", &["127.0.0.1"])).is_ok());
        assert!(matches!(
            OAuthClient::new(config("http://127.0.0.1:9", &[])),
            Err(AuthError::HostNotAllowed(_))
        ));
        assert!(matches!(
            OAuthClient::new(config("https://evil.example", &[])),
            Err(AuthError::HostNotAllowed(_))
        ));
        assert!(matches!(
            OAuthClient::new(config("http://api.paparats.app", &[])),
            Err(AuthError::InsecureUrl(_))
        ));
        assert!(matches!(
            OAuthClient::new(config("ftp://api.paparats.app", &[])),
            Err(AuthError::InvalidUrl(_))
        ));
        assert!(matches!(
            OAuthClient::new(config("not a url", &[])),
            Err(AuthError::InvalidUrl(_))
        ));
    }

    #[test]
    fn endpoints_sit_at_the_origin_root() {
        let c = OAuthClient::new(config("https://api.paparats.app/some/prefix", &[])).unwrap();
        assert_eq!(c.token_url.as_str(), "https://api.paparats.app/oauth/token");
        assert_eq!(
            c.revoke_url.as_str(),
            "https://api.paparats.app/oauth/revoke"
        );
        assert_eq!(c.me_url.as_str(), "https://api.paparats.app/v1/me");
    }

    #[test]
    fn refusals() {
        assert!(matches!(
            refusal(StatusCode::BAD_REQUEST, br#"{"error":"invalid_grant","error_description":"x"}"#),
            AuthError::OAuth(c) if c == "invalid_grant"
        ));
        assert!(matches!(
            refusal(StatusCode::BAD_GATEWAY, b"<html>"),
            AuthError::Http(502)
        ));
    }
}
