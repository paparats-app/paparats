//! Installer strategies behind one trait: MSI, EXE silent, MSIX, portable ZIP, simulated.

pub use paparats_core::PRODUCT_NAME;

#[cfg(test)]
mod tests {
    #[test]
    fn links_core() {
        assert_eq!(super::PRODUCT_NAME, "Paparats");
    }
}
