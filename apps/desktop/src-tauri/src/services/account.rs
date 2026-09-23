//! AccountService. Profile data, passwords, tokens and callback links are never logged.

use paparats_account::AuthError;
use paparats_account::auth::PENDING_TTL;
use paparats_core::{Account, PlanId, ProfilePatch};
use tokio::sync::broadcast::error::RecvError;
use url::Url;

use super::AppState;
use crate::error::{AppError, AppResult};

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

    /// Signs in. Simulated (default): any password is accepted, the account changes at once.
    /// Real (`PAPARATS_REAL=account`): opens the account API's sign-in page in the browser (the
    /// email as a hint) and answers when the browser comes back through
    /// `paparats://auth/callback` ([`AppState::complete_sign_in`]) — or fails after
    /// [`PENDING_TTL`]. The password is dropped either way: it is never stored, sent or logged.
    pub async fn sign_in(&self, email: &str, _password: &str) -> AppResult<Account> {
        let Some(oauth) = self.auth.real() else {
            return Ok(self.account.sign_in(email)?);
        };
        // Listen before the browser opens, so a fast callback cannot be missed.
        let mut finished = self.sign_ins.subscribe();
        let hint = email.trim();
        let url = oauth.begin_sign_in((!hint.is_empty()).then_some(hint))?;
        self.browser
            .open(url.as_str())
            .map_err(|_| AppError::internal_message("could not open the sign-in page"))?;
        let wait = async {
            loop {
                match finished.recv().await {
                    Ok(result) => return result,
                    Err(RecvError::Lagged(_)) => {}
                    Err(RecvError::Closed) => {
                        return Err(AppError::internal_message("sign-in was interrupted"));
                    }
                }
            }
        };
        tokio::time::timeout(PENDING_TTL, wait)
            .await
            .unwrap_or_else(|_| Err(AppError::invalid("sign-in was not completed in time")))
    }

    /// The browser sign-in's return link (`paparats://auth/callback?…`, handed over by the shell
    /// when real sign-in is on). A completed or refused sign-in answers the waiting
    /// [`AppState::sign_in`]; a link that answers no pending sign-in (stale, replayed, forged) is
    /// dropped without disturbing it.
    pub async fn complete_sign_in(&self, callback: &Url) {
        let Some(oauth) = self.auth.real() else {
            tracing::info!("sign-in callback ignored: real sign-in is off");
            return;
        };
        let outcome = match oauth.complete(callback).await {
            Ok(account) => Ok(account),
            Err(
                AuthError::StateMismatch | AuthError::NotCallback | AuthError::MalformedCallback(_),
            ) => {
                return;
            }
            Err(e) => Err(AppError::from(e)),
        };
        // Nobody waiting (the call timed out): a completed sign-in still updated the account. A
        // link from before a restart matches no pending sign-in and was dropped above.
        let _ = self.sign_ins.send(outcome);
    }

    /// Signs out. Real sign-in also revokes and deletes the tokens (best effort offline).
    pub async fn sign_out(&self) -> AppResult<Account> {
        match self.auth.real() {
            Some(oauth) => Ok(oauth.sign_out().await?),
            None => Ok(self.account.sign_out()?),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use paparats_account::auth::MemoryTokenStore;
    use paparats_account::{Auth, OAuthAccount, OAuthConfig};
    use paparats_download::SimulatedTransfer;
    use paparats_install::SimulatedInstaller;
    use paparats_storage::Storage;

    use super::super::testing::{state, state_with};
    use super::super::{Browser, Strategies};
    use super::*;
    use crate::flags::RealFlags;

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

        assert!(!s.sign_out().await.unwrap().signed_in);
        let a = s.sign_in(" me@example.com ", "hunter2").await.unwrap();
        assert!(a.signed_in);
        assert_eq!(a.profile.email, "me@example.com");
        assert!(matches!(
            s.sign_in("", "x").await,
            Err(AppError::Invalid(_))
        ));
        assert_eq!(s.get_account().unwrap().profile.email, "me@example.com");
    }

    #[tokio::test]
    async fn simulated_sign_in_ignores_callbacks() {
        let (s, _) = state();
        let before = s.get_account().unwrap();
        s.complete_sign_in(&"paparats://auth/callback?code=c&state=s".parse().unwrap())
            .await;
        assert_eq!(s.get_account().unwrap(), before);
    }

    /// Records the pages the sign-in opens instead of starting a browser.
    #[derive(Default)]
    struct Pages(Mutex<Vec<String>>);

    impl Browser for Arc<Pages> {
        fn open(&self, url: &str) -> Result<(), String> {
            self.0.lock().unwrap().push(url.to_owned());
            Ok(())
        }
    }

    /// A state with real sign-in against the production API, tokens in memory. The tests below
    /// never reach the network: a refused or foreign callback ends before the token exchange.
    fn real_sign_in() -> (AppState, Arc<Pages>) {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let pages = Arc::new(Pages::default());
        let mut strategies = Strategies::simulated(
            &storage,
            Arc::new(SimulatedTransfer::new()),
            Arc::new(SimulatedInstaller::new()),
        )
        .unwrap();
        let oauth = OAuthAccount::new(
            OAuthConfig::production(),
            Arc::new(MemoryTokenStore::new()),
            Arc::clone(&storage),
        )
        .unwrap();
        strategies.auth = Auth::Real(Arc::new(oauth));
        strategies.browser = Arc::new(Arc::clone(&pages));
        strategies.flags = RealFlags {
            account: true,
            ..RealFlags::default()
        };
        let (s, _) = state_with(storage, strategies);
        (s, pages)
    }

    /// Waits until the sign-in page has been opened; its `state` parameter.
    async fn opened_state(pages: &Pages) -> String {
        for _ in 0..200 {
            if let Some(page) = pages.0.lock().unwrap().first() {
                let url: Url = page.parse().unwrap();
                return url
                    .query_pairs()
                    .find(|(k, _)| k == "state")
                    .map(|(_, v)| v.into_owned())
                    .unwrap();
            }
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
        panic!("the sign-in page was not opened");
    }

    #[tokio::test]
    async fn real_sign_in_opens_the_browser_and_waits_for_the_callback() {
        let (s, pages) = real_sign_in();
        let before = s.get_account().unwrap();
        let s = Arc::new(s);
        let signing_in = {
            let s = Arc::clone(&s);
            tokio::spawn(async move { s.sign_in("me@example.com", "never-sent").await })
        };
        let state = opened_state(&pages).await;
        let page = pages.0.lock().unwrap()[0].clone();
        assert!(page.starts_with("https://api.paparats.app/oauth/authorize?"));
        assert!(page.contains("login_hint=me%40example.com"));
        assert!(!page.contains("never-sent"), "the password goes nowhere");

        // A link for another sign-in (forged, replayed) does not end this one…
        s.complete_sign_in(
            &"paparats://auth/callback?code=x&state=someone-else"
                .parse()
                .unwrap(),
        )
        .await;
        assert!(!signing_in.is_finished());

        // …the browser coming back with a refusal does.
        let denied: Url = format!("paparats://auth/callback?error=access_denied&state={state}")
            .parse()
            .unwrap();
        s.complete_sign_in(&denied).await;
        let result = signing_in.await.unwrap();
        assert!(matches!(result, Err(AppError::Invalid(_))), "{result:?}");
        assert_eq!(
            s.get_account().unwrap(),
            before,
            "a refused sign-in changes nothing"
        );
    }

    #[tokio::test]
    async fn real_sign_out_works_signed_out() {
        let (s, _) = real_sign_in();
        assert!(!s.sign_out().await.unwrap().signed_in);
    }

    #[tokio::test]
    async fn real_sign_in_starts_signed_out_without_a_stored_session() {
        // The mock world is seeded signed in; with real sign-in and no tokens it is not.
        let (s, _) = real_sign_in();
        assert!(!s.get_account().unwrap().signed_in);
        let (simulated, _) = state();
        assert!(simulated.get_account().unwrap().signed_in);
    }
}
