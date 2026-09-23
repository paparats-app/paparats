//! One browser sign-in attempt: the PKCE verifier and challenge (RFC 7636, `S256`), the state
//! that ties the callback to this attempt, the authorization URL, and the callback check.

use std::time::Instant;

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sha2::{Digest, Sha256};
use url::Url;

use super::{
    AUTHORIZE_PATH, AuthError, AuthResult, OAuthClient, OAuthConfig, Secret, TokenSet,
    constant_time_eq, sanitize_code,
};

/// Length of the code verifier (RFC 7636 allows 43–128).
pub const VERIFIER_LEN: usize = 64;
/// Bytes of randomness in the state (43 characters once encoded).
const STATE_BYTES: usize = 32;
/// Longest authorization code accepted from a callback.
const MAX_CODE_LEN: usize = 2048;
/// The base64url alphabet: 64 unreserved characters, so `byte & 63` picks one without bias.
const URL_SAFE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// `BASE64URL-NOPAD(SHA256(verifier))`.
fn s256(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn random<const N: usize>() -> AuthResult<[u8; N]> {
    let mut bytes = [0_u8; N];
    getrandom::fill(&mut bytes).map_err(|_| AuthError::Random)?;
    Ok(bytes)
}

/// A pending sign-in. Not `Clone`: the verifier is used once.
pub struct PkceSession {
    verifier: Secret,
    challenge: String,
    state: String,
    created: Instant,
}

impl std::fmt::Debug for PkceSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PkceSession").finish_non_exhaustive()
    }
}

impl PkceSession {
    /// A fresh attempt: 64 random URL-safe characters of verifier, its S256 challenge and 256
    /// bits of state, all from the OS generator.
    pub fn new() -> AuthResult<Self> {
        let verifier: String = random::<VERIFIER_LEN>()?
            .iter()
            .map(|b| char::from(URL_SAFE[usize::from(b & 63)]))
            .collect();
        let state = URL_SAFE_NO_PAD.encode(random::<STATE_BYTES>()?);
        Ok(Self::from_parts(verifier, state))
    }

    fn from_parts(verifier: String, state: String) -> Self {
        Self {
            challenge: s256(&verifier),
            verifier: Secret::new(verifier),
            state,
            created: Instant::now(),
        }
    }

    pub fn state(&self) -> &str {
        &self.state
    }

    pub fn code_challenge(&self) -> &str {
        &self.challenge
    }

    pub fn code_verifier(&self) -> &Secret {
        &self.verifier
    }

    pub(crate) fn created(&self) -> Instant {
        self.created
    }

    /// `<api>/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&code_challenge=…
    /// &code_challenge_method=S256&state=…[&scope=…][&login_hint=…]`, to open in the browser.
    pub fn authorization_url(
        &self,
        config: &OAuthConfig,
        login_hint: Option<&str>,
    ) -> AuthResult<Url> {
        let mut url = super::client::endpoint(&super::client::api_base(config)?, AUTHORIZE_PATH)?;
        {
            let mut query = url.query_pairs_mut();
            query
                .append_pair("response_type", "code")
                .append_pair("client_id", &config.client_id)
                .append_pair("redirect_uri", &config.redirect_uri)
                .append_pair("code_challenge", &self.challenge)
                .append_pair("code_challenge_method", "S256")
                .append_pair("state", &self.state);
            if let Some(scope) = config.scope.as_deref().filter(|s| !s.is_empty()) {
                query.append_pair("scope", scope);
            }
            if let Some(hint) = login_hint.map(str::trim).filter(|h| !h.is_empty()) {
                query.append_pair("login_hint", hint);
            }
        }
        Ok(url)
    }

    /// Whether `callback` answers this attempt (constant-time state comparison).
    pub fn matches(&self, callback: &Callback) -> bool {
        constant_time_eq(self.state.as_bytes(), callback.state.as_bytes())
    }

    /// The authorization code of a callback that answers this attempt; `StateMismatch` for any
    /// other callback, `Denied` when the server sent back an error instead of a code.
    pub fn authorization_code(&self, callback: &Callback) -> AuthResult<Secret> {
        if !self.matches(callback) {
            return Err(AuthError::StateMismatch);
        }
        match &callback.outcome {
            Outcome::Code(code) => Ok(code.clone()),
            Outcome::Error(code) => Err(AuthError::Denied(code.clone())),
        }
    }

