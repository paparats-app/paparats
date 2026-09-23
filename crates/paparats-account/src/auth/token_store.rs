//! Where tokens live between runs: only the Windows Credential Manager ([`CredentialManager`],
//! service `Paparats`, account = user id, persistence `Local` — this PC only, never roamed).
//! [`MemoryTokenStore`] keeps the same blobs in memory for tests.

use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};

use super::tokens::{decode, encode};
use super::{AuthResult, TokenSet};

/// Largest credential blob the Windows Credential Manager takes (`CRED_MAX_CREDENTIAL_BLOB_SIZE`).
pub const CREDENTIAL_BLOB_MAX: usize = 5 * 512;

/// Token persistence keyed by user id. Calls are short and synchronous.
pub trait TokenStore: Send + Sync {
    /// The stored tokens of `user_id`, or `None` when there are none.
    fn load(&self, user_id: &str) -> AuthResult<Option<TokenSet>>;
    /// Replaces the stored tokens of `user_id`.
    fn save(&self, user_id: &str, tokens: &TokenSet) -> AuthResult<()>;
    /// Deletes the stored tokens of `user_id`; deleting nothing is not an error.
    fn delete(&self, user_id: &str) -> AuthResult<()>;
}

/// In-memory store with the Credential Manager's blob format and size limit.
#[derive(Debug, Default)]
pub struct MemoryTokenStore {
    blobs: Mutex<HashMap<String, Vec<u8>>>,
}

impl MemoryTokenStore {
    pub fn new() -> Self {
        Self::default()
    }

    fn blobs(&self) -> std::sync::MutexGuard<'_, HashMap<String, Vec<u8>>> {
        self.blobs.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Whether tokens are stored for `user_id`.
    pub fn contains(&self, user_id: &str) -> bool {
        self.blobs().contains_key(user_id)
    }

    /// Number of users with stored tokens.
    pub fn len(&self) -> usize {
        self.blobs().len()
    }

    pub fn is_empty(&self) -> bool {
        self.blobs().is_empty()
    }
}

impl TokenStore for MemoryTokenStore {
    fn load(&self, user_id: &str) -> AuthResult<Option<TokenSet>> {
        self.blobs()
            .get(user_id)
            .map(|blob| decode(blob))
            .transpose()
    }

    fn save(&self, user_id: &str, tokens: &TokenSet) -> AuthResult<()> {
        let blob = encode(tokens, CREDENTIAL_BLOB_MAX)?;
        self.blobs().insert(user_id.to_owned(), blob);
        Ok(())
    }

    fn delete(&self, user_id: &str) -> AuthResult<()> {
        self.blobs().remove(user_id);
        Ok(())
    }
}

#[cfg(windows)]
pub use credential_manager::CredentialManager;

#[cfg(windows)]
mod credential_manager {
    use std::collections::HashMap;

    use super::{CREDENTIAL_BLOB_MAX, TokenStore, decode, encode};
    use crate::auth::{AuthError, AuthResult, CREDENTIAL_SERVICE, TokenSet};

    /// Tokens as generic credentials in the Windows Credential Manager, through the `keyring`
    /// crate: target `<user id>.Paparats`, user name = user id, blob = UTF-8 JSON (at most
    /// [`CREDENTIAL_BLOB_MAX`] bytes), persistence `Local`.
    #[derive(Debug, Clone)]
    pub struct CredentialManager {
        service: String,
    }

    impl Default for CredentialManager {
        fn default() -> Self {
            Self::new()
        }
    }

    /// A keyring error as a message without the credential's content (`BadEncoding` and
    /// `BadDataFormat` carry the raw blob).
    fn credential_error(e: &keyring_core::Error) -> AuthError {
        use keyring_core::Error as E;
        let message = match e {
            E::PlatformFailure(err) => format!("platform failure: {err}"),
            E::NoStorageAccess(err) => format!("no access to the credential store: {err}"),
            E::NoEntry => "no stored credential".to_owned(),
            E::BadEncoding(_) | E::BadDataFormat(..) => "stored credential is malformed".to_owned(),
            E::TooLong(what, limit) => format!("{what} is longer than {limit}"),
            E::Invalid(what, _) => format!("{what} is not accepted by the credential store"),
            E::NoDefaultStore => "the Credential Manager is not available".to_owned(),
            _ => "credential store error".to_owned(),
        };
        AuthError::Credentials(message)
    }

