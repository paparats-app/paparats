//! AccountService. Profile data and passwords are never logged.

use paparats_core::{Account, PlanId, ProfilePatch};

use super::AppState;
use crate::error::AppResult;

impl AppState {
    pub fn get_account(&self) -> AppResult<Account> {
        Ok(self.account.get()?)
    }

    pub fn update_profile(&self, patch: &ProfilePatch) -> AppResult<Account> {
        Ok(self.account.update_profile(patch)?)
    }

    pub fn remove_device(&self, device_id: &str) -> AppResult<Account> {
        Ok(self.account.remove_device(device_id)?)
    }

    pub fn set_two_factor(&self, enabled: bool) -> AppResult<Account> {
        Ok(self.account.set_two_factor(enabled)?)
    }

    /// Buys (or switches to) a paid plan; renews one period from today. `free` is `invalid`.
    pub fn purchase_plan(&self, plan: PlanId) -> AppResult<Account> {
        Ok(self.account.purchase(plan, &self.today())?)
    }

    pub fn cancel_plan(&self) -> AppResult<Account> {
        Ok(self.account.cancel_plan()?)
    }

    /// The 3-month Pro thank-you for a released idea, from today.
    pub fn claim_idea_bonus(&self) -> AppResult<Account> {
        Ok(self.account.claim_idea_bonus(&self.today())?)
    }

    /// Mock sign-in: any password is accepted (the account API arrives in M7). The password is
    /// dropped here and never stored or logged.
    pub fn sign_in(&self, email: &str, _password: &str) -> AppResult<Account> {
        Ok(self.account.sign_in(email)?)
    }

    pub fn sign_out(&self) -> AppResult<Account> {
        Ok(self.account.sign_out()?)
    }
}

#[cfg(test)]
mod tests {
    use super::super::testing::state;
    use super::*;
    use crate::error::AppError;

    #[tokio::test]
    async fn account_flow() {
        let (s, _) = state();
        let a = s
            .update_profile(&ProfilePatch {
                name: "Serj K".into(),
                email: "serj@example.com".into(),
            })
            .unwrap();
        assert_eq!(a.profile.name, "Serj K");
        assert!(matches!(
            s.remove_device("dev-1"),
            Err(AppError::Invalid(_))
        ));
        assert_eq!(s.remove_device("dev-2").unwrap().devices.len(), 1);
        assert!(matches!(
            s.remove_device("dev-2"),
            Err(AppError::NotFound(_))
        ));
        assert!(!s.set_two_factor(false).unwrap().two_factor);

        let a = s.purchase_plan(PlanId::Yearly).unwrap();
        assert_eq!(a.subscription.renews_on.as_deref(), Some("2027-09-15"));
        assert!(matches!(
            s.purchase_plan(PlanId::Free),
            Err(AppError::Invalid(_))
        ));
        assert_eq!(s.cancel_plan().unwrap().subscription.plan, PlanId::Free);
        let a = s.claim_idea_bonus().unwrap();
        assert_eq!(a.subscription.gift_until.as_deref(), Some("2026-12-15"));

        assert!(!s.sign_out().unwrap().signed_in);
        let a = s.sign_in(" me@example.com ", "hunter2").unwrap();
        assert!(a.signed_in);
        assert_eq!(a.profile.email, "me@example.com");
        assert!(matches!(s.sign_in("", "x"), Err(AppError::Invalid(_))));
        assert_eq!(s.get_account().unwrap().profile.email, "me@example.com");
    }
}
