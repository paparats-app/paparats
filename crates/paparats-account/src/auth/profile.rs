//! `GET /v1/me` → [`Profile`].
//!
//! The answer is JSON in camelCase:
//! `{"id", "name", "email", "since" (or "createdAt"), "country", "timezone"}` — `since` is a
//! `YYYY-MM-DD` date or an RFC 3339 timestamp (its calendar date is used); `country` and
//! `timezone` are `{en, be, ru}` maps or one plain string for every language (both optional).
//! A missing or blank name falls back to the email.

use paparats_core::dates;
use paparats_core::{Localized, Profile, Text};
use serde::Deserialize;

use super::{AuthError, AuthResult};

/// Longest user id accepted (it names the Credential Manager entry).
const MAX_USER_ID_LEN: usize = 128;

/// The signed-in user as the account API describes them. `Debug` omits the email and the id.
#[derive(Clone, PartialEq)]
pub struct RemoteProfile {
    /// Stable account id: the Credential Manager account name of the user's tokens.
    pub user_id: String,
    pub profile: Profile,
}

impl std::fmt::Debug for RemoteProfile {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RemoteProfile").finish_non_exhaustive()
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Me {
    id: String,
    #[serde(default)]
    name: Option<String>,
    email: String,
    #[serde(alias = "createdAt")]
    since: String,
    #[serde(default)]
    country: Option<Text>,
    #[serde(default)]
    timezone: Option<Text>,
}

fn protocol(what: &str) -> AuthError {
    AuthError::Protocol(format!("profile {what}"))
}

/// ASCII letters, digits and `-_.:|@`, 1–128 characters.
fn valid_user_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_USER_ID_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':' | '|' | '@'))
}

/// The calendar date of `YYYY-MM-DD` or `YYYY-MM-DDThh:mm:ss…`.
fn calendar_date(raw: &str) -> Option<String> {
    let raw = raw.trim();
    let date = raw.get(..10)?;
    let rest_ok = match raw.as_bytes().get(10) {
        None => true,
        Some(b'T' | b't' | b' ') => true,
        Some(_) => false,
    };
    if !rest_ok {
        return None;
    }
    dates::parse(date).ok().map(dates::format)
}

fn localized(text: Option<Text>) -> Localized<String> {
    match text {
        Some(Text::Localized(l)) => l,
        Some(Text::Plain(s)) => Localized {
            en: s.clone(),
            be: s.clone(),
            ru: s,
        },
        None => Localized {
            en: String::new(),
            be: String::new(),
            ru: String::new(),
        },
    }
}

/// Parses and checks the `/v1/me` answer. Errors never quote it.
pub(crate) fn parse_me(body: &[u8]) -> AuthResult<RemoteProfile> {
    let me: Me = serde_json::from_slice(body).map_err(|_| protocol("is not the expected JSON"))?;
    if !valid_user_id(&me.id) {
        return Err(protocol("has an invalid id"));
    }
    let email = me.email.trim().to_owned();
    if email.is_empty() {
        return Err(protocol("has no email"));
    }
    let since = calendar_date(&me.since).ok_or_else(|| protocol("has an invalid date"))?;
    let name = me
        .name
        .map(|n| n.trim().to_owned())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| email.clone());
    Ok(RemoteProfile {
        user_id: me.id,
        profile: Profile {
            name,
            email,
            since,
            country: localized(me.country),
            timezone: localized(me.timezone),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_a_full_answer() {
        let r = parse_me(
            r#"{"id":"usr_8f2k","name":" Serj Kaje ","email":"serj@example.com","since":"2024-09-12",
                "country":{"en":"Sweden","be":"Швецыя","ru":"Швеция"},
                "timezone":"(UTC+01:00) Stockholm","plan":"free"}"#
                .as_bytes(),
        )
        .unwrap();
        assert_eq!(r.user_id, "usr_8f2k");
        assert_eq!(r.profile.name, "Serj Kaje");
        assert_eq!(r.profile.email, "serj@example.com");
        assert_eq!(r.profile.since, "2024-09-12");
        assert_eq!(r.profile.country.be, "Швецыя");
        assert_eq!(r.profile.timezone.ru, "(UTC+01:00) Stockholm");
        let text = format!("{r:?}");
        assert!(!text.contains("serj") && !text.contains("usr_8f2k"));
    }

    #[test]
    fn lenient_where_it_is_safe() {
        let r = parse_me(
            br#"{"id":"auth0|abc","email":"a@b.c","createdAt":"2024-09-12T23:30:00+02:00"}"#,
        )
        .unwrap();
        assert_eq!(r.profile.since, "2024-09-12");
        assert_eq!(r.profile.name, "a@b.c");
        assert_eq!(r.profile.country.en, "");
    }

    #[test]
    fn rejects_bad_answers() {
        for body in [
            &br#"{"id":"","email":"a@b.c","since":"2024-09-12"}"#[..],
            br#"{"id":"../x","email":"a@b.c","since":"2024-09-12"}"#,
            br#"{"id":"u1","email":" ","since":"2024-09-12"}"#,
            br#"{"id":"u1","email":"a@b.c","since":"12.09.2024"}"#,
            br#"{"id":"u1","email":"a@b.c","since":"2024-09-12X"}"#,
            br#"{"id":"u1","email":"a@b.c"}"#,
            b"not json",
        ] {
            assert!(
                matches!(parse_me(body), Err(AuthError::Protocol(_))),
                "{}",
                String::from_utf8_lossy(body)
            );
        }
        let long = format!(
            r#"{{"id":"{}","email":"a@b.c","since":"2024-09-12"}}"#,
            "u".repeat(129)
        );
        assert!(parse_me(long.as_bytes()).is_err());
    }
}
