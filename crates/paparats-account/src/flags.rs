//! The sign-in strategy, chosen once at startup. `PAPARATS_REAL` is parsed by the Tauri crate
//! (one place); this crate only takes the answer for `account`.

use std::sync::Arc;

use paparats_storage::Storage;

use crate::auth::{AuthResult, OAuthAccount, OAuthConfig, TokenStore};

/// How the app signs in.
#[derive(Debug, Clone)]
pub enum Auth {
    /// The prototype's local sign-in ([`crate::AccountStore::sign_in`]): any password, no
    /// network. The default.
    Simulated,
    /// OAuth 2 PKCE through the browser against the account API; tokens in the Windows
    /// Credential Manager.
    Real(Arc<OAuthAccount>),
}

impl Auth {
    pub fn is_real(&self) -> bool {
        matches!(self, Self::Real(_))
    }

    /// The real sign-in, when it is on.
    pub fn real(&self) -> Option<&Arc<OAuthAccount>> {
        match self {
            Self::Real(account) => Some(account),
            Self::Simulated => None,
        }
    }
}

/// The sign-in for this run: [`Auth::Real`] against the production API with tokens in the
/// Credential Manager when `real` (`PAPARATS_REAL` names `account` or `all`), else
/// [`Auth::Simulated`]. `storage` is the app database (account snapshot, signed-in user id).
pub fn from_flags(real: bool, storage: Arc<Storage>) -> AuthResult<Auth> {
    if !real {
        return Ok(Auth::Simulated);
    }
    let account = OAuthAccount::new(OAuthConfig::production(), credential_store()?, storage)?;
    tracing::info!("account: real sign-in (OAuth 2 PKCE)");
    Ok(Auth::Real(Arc::new(account)))
}

#[cfg(windows)]
fn credential_store() -> AuthResult<Arc<dyn TokenStore>> {
    Ok(Arc::new(crate::auth::CredentialManager::new()))
}

#[cfg(not(windows))]
fn credential_store() -> AuthResult<Arc<dyn TokenStore>> {
    Err(crate::auth::AuthError::Unsupported)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simulated_by_default() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let auth = from_flags(false, storage).unwrap();
        assert!(!auth.is_real());
        assert!(auth.real().is_none());
    }

    #[cfg(windows)]
    #[test]
    fn real_when_flagged() {
        // Builds the client and the Credential Manager store; touches neither network nor
        // credentials until used.
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let auth = from_flags(true, storage).unwrap();
        assert!(auth.is_real());
        let account = auth.real().unwrap();
        assert_eq!(
            account.client().config().api_base,
            "https://api.paparats.app"
        );
    }
}
