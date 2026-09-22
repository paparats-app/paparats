//! Locales and localised content.
//!
//! UI copy lives in the frontend i18n catalogs. Content that a backend would serve (app taglines,
//! channel descriptions, editorial hero slides, idea threads) travels as [`Localized`] maps.

use serde::{Deserialize, Serialize};
use specta::Type;

/// UI languages. All three are first-class.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    En,
    Be,
    Ru,
}

/// One value per UI language.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct Localized<T> {
    pub en: T,
    pub be: T,
    pub ru: T,
}

impl<T> Localized<T> {
    pub fn get(&self, locale: Locale) -> &T {
        match locale {
            Locale::En => &self.en,
            Locale::Be => &self.be,
            Locale::Ru => &self.ru,
        }
    }
}

/// Text that is either translated by its author (catalog content) or written once in whatever
/// language the user typed (user-generated ideas and comments).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(untagged)]
pub enum Text {
    Localized(Localized<String>),
    Plain(String),
}

impl Text {
    pub fn get(&self, locale: Locale) -> &str {
        match self {
            Text::Localized(l) => l.get(locale),
            Text::Plain(s) => s,
        }
    }
}

/// Calendar date as `YYYY-MM-DD` (local, no time zone). Formatting happens in the UI via `Intl`.
pub type IsoDate = String;
