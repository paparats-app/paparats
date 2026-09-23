//! The account service: profile, devices, two-factor, the Pro subscription and the idea
//! thank-you gift, sign-in state. The account snapshot lives in `paparats-storage`
//! ([`AccountStore`]). Signing in is either the prototype's local sign-in ([`Auth::Simulated`],
//! the default) or, with `PAPARATS_REAL=account`, OAuth 2 PKCE through the system browser with
//! tokens in the Windows Credential Manager ([`Auth::Real`], see [`auth`]). Passwords and tokens
//! are never stored in the database or logged.

pub mod auth;
mod flags;

use std::sync::Arc;

use paparats_core::dates::{self, DateError};
use paparats_core::{Account, IDEA_BONUS_MONTHS, PlanId, Profile, ProfilePatch};
use paparats_storage::{Storage, StorageError};

pub use auth::{AuthError, OAuthAccount, OAuthConfig};
pub use flags::{Auth, from_flags};

#[derive(Debug, thiserror::Error)]
pub enum AccountError {
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("{0} not found")]
    NotFound(String),
    #[error(transparent)]
    Storage(StorageError),
    #[error(transparent)]
    Date(#[from] DateError),
}

impl From<StorageError> for AccountError {
    fn from(e: StorageError) -> Self {
        match e {
            StorageError::NotFound(what) => Self::NotFound(what),
            other => Self::Storage(other),
        }
    }
}

pub type Result<T> = std::result::Result<T, AccountError>;

/// The trimmed text, or `Invalid` when it is empty.
fn required(value: &str, what: &str) -> Result<String> {
    let text = value.trim();
    if text.is_empty() {
        Err(AccountError::Invalid(format!("{what} is empty")))
    } else {
        Ok(text.to_owned())
    }
}

/// Account operations over the local database. Every mutation returns the new account.
#[derive(Debug, Clone)]
pub struct AccountStore {
    storage: Arc<Storage>,
}