    impl CredentialManager {
        /// Entries under the `Paparats` service.
        pub fn new() -> Self {
            Self::with_service(CREDENTIAL_SERVICE)
        }

        /// Entries under another service name (tests keep away from the real entries).
        pub fn with_service(service: &str) -> Self {
            Self {
                service: service.to_owned(),
            }
        }

        fn entry(&self, user_id: &str) -> AuthResult<keyring_core::Entry> {
            // `keyring` installs the Windows store as keyring-core's default once per process.
            if let Err(e) = keyring::Entry::store_status() {
                return Err(credential_error(e));
            }
            let modifiers = HashMap::from([("persistence", "Local")]);
            keyring_core::Entry::new_with_modifiers(&self.service, user_id, &modifiers)
                .map_err(|e| credential_error(&e))
        }
    }

    impl TokenStore for CredentialManager {
        fn load(&self, user_id: &str) -> AuthResult<Option<TokenSet>> {
            match self.entry(user_id)?.get_secret() {
                Ok(blob) => decode(&blob).map(Some),
                Err(keyring_core::Error::NoEntry) => Ok(None),
                Err(e) => Err(credential_error(&e)),
            }
        }

        fn save(&self, user_id: &str, tokens: &TokenSet) -> AuthResult<()> {
            let blob = encode(tokens, CREDENTIAL_BLOB_MAX)?;
            self.entry(user_id)?
                .set_secret(&blob)
                .map_err(|e| credential_error(&e))
        }

        fn delete(&self, user_id: &str) -> AuthResult<()> {
            match self.entry(user_id)?.delete_credential() {
                Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
                Err(e) => Err(credential_error(&e)),
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::auth::Secret;

        /// Writes, reads and deletes a real Credential Manager entry (service
        /// `Paparats-test`). Run by hand on Windows:
        /// `cargo test -p paparats-account credential_manager_round_trip -- --ignored`
        /// (check `cmdkey /list:*Paparats-test*` stays empty afterwards).
        #[test]
        #[ignore = "writes to the Windows Credential Manager"]
        fn credential_manager_round_trip() {
            let store = CredentialManager::with_service("Paparats-test");
            let user = "m7-round-trip-user";
            store.delete(user).unwrap();
            assert!(store.load(user).unwrap().is_none());
            let tokens = TokenSet {
                access_token: Secret::new("at-".repeat(300)),
                refresh_token: Some(Secret::new("rt-1")),
                expires_at: Some(1_790_000_000),
            };
            store.save(user, &tokens).unwrap();
            let back = store.load(user).unwrap().unwrap();
            assert_eq!(back.access_token.expose(), tokens.access_token.expose());
            assert_eq!(back.refresh_token.unwrap().expose(), "rt-1");
            assert_eq!(back.expires_at, Some(1_790_000_000));
            // This PC only, never roamed with the Windows profile.
            let attributes = store.entry(user).unwrap().get_attributes().unwrap();
            assert_eq!(attributes["persistence"], "Local");
            assert_eq!(attributes["username"], user);
            // Too long for one blob: the access token is left out, the refresh token kept.
            let big = TokenSet {
                access_token: Secret::new("a".repeat(4000)),
                ..tokens
            };
            store.save(user, &big).unwrap();
            let back = store.load(user).unwrap().unwrap();
            assert!(back.access_token.is_empty());
            assert_eq!(back.refresh_token.unwrap().expose(), "rt-1");
            store.delete(user).unwrap();
            assert!(store.load(user).unwrap().is_none());
            store.delete(user).unwrap();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::Secret;

    #[test]
    fn memory_store_round_trip() {
        let store = MemoryTokenStore::new();
        assert!(store.load("u1").unwrap().is_none());
        let tokens = TokenSet {
            access_token: Secret::new("at"),
            refresh_token: Some(Secret::new("rt")),
            expires_at: Some(10),
        };
        store.save("u1", &tokens).unwrap();
        assert!(store.contains("u1"));
        assert_eq!(store.len(), 1);
        let back = store.load("u1").unwrap().unwrap();
        assert_eq!(back.refresh_token.unwrap().expose(), "rt");
        store.delete("u1").unwrap();
        store.delete("u1").unwrap();
        assert!(store.is_empty());
    }
}
