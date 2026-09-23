//! Access and refresh tokens: the token endpoint's answer (RFC 6749 §5.1), expiry, and the blob
//! kept in the credential store.

use serde::{Deserialize, Serialize};

use super::{AuthError, AuthResult, Secret};

/// Refresh this long before the access token expires.
pub const REFRESH_MARGIN_SECS: u64 = 60;
/// Longest lifetime taken from `expires_in` (keeps the arithmetic sane for odd servers).
const MAX_EXPIRES_IN: u64 = 10 * 365 * 24 * 3600;

/// The tokens of one signed-in user. `Debug` shows no token text.
#[derive(Debug, Clone)]
pub struct TokenSet {
    pub access_token: Secret,
    /// Absent when the server issued none (the session then ends with the access token).
    pub refresh_token: Option<Secret>,
    /// When the access token expires, in seconds since the Unix epoch; `None` when the server
    /// did not say (the token is used until the API answers 401).
    pub expires_at: Option<u64>,
}

impl TokenSet {
    /// Whether the access token is missing or expires within [`REFRESH_MARGIN_SECS`] of `now`.
    pub fn needs_refresh(&self, now: u64) -> bool {
        self.access_token.is_empty()
            || self
                .expires_at
                .is_some_and(|at| at <= now.saturating_add(REFRESH_MARGIN_SECS))
    }
}

/// Seconds since the Unix epoch (0 for a clock set before 1970).
pub(crate) fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default()
}

/// `expires_in` as a JSON number or, from lenient servers, a numeric string.
#[derive(Deserialize)]
#[serde(untagged)]
enum Seconds {
    Number(u64),
    Text(String),
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    #[serde(default)]
    expires_in: Option<Seconds>,
    #[serde(default)]
    refresh_token: Option<String>,
}

/// Parses a successful token response. A refresh answer without a `refresh_token` keeps
/// `previous_refresh` (RFC 6749 §6).
pub(crate) fn parse_token_response(
    body: &[u8],
    now: u64,
    previous_refresh: Option<&Secret>,
) -> AuthResult<TokenSet> {
    // serde_json's messages name positions, never the input; still, say only what was wrong.
    let answer: TokenResponse = serde_json::from_slice(body)
        .map_err(|_| AuthError::Protocol("token response is not the expected JSON".into()))?;
    if !answer.token_type.eq_ignore_ascii_case("bearer") {
        return Err(AuthError::Protocol(format!(
            "token type {} is not Bearer",
            super::sanitize_code(&answer.token_type)
        )));
    }
    if answer.access_token.is_empty() {
        return Err(AuthError::Protocol("empty access token".into()));
    }
    let expires_in = match answer.expires_in {
        None => None,
        Some(Seconds::Number(n)) => Some(n),
        Some(Seconds::Text(text)) => Some(
            text.trim()
                .parse::<u64>()
                .map_err(|_| AuthError::Protocol("expires_in is not a number".into()))?,
        ),
    };
    let refresh_token = match answer.refresh_token.filter(|t| !t.is_empty()) {
        Some(token) => Some(Secret::new(token)),
        None => previous_refresh.cloned(),
    };
    Ok(TokenSet {
        access_token: Secret::new(answer.access_token),
        refresh_token,
        expires_at: expires_in.map(|secs| now.saturating_add(secs.min(MAX_EXPIRES_IN))),
    })
}

/// The credential blob: UTF-8 JSON. The access token is left out when the whole would not fit
/// (`max_len`, the Credential Manager's 2560 bytes) — it is short-lived and is refreshed after a
/// restart; the refresh token must fit.
#[derive(Serialize, Deserialize)]
struct Stored {
    v: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    access: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    refresh: Option<String>,
    #[serde(default, rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    expires_at: Option<u64>,
}

const BLOB_VERSION: u8 = 1;

pub(crate) fn encode(tokens: &TokenSet, max_len: usize) -> AuthResult<Vec<u8>> {
    let mut stored = Stored {
        v: BLOB_VERSION,
        access: Some(tokens.access_token.expose().to_owned()),
        refresh: tokens.refresh_token.as_ref().map(|t| t.expose().to_owned()),
        expires_at: tokens.expires_at,
    };
    let to_bytes = |s: &Stored| {
        serde_json::to_vec(s).map_err(|_| AuthError::Credentials("cannot encode tokens".into()))
    };
    let blob = to_bytes(&stored)?;
    if blob.len() <= max_len {
        return Ok(blob);
    }
    if stored.refresh.is_none() {
        return Err(AuthError::Credentials("tokens do not fit the store".into()));
    }
    stored.access = None;
    stored.expires_at = None;
    let blob = to_bytes(&stored)?;
    if blob.len() <= max_len {
        Ok(blob)
    } else {
        Err(AuthError::Credentials(
            "refresh token does not fit the store".into(),
        ))
    }
}

