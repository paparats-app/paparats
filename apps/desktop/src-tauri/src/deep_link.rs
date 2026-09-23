//! `paparats://` links (tauri-plugin-deep-link): what a link asks for, parsed without trusting it.
//!
//! - `paparats://app/<id>` and `paparats://channel/<id>` open that page (the UI navigates on a
//!   [`DeepLinkEvent`]);
//! - `paparats://auth/callback?…` is the browser sign-in return (OAuth 2 PKCE, M7): handed to the
//!   account flow when real sign-in is on (`PAPARATS_REAL=account`), ignored otherwise; never
//!   logged or printed with its query (it carries the authorization code, see [`AuthCallback`]).
//!
//! Anything else is ignored. Ids are catalog slugs: ASCII letters, digits, `.`, `_`, `-`, starting
//! with a letter or digit, at most [`MAX_ID_LEN`] characters; letters are lowercased.

use serde::{Deserialize, Serialize};
use tauri::Url;

/// The scheme registered for the app (NSIS installer; at runtime in development builds).
pub const SCHEME: &str = "paparats";

/// Longest accepted app or channel id.
pub const MAX_ID_LEN: usize = 64;

/// A page a `paparats://` link opens.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", content = "id", rename_all = "camelCase")]
pub enum DeepLinkTarget {
    /// `paparats://app/<id>` — the app page.
    App(String),
    /// `paparats://channel/<id>` — the channel page.
    Channel(String),
}

/// What a link asks for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeepLink {
    Open(DeepLinkTarget),
    /// `paparats://auth/callback?…` — the browser sign-in return.
    AuthCallback(AuthCallback),
}

/// The sign-in return link, whole (the account flow checks its shape and state). Its `Debug`
/// never shows the link: the query holds the authorization code.
#[derive(Clone, PartialEq, Eq)]
pub struct AuthCallback(Url);

impl AuthCallback {
    pub fn url(&self) -> &Url {
        &self.0
    }
}

impl std::fmt::Debug for AuthCallback {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("AuthCallback(<redacted>)")
    }
}

/// Why a link was ignored (logged by kind only: the link itself may carry anything).
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum DeepLinkError {
    #[error("not a paparats:// link")]
    Scheme,
    #[error("unsupported paparats:// link")]
    Unsupported,
    #[error("malformed id in a paparats:// link")]
    Id,
}

/// Parses a link handed over by Windows (first launch argument or a second instance).
pub fn parse(url: &Url) -> Result<DeepLink, DeepLinkError> {
    if !url.scheme().eq_ignore_ascii_case(SCHEME) {
        return Err(DeepLinkError::Scheme);
    }
    // `paparats://app/obs`: the kind is the host, the id the only path segment (a trailing slash
    // is fine). `paparats:app/obs` has no host and is not a link we hand out.
    let kind = url
        .host_str()
        .ok_or(DeepLinkError::Unsupported)?
        .to_ascii_lowercase();
    let mut segments = url
        .path_segments()
        .into_iter()
        .flatten()
        .filter(|s| !s.is_empty());
    let first = segments.next();
    if segments.next().is_some() {
        return Err(DeepLinkError::Unsupported);
    }
    match (kind.as_str(), first) {
        ("app", Some(id)) => Ok(DeepLink::Open(DeepLinkTarget::App(slug(id)?))),
        ("channel", Some(id)) => Ok(DeepLink::Open(DeepLinkTarget::Channel(slug(id)?))),
        ("auth", Some(step)) if step.eq_ignore_ascii_case("callback") => {
            Ok(DeepLink::AuthCallback(AuthCallback(url.clone())))
        }
        _ => Err(DeepLinkError::Unsupported),
    }
}

