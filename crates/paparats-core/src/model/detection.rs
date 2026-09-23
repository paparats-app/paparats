//! How the inventory recognises an installed copy of a catalog app on this PC (M7): rules over
//! the Windows Uninstall entries (HKCU, HKLM, WOW6432Node) and MSIX/AppX packages.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Detection rules of one app. Every matcher is optional; an app without rules is only found where
/// Paparats extracted it itself (portable apps).
/// All comparisons are case-insensitive.
///
/// An Uninstall entry is the app when its key name is one of `product_codes`, or when its
/// `DisplayName` matches (`display_names` or `display_name_regex`) and its `Publisher` contains
/// `publisher` (when set). An MSIX package is the app when its family name is one of
/// `msix_family_names`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppDetection {
    /// Uninstall-entry `DisplayName`s, compared after trailing versions and architecture tags are
    /// stripped from the entry (`7-Zip 25.01 (x64)` and `LocalSend version 1.17.0` read as
    /// `7-Zip` and `LocalSend`).
    pub display_names: Vec<String>,
    /// A regular expression the whole `DisplayName` must match (Rust `regex` syntax), for names
    /// the list cannot express.
    pub display_name_regex: Option<String>,
    /// Text the entry's `Publisher` must contain; guards generic names (`Everything` → `voidtools`).
    /// Applies to name matches only.
    pub publisher: Option<String>,
    /// Uninstall key names: MSI product codes (`{GUID}`), Inno Setup ids (`{GUID}_is1`) or fixed
    /// names (`Notepad++`). A key-name match needs neither name nor publisher.
    pub product_codes: Vec<String>,
    /// MSIX/AppX package family names (`Name_PublisherHash`).
    pub msix_family_names: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_shape_is_symmetric() {
        let d = AppDetection {
            display_names: vec!["7-Zip".into()],
            display_name_regex: None,
            publisher: Some("Igor Pavlov".into()),
            product_codes: vec!["7-Zip".into()],
            msix_family_names: vec![],
        };
        let json = serde_json::to_value(&d).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "displayNames": ["7-Zip"],
                "displayNameRegex": null,
                "publisher": "Igor Pavlov",
                "productCodes": ["7-Zip"],
                "msixFamilyNames": []
            })
        );
        let back: AppDetection = serde_json::from_value(json).unwrap();
        assert_eq!(back, d);
    }
}
