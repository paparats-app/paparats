//! Installed-app discovery (registry Uninstall keys, MSIX) and version comparison.

pub use paparats_core::PRODUCT_NAME;

#[cfg(test)]
mod tests {
    #[test]
    fn links_core() {
        assert_eq!(super::PRODUCT_NAME, "Paparats");
    }
}
