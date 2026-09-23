//! [`OAuthAccount`]: the real sign-in end to end — pending browser sign-ins, the session of the
//! signed-in user (tokens in a [`TokenStore`], the user id in the local database), refresh ahead
//! of expiry, profile, sign-out — mirrored onto the local account snapshot the UI reads.

use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use paparats_core::Account;
use paparats_storage::Storage;
use url::Url;

use super::tokens::unix_now;
use super::{
    AuthError, AuthResult, Callback, OAuthClient, OAuthConfig, PkceSession, RemoteProfile, Secret,
    TokenSet, TokenStore,
};
use crate::AccountStore;

/// `meta` key of the signed-in user's id (not a secret: it names the Credential Manager entry).
pub const USER_ID_META: &str = "account.userId";
/// How long a browser sign-in may take before its callback is refused.
pub const PENDING_TTL: Duration = Duration::from_secs(10 * 60);
/// Sign-ins started at the same time (each click on Sign in opens a new browser page).
const MAX_PENDING: usize = 4;

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    // The guarded values stay consistent between statements, so a panic elsewhere leaves them
    // usable.
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

#[derive(Clone)]
struct Session {
    user_id: String,
    tokens: TokenSet,
}

enum Slot {
    /// Not read from the stores yet (first use restores).
    Unknown,
    SignedOut,
    SignedIn(Session),
}

/// Real sign-in over the account API. Share it behind an `Arc`; every method takes `&self` and
/// the futures are `Send`.
pub struct OAuthAccount {
    client: OAuthClient,
    tokens: Arc<dyn TokenStore>,
    storage: Arc<Storage>,
    account: AccountStore,
    pending: Mutex<Vec<PkceSession>>,
    session: Mutex<Slot>,
    /// Serialises refresh, sign-in completion and sign-out, so a rotated refresh token is never
    /// used twice and a sign-out cannot be undone by a refresh that was in flight.
    gate: tokio::sync::Mutex<()>,
}

impl std::fmt::Debug for OAuthAccount {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OAuthAccount")
            .field("api", &self.client.config().api_base)
            .finish_non_exhaustive()
    }
}

impl OAuthAccount {
    /// `storage` holds the account snapshot and the signed-in user id; `tokens` the tokens.
    pub fn new(
        config: OAuthConfig,
        tokens: Arc<dyn TokenStore>,
        storage: Arc<Storage>,
    ) -> AuthResult<Self> {
        Ok(Self {
            client: OAuthClient::new(config)?,
            tokens,
            account: AccountStore::new(Arc::clone(&storage)),
            storage,
            pending: Mutex::new(Vec::new()),
            session: Mutex::new(Slot::Unknown),
            gate: tokio::sync::Mutex::new(()),
        })
    }

    pub fn client(&self) -> &OAuthClient {
        &self.client
    }

    /// Starts a browser sign-in: the authorization URL to open (`login_hint`: an email the user
    /// already typed). Up to four sign-ins may be pending; each expires after [`PENDING_TTL`].
    pub fn begin_sign_in(&self, login_hint: Option<&str>) -> AuthResult<Url> {
        let attempt = PkceSession::new()?;
        let url = attempt.authorization_url(self.client.config(), login_hint)?;
        let mut pending = lock(&self.pending);
        pending.retain(|p| p.created().elapsed() < PENDING_TTL);
        if pending.len() >= MAX_PENDING {
            pending.remove(0);
        }
        pending.push(attempt);
        tracing::info!("sign-in: authorization page ready");
        Ok(url)
    }

    /// Number of sign-ins waiting for their callback.
    pub fn pending_sign_ins(&self) -> usize {
        let mut pending = lock(&self.pending);
        pending.retain(|p| p.created().elapsed() < PENDING_TTL);
        pending.len()
    }

    /// The pending sign-in `callback` answers, removed (a callback is used once).
    fn take_pending(&self, callback: &Callback) -> AuthResult<PkceSession> {
        let mut pending = lock(&self.pending);
        pending.retain(|p| p.created().elapsed() < PENDING_TTL);
        let at = pending
            .iter()
            .position(|p| p.matches(callback))
            .ok_or(AuthError::StateMismatch)?;
        Ok(pending.remove(at))
    }

