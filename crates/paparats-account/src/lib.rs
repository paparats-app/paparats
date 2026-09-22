//! Account sign-in (OAuth 2 PKCE via the system browser) and Credential Manager storage.

pub use paparats_core::PRODUCT_NAME;

#[cfg(test)]
mod tests {
    #[test]
    fn links_core() {
        assert_eq!(super::PRODUCT_NAME, "Paparats");
    }
}
