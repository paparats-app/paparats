//! Local persistence: SQLite cache, inventory and activity; settings JSON.

pub use paparats_core::PRODUCT_NAME;

#[cfg(test)]
mod tests {
    #[test]
    fn links_core() {
        assert_eq!(super::PRODUCT_NAME, "Paparats");
    }
}