impl AccountStore {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self { storage }
    }

    pub fn get(&self) -> Result<Account> {
        Ok(self.storage.account()?)
    }

    /// Saves the editable profile fields (trimmed; both required).
    pub fn update_profile(&self, patch: &ProfilePatch) -> Result<Account> {
        let name = required(&patch.name, "name")?;
        let email = required(&patch.email, "email")?;
        self.storage.update_account(|a| {
            a.profile.name = name;
            a.profile.email = email;
            Ok::<_, AccountError>(())
        })
    }

    /// Signs a device out of the account. This PC cannot be removed.
    pub fn remove_device(&self, device_id: &str) -> Result<Account> {
        self.storage.update_account(|a| {
            let at = a
                .devices
                .iter()
                .position(|d| d.id == device_id)
                .ok_or_else(|| AccountError::NotFound(format!("device {device_id}")))?;
            if a.devices[at].current {
                return Err(AccountError::Invalid("this PC cannot be removed".into()));
            }
            a.devices.remove(at);
            Ok(())
        })
    }

    pub fn set_two_factor(&self, enabled: bool) -> Result<Account> {
        self.storage.update_account(|a| {
            a.two_factor = enabled;
            Ok::<_, AccountError>(())
        })
    }

    /// Buys (or switches to) a paid plan; it renews one period after `today`
    /// (2026-09-15 → 2026-10-15 monthly, 2027-09-15 yearly).
    pub fn purchase(&self, plan: PlanId, today: &str) -> Result<Account> {
        let renews_on = match plan {
            PlanId::Monthly => dates::add_months(today, 1)?,
            PlanId::Yearly => dates::add_years(today, 1)?,
            PlanId::Free => {
                return Err(AccountError::Invalid(
                    "the free plan cannot be purchased".into(),
                ));
            }
        };
        self.storage.update_account(|a| {
            a.subscription.plan = plan;
            a.subscription.renews_on = Some(renews_on);
            Ok::<_, AccountError>(())
        })
    }

    /// Back to the free plan (a running idea gift stays).
    pub fn cancel_plan(&self) -> Result<Account> {
        self.storage.update_account(|a| {
            a.subscription.plan = PlanId::Free;
            a.subscription.renews_on = None;
            Ok::<_, AccountError>(())
        })
    }

    /// Activates the Pro thank-you for a released idea: until `today` + 3 months.
    pub fn claim_idea_bonus(&self, today: &str) -> Result<Account> {
        let until = dates::add_months(today, IDEA_BONUS_MONTHS)?;
        self.storage.update_account(|a| {
            a.subscription.gift_until = Some(until);
            Ok::<_, AccountError>(())
        })
    }

    /// The simulated sign-in: signs in as `email` (trimmed, required). The password never reaches
    /// this crate; real sign-in happens in the browser ([`OAuthAccount`]).
    pub fn sign_in(&self, email: &str) -> Result<Account> {
        let email = required(email, "email")?;
        self.storage.update_account(|a| {
            a.profile.email = email;
            a.signed_in = true;
            Ok::<_, AccountError>(())
        })
    }

    pub fn sign_out(&self) -> Result<Account> {
        self.storage.update_account(|a| {
            a.signed_in = false;
            Ok::<_, AccountError>(())
        })
    }

    /// Signs in with the profile the account API returned (real sign-in): the profile is
    /// replaced, the account marked signed in. Devices, activity and subscription stay local.
    pub fn apply_remote_profile(&self, profile: Profile) -> Result<Account> {
        self.storage.update_account(|a| {
            a.profile = profile;
            a.signed_in = true;
            Ok::<_, AccountError>(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TODAY: &str = "2026-09-15";

    fn store() -> AccountStore {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        storage.seed_from_fixtures().unwrap();
        AccountStore::new(storage)
    }

    #[test]
    fn profile_edits_are_trimmed_and_required() {
        let s = store();
        let a = s
            .update_profile(&ProfilePatch {
                name: "  Ales K ".into(),
                email: " ales@example.com ".into(),
            })
            .unwrap();
        assert_eq!(a.profile.name, "Ales K");
        assert_eq!(a.profile.email, "ales@example.com");
        assert_eq!(a.profile.since, "2024-09-12", "other fields untouched");
        assert!(matches!(
            s.update_profile(&ProfilePatch {
                name: "   ".into(),
                email: "x@y".into()
            }),
            Err(AccountError::Invalid(_))
        ));
        assert_eq!(s.get().unwrap().profile.name, "Ales K");
    }

    #[test]
    fn devices_except_this_pc_can_be_removed() {
        let s = store();
        let a = s.remove_device("dev-2").unwrap();
        assert_eq!(a.devices.len(), 1);
        assert!(matches!(
            s.remove_device("dev-1"),
            Err(AccountError::Invalid(_))
        ));
        assert!(matches!(
            s.remove_device("dev-9"),
            Err(AccountError::NotFound(_))
        ));
        assert_eq!(s.get().unwrap().devices.len(), 1);
    }

    #[test]
    fn two_factor_toggles() {
        let s = store();
        assert!(!s.set_two_factor(false).unwrap().two_factor);
        assert!(s.set_two_factor(true).unwrap().two_factor);
    }

    #[test]
    fn plans_renew_one_period_from_today() {
        let s = store();
        let a = s.purchase(PlanId::Monthly, TODAY).unwrap();
        assert_eq!(a.subscription.plan, PlanId::Monthly);
        assert_eq!(a.subscription.renews_on.as_deref(), Some("2026-10-15"));
        let a = s.purchase(PlanId::Yearly, TODAY).unwrap();
        assert_eq!(a.subscription.renews_on.as_deref(), Some("2027-09-15"));
        let a = s.purchase(PlanId::Monthly, "2027-01-31").unwrap();
        assert_eq!(a.subscription.renews_on.as_deref(), Some("2027-02-28"));
        assert!(matches!(
            s.purchase(PlanId::Free, TODAY),
            Err(AccountError::Invalid(_))
        ));
        assert!(matches!(
            s.purchase(PlanId::Monthly, "not a date"),
            Err(AccountError::Date(_))
        ));
        let a = s.cancel_plan().unwrap();
        assert_eq!(a.subscription.plan, PlanId::Free);
        assert_eq!(a.subscription.renews_on, None);
    }

    #[test]
    fn idea_bonus_runs_three_months_and_survives_cancel() {
        let s = store();
        let a = s.claim_idea_bonus(TODAY).unwrap();
        assert_eq!(a.subscription.gift_until.as_deref(), Some("2026-12-15"));
        let a = s.cancel_plan().unwrap();
        assert_eq!(a.subscription.gift_until.as_deref(), Some("2026-12-15"));
    }

    #[test]
    fn sign_in_and_out() {
        let s = store();
        let a = s.sign_out().unwrap();
        assert!(!a.signed_in);
        let a = s.sign_in("  new@example.com ").unwrap();
        assert!(a.signed_in);
        assert_eq!(a.profile.email, "new@example.com");
        assert!(matches!(s.sign_in(" "), Err(AccountError::Invalid(_))));
    }

    #[test]
    fn remote_profile_signs_in() {
        let s = store();
        s.sign_out().unwrap();
        let before = s.get().unwrap();
        let profile = Profile {
            name: "Remote Name".into(),
            email: "remote@example.com".into(),
            since: "2023-01-02".into(),
            ..before.profile.clone()
        };
        let a = s.apply_remote_profile(profile.clone()).unwrap();
        assert!(a.signed_in);
        assert_eq!(a.profile, profile);
        assert_eq!(a.devices, before.devices, "local parts untouched");
        assert_eq!(a.subscription, before.subscription);
    }

    #[test]
    fn missing_account_is_not_found() {
        let s = AccountStore::new(Arc::new(Storage::open_in_memory().unwrap()));
        assert!(matches!(s.get(), Err(AccountError::NotFound(_))));
        assert!(matches!(
            s.set_two_factor(true),
            Err(AccountError::NotFound(_))
        ));
    }
}
