//! Domain types shared by the Paparats client: apps, channels, ideas, plans, installed apps,
//! update manifests. Serialisable with serde; exported to TypeScript through tauri-specta.

/// Name of the product, used in logs and user-agent strings.
pub const PRODUCT_NAME: &str = "Paparats";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_name_is_stable() {
        assert_eq!(PRODUCT_NAME, "Paparats");
    }
}