pub(crate) fn decode(blob: &[u8]) -> AuthResult<TokenSet> {
    let stored: Stored = serde_json::from_slice(blob)
        .map_err(|_| AuthError::Credentials("stored tokens are unreadable".into()))?;
    if stored.v != BLOB_VERSION {
        return Err(AuthError::Credentials(format!(
            "stored tokens have version {}",
            stored.v
        )));
    }
    let access = stored.access.unwrap_or_default();
    Ok(TokenSet {
        // No access token stored: an expiry in the past makes the first use refresh.
        expires_at: if access.is_empty() {
            Some(0)
        } else {
            stored.expires_at
        },
        access_token: Secret::new(access),
        refresh_token: stored.refresh.filter(|t| !t.is_empty()).map(Secret::new),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: u64 = 1_790_000_000;

    fn set(access: &str, refresh: Option<&str>, expires_at: Option<u64>) -> TokenSet {
        TokenSet {
            access_token: Secret::new(access),
            refresh_token: refresh.map(Secret::new),
            expires_at,
        }
    }

    #[test]
    fn parses_a_bearer_answer() {
        let t = parse_token_response(
            br#"{"access_token":"at","token_type":"bearer","expires_in":3600,"refresh_token":"rt","scope":"x"}"#,
            NOW,
            None,
        )
        .unwrap();
        assert_eq!(t.access_token.expose(), "at");
        assert_eq!(t.refresh_token.unwrap().expose(), "rt");
        assert_eq!(t.expires_at, Some(NOW + 3600));
    }

    #[test]
    fn refresh_answer_without_refresh_token_keeps_the_old_one() {
        let old = Secret::new("rt-old");
        let t = parse_token_response(
            br#"{"access_token":"at2","token_type":"Bearer","expires_in":"120"}"#,
            NOW,
            Some(&old),
        )
        .unwrap();
        assert_eq!(t.refresh_token.unwrap().expose(), "rt-old");
        assert_eq!(t.expires_at, Some(NOW + 120));
        let t = parse_token_response(br#"{"access_token":"a","token_type":"Bearer"}"#, NOW, None)
            .unwrap();
        assert!(t.refresh_token.is_none());
        assert_eq!(t.expires_at, None);
    }

    #[test]
    fn rejects_odd_answers_without_echoing_them() {
        for body in [
            &br#"{"access_token":"at-secret","token_type":"mac"}"#[..],
            br#"{"access_token":"","token_type":"Bearer"}"#,
            br#"{"token_type":"Bearer"}"#,
            br#"{"access_token":"at-secret","token_type":"Bearer","expires_in":"soon"}"#,
            b"<html>at-secret</html>",
        ] {
            let e = parse_token_response(body, NOW, None).unwrap_err();
            assert!(matches!(e, AuthError::Protocol(_)));
            assert!(!e.to_string().contains("secret"), "{e}");
        }
    }

    #[test]
    fn expiry_margin() {
        assert!(!set("a", None, None).needs_refresh(NOW));
        assert!(!set("a", None, Some(NOW + 61)).needs_refresh(NOW));
        assert!(set("a", None, Some(NOW + 60)).needs_refresh(NOW));
        assert!(set("a", None, Some(NOW - 5)).needs_refresh(NOW));
        assert!(set("", Some("r"), None).needs_refresh(NOW));
        assert!(!set("a", None, Some(NOW + 3600)).needs_refresh(NOW));
    }

    #[test]
    fn blob_round_trip() {
        let t = set("at", Some("rt"), Some(NOW));
        let back = decode(&encode(&t, 2560).unwrap()).unwrap();
        assert_eq!(back.access_token.expose(), "at");
        assert_eq!(back.refresh_token.unwrap().expose(), "rt");
        assert_eq!(back.expires_at, Some(NOW));
        let back = decode(&encode(&set("at", None, None), 2560).unwrap()).unwrap();
        assert!(back.refresh_token.is_none());
        assert_eq!(back.expires_at, None);
    }

    #[test]
    fn oversized_access_token_is_left_out() {
        let big = "a".repeat(3000);
        let blob = encode(&set(&big, Some("rt"), Some(NOW)), 2560).unwrap();
        assert!(blob.len() <= 2560);
        let back = decode(&blob).unwrap();
        assert!(back.access_token.is_empty());
        assert_eq!(back.refresh_token.as_ref().unwrap().expose(), "rt");
        assert!(back.needs_refresh(NOW));
        assert!(matches!(
            encode(&set(&big, None, None), 2560),
            Err(AuthError::Credentials(_))
        ));
        assert!(matches!(
            encode(&set("a", Some(&big), None), 2560),
            Err(AuthError::Credentials(_))
        ));
    }

    #[test]
    fn unreadable_blobs() {
        assert!(matches!(decode(b"nope"), Err(AuthError::Credentials(_))));
        assert!(matches!(
            decode(br#"{"v":9,"access":"a"}"#),
            Err(AuthError::Credentials(_))
        ));
    }
}