/// A catalog id: the segment as written (no percent-decoding — ids never need it), lowercased.
fn slug(segment: &str) -> Result<String, DeepLinkError> {
    let valid = !segment.is_empty()
        && segment.len() <= MAX_ID_LEN
        && segment
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphanumeric())
        && segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
    if valid {
        Ok(segment.to_ascii_lowercase())
    } else {
        Err(DeepLinkError::Id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parses a raw command-line argument.
    fn parse_str(raw: &str) -> Result<DeepLink, DeepLinkError> {
        let url = Url::parse(raw.trim()).map_err(|_| DeepLinkError::Scheme)?;
        parse(&url)
    }

    fn open(raw: &str) -> Option<DeepLinkTarget> {
        match parse_str(raw) {
            Ok(DeepLink::Open(target)) => Some(target),
            _ => None,
        }
    }

    #[test]
    fn app_and_channel_links() {
        assert_eq!(
            open("paparats://app/obs"),
            Some(DeepLinkTarget::App("obs".into()))
        );
        assert_eq!(
            open("paparats://channel/nilesoft"),
            Some(DeepLinkTarget::Channel("nilesoft".into()))
        );
        // Trailing slash, query and fragment do not matter; case is normalised.
        assert_eq!(
            open("paparats://app/vscode/?utm=x#top"),
            Some(DeepLinkTarget::App("vscode".into()))
        );
        assert_eq!(
            open("PAPARATS://App/NotepadPP"),
            Some(DeepLinkTarget::App("notepadpp".into()))
        );
        assert_eq!(
            open("  paparats://channel/foss-friends_2.0  "),
            Some(DeepLinkTarget::Channel("foss-friends_2.0".into()))
        );
    }

    #[test]
    fn sign_in_return_is_recognised() {
        let raw = "paparats://auth/callback?code=secret&state=xyz";
        let Ok(DeepLink::AuthCallback(callback)) = parse_str(raw) else {
            panic!("not a callback");
        };
        assert_eq!(callback.url().as_str(), raw, "handed over whole");
        let shown = format!("{:?}", DeepLink::AuthCallback(callback.clone()));
        assert!(
            !shown.contains("secret") && !shown.contains("xyz"),
            "{shown}"
        );
        assert_eq!(callback.url().query(), Some("code=secret&state=xyz"));
        assert!(matches!(
            parse_str("paparats://auth/callback/"),
            Ok(DeepLink::AuthCallback(_))
        ));
        assert_eq!(
            parse_str("paparats://auth/logout"),
            Err(DeepLinkError::Unsupported)
        );
    }

    #[test]
    fn other_schemes_are_not_links() {
        for raw in [
            "https://paparats.app/app/obs",
            "file:///C:/Windows/notepad.exe",
            "--minimized",
            "C:\\Users\\me\\paparats.exe",
            "",
        ] {
            assert_eq!(parse_str(raw), Err(DeepLinkError::Scheme), "{raw}");
        }
    }

    #[test]
    fn unsupported_shapes() {
        for raw in [
            "paparats://",
            "paparats://app",
            "paparats://app/",
            "paparats://app/obs/extra",
            "paparats://settings/about",
            "paparats:app/obs",
            "paparats:///app/obs",
        ] {
            assert_eq!(parse_str(raw), Err(DeepLinkError::Unsupported), "{raw}");
        }
    }

    #[test]
    fn ids_are_slugs() {
        let long = format!("paparats://app/{}", "a".repeat(MAX_ID_LEN + 1));
        let max = format!("paparats://app/{}", "a".repeat(MAX_ID_LEN));
        assert!(open(&max).is_some());
        for raw in [
            long.as_str(),
            "paparats://app/-obs",
            "paparats://app/.hidden",
            "paparats://app/ob%20s",
            "paparats://channel/n%C3%ADlesoft",
            "paparats://app/obs;rm",
        ] {
            assert_eq!(parse_str(raw), Err(DeepLinkError::Id), "{raw}");
        }
        // `..` (also written `%2e%2e`) is a dot-segment the URL parser removes before we see it.
        assert_eq!(
            parse_str("paparats://app/../obs"),
            Ok(DeepLink::Open(DeepLinkTarget::App("obs".into())))
        );
        assert_eq!(
            parse_str("paparats://app/%2e%2e"),
            Err(DeepLinkError::Unsupported)
        );
    }

    #[test]
    fn wire_shape() {
        let json = serde_json::to_value(DeepLinkTarget::Channel("winaero".into())).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"kind": "channel", "id": "winaero"})
        );
    }
}