    /// Checks the callback against this attempt and exchanges its code for tokens.
    pub async fn complete(self, client: &OAuthClient, callback_url: &Url) -> AuthResult<TokenSet> {
        let callback = Callback::parse(callback_url, &client.config().redirect_uri)?;
        let code = self.authorization_code(&callback)?;
        client.exchange_code(&code, &self.verifier).await
    }
}

#[derive(Clone)]
enum Outcome {
    Code(Secret),
    /// The sanitized `error` parameter.
    Error(String),
}

/// A parsed `paparats://auth/callback?…` link.
#[derive(Clone)]
pub struct Callback {
    state: String,
    outcome: Outcome,
}

impl std::fmt::Debug for Callback {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let outcome = match &self.outcome {
            Outcome::Code(_) => "code",
            Outcome::Error(_) => "error",
        };
        f.debug_struct("Callback")
            .field("outcome", &outcome)
            .finish_non_exhaustive()
    }
}

/// Same scheme, host, port and path (a trailing slash is fine), ignoring the query.
fn same_endpoint(url: &Url, expected: &Url) -> bool {
    url.scheme().eq_ignore_ascii_case(expected.scheme())
        && url
            .host_str()
            .unwrap_or_default()
            .eq_ignore_ascii_case(expected.host_str().unwrap_or_default())
        && url.port() == expected.port()
        && url.username().is_empty()
        && url.password().is_none()
        && url.path().trim_end_matches('/') == expected.path().trim_end_matches('/')
}

impl Callback {
    /// Parses a callback link. It must be `redirect_uri` with exactly one non-empty `state` and
    /// either a `code` or an `error`; a repeated parameter is refused (parameter injection).
    pub fn parse(url: &Url, redirect_uri: &str) -> AuthResult<Self> {
        let expected =
            Url::parse(redirect_uri).map_err(|_| AuthError::InvalidUrl("redirect URI".into()))?;
        if !same_endpoint(url, &expected) {
            return Err(AuthError::NotCallback);
        }
        let (mut state, mut code, mut error) = (None, None, None);
        for (key, value) in url.query_pairs() {
            let slot = match key.as_ref() {
                "state" => &mut state,
                "code" => &mut code,
                "error" => &mut error,
                _ => continue,
            };
            if slot.replace(value.into_owned()).is_some() {
                return Err(AuthError::MalformedCallback("repeated parameter"));
            }
        }
        let state = state
            .filter(|s| !s.is_empty())
            .ok_or(AuthError::MalformedCallback("no state"))?;
        let outcome = match (code, error) {
            (_, Some(error)) => Outcome::Error(sanitize_code(&error)),
            (Some(code), None) if !code.is_empty() && code.len() <= MAX_CODE_LEN => {
                Outcome::Code(Secret::new(code))
            }
            _ => return Err(AuthError::MalformedCallback("no code")),
        };
        Ok(Self { state, outcome })
    }

    pub fn state(&self) -> &str {
        &self.state
    }

