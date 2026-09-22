//! SystemService (the parts with a Rust side).

use std::time::Duration;

use paparats_core::{IsoDate, SelfUpdateCheck};

use super::AppState;

/// Settings › About › Check for updates takes this long in the prototype; kept until the
/// updater (M6) makes a real request, so "Checking…" does not flash.
pub const SELF_UPDATE_CHECK: Duration = Duration::from_millis(1200);

impl AppState {
    pub fn system_today(&self) -> IsoDate {
        self.today()
    }

    /// The Paparats client's own update check. Always up to date until the updater is wired (M6).
    pub async fn check_for_app_update(&self) -> SelfUpdateCheck {
        tokio::time::sleep(SELF_UPDATE_CHECK).await;
        SelfUpdateCheck::UpToDate
    }
}

#[cfg(test)]
mod tests {
    use super::super::testing::{TODAY, state};
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn today_and_self_update() {
        let (s, _) = state();
        assert_eq!(s.system_today(), TODAY);
        let start = tokio::time::Instant::now();
        assert_eq!(s.check_for_app_update().await, SelfUpdateCheck::UpToDate);
        assert_eq!(start.elapsed(), SELF_UPDATE_CHECK);
    }

    #[test]
    fn system_clock_is_a_valid_date() {
        let today = super::super::system_clock()();
        assert!(paparats_core::dates::parse(&today).is_ok(), "{today}");
    }
}