    /// Finishes a browser sign-in from its `paparats://auth/callback?…` link: checks the state,
    /// exchanges the code, reads the profile, stores the tokens under the user id and signs the
    /// local account in with that profile.
    pub async fn complete(&self, callback_url: &Url) -> AuthResult<Account> {
        let result = self.complete_inner(callback_url).await;
        match &result {
            Ok(_) => tracing::info!("sign-in: completed"),
            Err(e) => tracing::warn!(error = %e, "sign-in: callback refused"),
        }
        result
    }

    async fn complete_inner(&self, callback_url: &Url) -> AuthResult<Account> {
        let callback = Callback::parse(callback_url, &self.client.config().redirect_uri)?;
        let attempt = self.take_pending(&callback)?;
        let code = attempt.authorization_code(&callback)?;
        let tokens = self
            .client
            .exchange_code(&code, attempt.code_verifier())
            .await?;
        let remote = self.client.me(&tokens.access_token).await?;
        let _gate = self.gate.lock().await;
        let previous = self.current()?;
        self.tokens.save(&remote.user_id, &tokens)?;
        self.storage.set_meta(USER_ID_META, &remote.user_id)?;
        if let Some(old) = previous.filter(|old| old.user_id != remote.user_id) {
            // Another account was signed in on this PC: its tokens go.
            if let Err(e) = self.tokens.delete(&old.user_id) {
                tracing::warn!(error = %e, "sign-in: could not delete the previous account's tokens");
            }
        }
        *lock(&self.session) = Slot::SignedIn(Session {
            user_id: remote.user_id,
            tokens,
        });
        Ok(self.account.apply_remote_profile(remote.profile)?)
    }

    /// The current session, restored from the stores on first use.
    fn current(&self) -> AuthResult<Option<Session>> {
        let mut slot = lock(&self.session);
        if matches!(*slot, Slot::Unknown) {
            *slot = self.restore()?;
        }
        Ok(match &*slot {
            Slot::SignedIn(session) => Some(session.clone()),
            Slot::Unknown | Slot::SignedOut => None,
        })
    }

    fn restore(&self) -> AuthResult<Slot> {
        let Some(user_id) = self.storage.meta(USER_ID_META)?.filter(|id| !id.is_empty()) else {
            return Ok(Slot::SignedOut);
        };
        Ok(match self.tokens.load(&user_id)? {
            Some(tokens) => Slot::SignedIn(Session { user_id, tokens }),
            // The entry was removed (Credential Manager, another sign-out): signed out.
            None => Slot::SignedOut,
        })
    }

    /// Whether a user is signed in (tokens stored for the remembered user id).
    pub fn is_signed_in(&self) -> AuthResult<bool> {
        Ok(self.current()?.is_some())
    }

    /// Brings the local account snapshot in line with the stored session at startup: without
    /// tokens for a remembered user (a new database seeded signed in, a credential removed
    /// outside the app) the snapshot is signed out, so the UI never shows a session that cannot
    /// call the API. The Credential Manager is read only when a user id is remembered.
    pub fn reconcile(&self) -> AuthResult<Account> {
        let account = self.account.get()?;
        if account.signed_in && self.current()?.is_none() {
            tracing::info!("account: no stored session; signed out locally");
            return Ok(self.account.sign_out()?);
        }
        Ok(account)
    }

    /// The signed-in user's id.
    pub fn user_id(&self) -> AuthResult<Option<String>> {
        Ok(self.current()?.map(|s| s.user_id))
    }

    /// A usable access token, refreshed first when it expires within a minute.
    pub async fn access_token(&self) -> AuthResult<Secret> {
        let session = self.current()?.ok_or(AuthError::NotSignedIn)?;
        if !session.tokens.needs_refresh(unix_now()) {
            return Ok(session.tokens.access_token);
        }
        Ok(self
            .refresh_after(&session.tokens.access_token)
            .await?
            .tokens
            .access_token)
    }

