//! SystemService (the parts with a Rust side). The client's own update check runs through
//! tauri-plugin-updater in the UI (`services/tauri/system.ts`).

use paparats_core::IsoDate;

use super::AppState;

impl AppState {
    pub fn system_today(&self) -> IsoDate {
        self.today()
    }
}

#[cfg(test)]
mod tests {
    use super::super::testing::{TODAY, state};

    #[tokio::test]
    async fn today() {
        let (s, _) = state();
        assert_eq!(s.system_today(), TODAY);
    }

    #[test]
    fn system_clock_is_a_valid_date() {
        let today = super::super::system_clock()();
        assert!(paparats_core::dates::parse(&today).is_ok(), "{today}");
    }
}
