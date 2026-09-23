//! A token, code or verifier: readable on purpose only ([`Secret::expose`]), never through
//! `Debug`, `Display` or serde.

use std::fmt;

#[derive(Clone, Default)]
pub struct Secret(String);

impl Secret {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    /// The secret text, for the one place that sends it (a form field, a header, the store).
    pub fn expose(&self) -> &str {
        &self.0
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Secret(<redacted>)")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_never_shows_the_value() {
        let s = Secret::new("at-very-secret");
        assert_eq!(format!("{s:?}"), "Secret(<redacted>)");
        assert!(!format!("{:?}", Some(s.clone())).contains("very-secret"));
        assert_eq!(s.expose(), "at-very-secret");
        assert!(Secret::default().is_empty());
    }
}
