//! Download engine: queue, concurrency limit, pause/resume via HTTP Range, SHA-256, progress events.

pub use paparats_core::PRODUCT_NAME;

#[cfg(test)]
mod tests {
    #[test]
    fn links_core() {
        assert_eq!(super::PRODUCT_NAME, "Paparats");
    }
}