    pub fn is_error(&self) -> bool {
        matches!(self.outcome, Outcome::Error(_))
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;
    use crate::auth::REDIRECT_URI;

    fn query(url: &Url) -> HashMap<String, String> {
        url.query_pairs().into_owned().collect()
    }

    fn callback(raw: &str) -> AuthResult<Callback> {
        Callback::parse(&Url::parse(raw).unwrap(), REDIRECT_URI)
    }

    #[test]
    fn rfc7636_appendix_b_vector() {
        let s = PkceSession::from_parts(
            "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk".into(),
            "xyz".into(),
        );
        assert_eq!(
            s.code_challenge(),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn verifier_and_state_are_random_and_url_safe() {
        let a = PkceSession::new().unwrap();
        let b = PkceSession::new().unwrap();
        let v = a.code_verifier().expose();
        assert_eq!(v.len(), VERIFIER_LEN);
        assert!(v.bytes().all(|c| URL_SAFE.contains(&c)));
        assert_ne!(v, b.code_verifier().expose());
        assert_eq!(a.state().len(), 43);
        assert!(a.state().bytes().all(|c| URL_SAFE.contains(&c)));
        assert_ne!(a.state(), b.state());
        assert_eq!(a.code_challenge(), s256(v));
        assert_eq!(a.code_challenge().len(), 43);
        assert!(!format!("{a:?}").contains(v));
    }

    #[test]
    fn authorization_url_carries_the_pkce_parameters() {
        let s = PkceSession::new().unwrap();
        let url = s
            .authorization_url(&OAuthConfig::production(), Some("  me@example.com "))
            .unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("api.paparats.app"));
        assert_eq!(url.path(), "/oauth/authorize");
        let q = query(&url);
        assert_eq!(q["response_type"], "code");
        assert_eq!(q["client_id"], "paparats-desktop");
        assert_eq!(q["redirect_uri"], "paparats://auth/callback");
        assert_eq!(q["code_challenge"], s.code_challenge());
        assert_eq!(q["code_challenge_method"], "S256");
        assert_eq!(q["state"], s.state());
        assert_eq!(q["login_hint"], "me@example.com");
        assert!(!q.contains_key("scope"));
        assert!(!url.as_str().contains(s.code_verifier().expose()));

        let mut config = OAuthConfig::production();
        config.scope = Some("profile offline_access".into());
        let q = query(&s.authorization_url(&config, Some(" ")).unwrap());
        assert_eq!(q["scope"], "profile offline_access");
        assert!(!q.contains_key("login_hint"));
    }

    #[test]
    fn callback_gives_the_code_only_for_its_own_state() {
        let s = PkceSession::from_parts("v".repeat(64), "state-1".into());
        let ok = callback("paparats://auth/callback?code=abc&state=state-1").unwrap();
        assert_eq!(s.authorization_code(&ok).unwrap().expose(), "abc");
        let other = callback("paparats://auth/callback?code=abc&state=state-2").unwrap();
        assert!(matches!(
            s.authorization_code(&other),
            Err(AuthError::StateMismatch)
        ));
        let denied = callback(
            "paparats://auth/callback?error=access_denied&error_description=No&state=state-1",
        )
        .unwrap();
        assert!(denied.is_error());
        assert!(
            matches!(s.authorization_code(&denied), Err(AuthError::Denied(c)) if c == "access_denied")
        );
        // An error for another attempt is a mismatch, not a denial of this one.
        let foreign = callback("paparats://auth/callback?error=access_denied&state=x").unwrap();
        assert!(matches!(
            s.authorization_code(&foreign),
            Err(AuthError::StateMismatch)
        ));
    }

    #[test]
    fn callback_shape_is_checked() {
        assert!(callback("PAPARATS://Auth/callback/?code=a&state=s").is_ok());
        for raw in [
            "paparats://app/obs?code=a&state=s",
            "paparats://auth/other?code=a&state=s",
            "paparats://auth/callback/extra?code=a&state=s",
            "https://auth/callback?code=a&state=s",
            "paparats://user@auth/callback?code=a&state=s",
        ] {
            assert!(
                matches!(callback(raw), Err(AuthError::NotCallback)),
                "{raw}"
            );
        }
        for raw in [
            "paparats://auth/callback?code=a",
            "paparats://auth/callback?code=a&state=",
            "paparats://auth/callback?state=s",
            "paparats://auth/callback?code=&state=s",
            "paparats://auth/callback?code=a&state=s&state=t",
            "paparats://auth/callback?code=a&code=b&state=s",
        ] {
            assert!(
                matches!(callback(raw), Err(AuthError::MalformedCallback(_))),
                "{raw}"
            );
        }
        let long = format!("paparats://auth/callback?state=s&code={}", "c".repeat(3000));
        assert!(matches!(
            callback(&long),
            Err(AuthError::MalformedCallback(_))
        ));
    }

    #[test]
    fn callback_debug_hides_code_and_state() {
        let c = callback("paparats://auth/callback?code=secret-code&state=secret-state").unwrap();
        let text = format!("{c:?}");
        assert!(!text.contains("secret"));
        assert_eq!(c.state(), "secret-state");
    }
}
