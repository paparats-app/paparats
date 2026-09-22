//! Domain types shared by the Paparats client: apps, channels, ideas, plans, installed apps,
//! update manifests. Serialisable with serde; exported to TypeScript through tauri-specta.

pub mod dates;
pub mod hosts;
pub mod model;
mod num;

pub use num::Num;

pub use model::*;

/// Name of the product, used in logs and user-agent strings.
pub const PRODUCT_NAME: &str = "Paparats";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_name_is_stable() {
        assert_eq!(PRODUCT_NAME, "Paparats");
    }

    #[test]
    fn source_rule_candidates_start_with_home_channel() {
        let app: App = serde_json::from_value(serde_json::json!({
            "id": "shell", "name": "Shell", "publisher": "Nilesoft", "category": "system",
            "tint": "#123456", "mono": "Sh", "version": "1.9.15", "sizeMb": 3.1,
            "updated": "2026-09-01", "license": "MIT", "portable": true, "pro": false,
            "tagline": { "en": "a", "be": "b", "ru": "c" },
            "long": { "en": "a", "be": "b", "ru": "c" },
            "channel": "nilesoft", "alsoIn": ["fossfriends"]
        }))
        .unwrap_or_else(|e| panic!("valid app json: {e}"));
        let c: Vec<&str> = app.candidate_channels().collect();
        assert_eq!(c, ["nilesoft", "fossfriends"]);
    }

    #[test]
    fn text_is_untagged() {
        let plain: Text = serde_json::from_str("\"hi\"").unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(plain.get(Locale::Ru), "hi");
        let loc: Text = serde_json::from_str(r#"{"en":"a","be":"b","ru":"c"}"#)
            .unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(loc.get(Locale::Be), "b");
    }
}