    /// Refreshes the tokens now. A refused (or missing) refresh token ends the session:
    /// [`AuthError::SessionExpired`], tokens deleted, the local account signed out.
    pub async fn refresh(&self) -> AuthResult<()> {
        let session = self.current()?.ok_or(AuthError::NotSignedIn)?;
        self.refresh_after(&session.tokens.access_token).await?;
        Ok(())
    }

    /// Refreshes unless another caller already replaced `stale` with a fresh token meanwhile.
    async fn refresh_after(&self, stale: &Secret) -> AuthResult<Session> {
        let _gate = self.gate.lock().await;
        let session = self.current()?.ok_or(AuthError::NotSignedIn)?;
        if session.tokens.access_token.expose() != stale.expose()
            && !session.tokens.needs_refresh(unix_now())
        {
            return Ok(session);
        }
        let Some(refresh_token) = session.tokens.refresh_token.clone() else {
            self.end_session(&session.user_id)?;
            return Err(AuthError::SessionExpired);
        };
        match self.client.refresh(&refresh_token).await {
            Ok(tokens) => {
                let session = Session {
                    user_id: session.user_id,
                    tokens,
                };
                *lock(&self.session) = Slot::SignedIn(session.clone());
                // A rotated refresh token that cannot be stored still serves this run.
                if let Err(e) = self.tokens.save(&session.user_id, &session.tokens) {
                    tracing::warn!(error = %e, "refresh: could not store the new tokens");
                }
                tracing::info!("refresh: access token renewed");
                Ok(session)
            }
            Err(AuthError::OAuth(code)) if code == "invalid_grant" => {
                tracing::info!("refresh: refused, the session has ended");
                self.end_session(&session.user_id)?;
                Err(AuthError::SessionExpired)
            }
            Err(e) => Err(e),
        }
    }

    /// Reads the profile from the account API (refreshing once if the token is refused) and
    /// saves it into the local account.
    pub async fn profile(&self) -> AuthResult<Account> {
        let access = self.access_token().await?;
        let remote: RemoteProfile = match self.client.me(&access).await {
            Err(AuthError::Unauthorized) => {
                let session = self.refresh_after(&access).await?;
                self.client.me(&session.tokens.access_token).await?
            }
            other => other?,
        };
        let session = self.current()?.ok_or(AuthError::NotSignedIn)?;
        if remote.user_id != session.user_id {
            return Err(AuthError::Protocol(
                "profile belongs to another account".into(),
            ));
        }
        Ok(self.account.apply_remote_profile(remote.profile)?)
    }

    /// Signs out: revokes the tokens (best effort — offline, they are only deleted), deletes
    /// them, forgets the user id and pending sign-ins, and signs the local account out.
    pub async fn sign_out(&self) -> AuthResult<Account> {
        let _gate = self.gate.lock().await;
        lock(&self.pending).clear();
        if let Some(session) = self.current()? {
            if !self.revoke_all(&session.tokens).await {
                tracing::warn!("sign-out: tokens not revoked by the server, deleted locally");
            }
            self.end_session(&session.user_id)?;
        }
        tracing::info!("sign-out: done");
        Ok(self.account.sign_out()?)
    }

    /// Revokes the refresh and the access token side by side (an unreachable server costs one
    /// timeout, not two); whether both were revoked.
    async fn revoke_all(&self, tokens: &TokenSet) -> bool {
        let (refresh, access) = tokio::join!(
            self.revoke_one(tokens.refresh_token.as_ref(), "refresh_token"),
            self.revoke_one(Some(&tokens.access_token), "access_token"),
        );
        refresh && access
    }

    async fn revoke_one(&self, token: Option<&Secret>, hint: &str) -> bool {
        match token.filter(|t| !t.is_empty()) {
            Some(token) => self.client.revoke(token, hint).await.is_ok(),
            None => true,
        }
    }

    /// Forgets the session everywhere and signs the local account out. The tokens' deletion is
    /// reported last, after everything else has been cleared.
    fn end_session(&self, user_id: &str) -> AuthResult<()> {
        let deleted = self.tokens.delete(user_id);
        *lock(&self.session) = Slot::SignedOut;
        self.storage.set_meta(USER_ID_META, "")?;
        self.account.sign_out()?;
        deleted
    }
}
