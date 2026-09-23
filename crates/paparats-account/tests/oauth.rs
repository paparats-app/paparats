//! The real sign-in end to end against a tiny local HTTP/1.1 server acting as the authorization
//! server and account API: `/oauth/token` (code exchange with the PKCE check, refresh with
//! rotation), `/oauth/revoke` and `GET /v1/me`. The "browser" is the test: it reads the
//! authorization URL, lets the server issue a code for its challenge and builds the callback.

// Test code: helpers outside `#[test]` fns are not covered by clippy's allow-unwrap-in-tests.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use paparats_account::auth::{
    AuthError, MemoryTokenStore, OAuthAccount, OAuthConfig, PkceSession, REDIRECT_URI, TokenSet,
    TokenStore, USER_ID_META,
};
use paparats_account::auth::{OAuthClient, Secret};
use paparats_core::hosts::Allowlist;
use paparats_storage::Storage;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use url::Url;

const CLIENT: &str = "paparats-desktop";

// ---------------------------------------------------------------------------------------------
// Authorization server
// ---------------------------------------------------------------------------------------------

/// One request as the server saw it.
#[derive(Debug, Clone)]
struct Seen {
    method: String,
    path: String,
    form: HashMap<String, String>,
    authorization: Option<String>,
}

struct World {
    /// Issued codes → the PKCE challenge they were issued for.
    codes: HashMap<String, String>,
    access: HashSet<String>,
    refresh: HashSet<String>,
    revoked: Vec<String>,
    next: u32,
    expires_in: u64,
    /// Issue a new refresh token on refresh (rotation) or keep the old one.
    rotate: bool,
    /// `/v1/me` answers a redirect instead of the profile.
    me_redirects: bool,
    user_id: String,
    seen: Vec<Seen>,
}

struct Server {
    addr: SocketAddr,
    world: Arc<Mutex<World>>,
}

impl Server {
    async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let world = Arc::new(Mutex::new(World {
            codes: HashMap::new(),
            access: HashSet::new(),
            refresh: HashSet::new(),
            revoked: Vec::new(),
            next: 0,
            expires_in: 3600,
            rotate: true,
            me_redirects: false,
            user_id: "usr_8f2k".into(),
            seen: Vec::new(),
        }));
        let shared = Arc::clone(&world);
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    return;
                };
                let world = Arc::clone(&shared);
                tokio::spawn(async move {
                    let _ = serve(stream, &world).await;
                });
            }
        });
        Self { addr, world }
    }

    fn base(&self) -> String {
        format!("http://{}", self.addr)
    }

    fn world(&self) -> std::sync::MutexGuard<'_, World> {
        self.world.lock().unwrap()
    }

    fn seen(&self) -> Vec<Seen> {
        self.world().seen.clone()
    }

    fn seen_at(&self, path: &str) -> Vec<Seen> {
        self.seen().into_iter().filter(|s| s.path == path).collect()
    }

    /// The browser: the user approves the authorization request; the server issues a code for
    /// its challenge and redirects to the callback.
    fn approve(&self, authorization_url: &Url) -> Url {
        let q: HashMap<String, String> = authorization_url.query_pairs().into_owned().collect();
        assert_eq!(q["response_type"], "code");
        assert_eq!(q["client_id"], CLIENT);
        assert_eq!(q["redirect_uri"], REDIRECT_URI);
        assert_eq!(q["code_challenge_method"], "S256");
        let mut world = self.world();
        world.next += 1;
        let code = format!("code-{}", world.next);
        world
            .codes
            .insert(code.clone(), q["code_challenge"].clone());
        let mut callback = Url::parse(REDIRECT_URI).unwrap();
        callback
            .query_pairs_mut()
            .append_pair("code", &code)
            .append_pair("state", &q["state"]);
        callback
    }

    /// The server forgets every access token (as if they expired early).
    fn expire_access_tokens(&self) {
        self.world().access.clear();
    }
}

fn s256(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn issue(world: &mut World) -> String {
    world.next += 1;
    let access = format!("at-{}", world.next);
    world.access.insert(access.clone());
    let refresh = format!("rt-{}", world.next);
    world.refresh.insert(refresh.clone());
    serde_json::json!({
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": world.expires_in,
        "refresh_token": refresh,
    })
    .to_string()
}

fn oauth_error(code: &str) -> (u16, String) {
    (400, serde_json::json!({ "error": code }).to_string())
}

fn route(world: &mut World, seen: &Seen) -> (u16, String) {
    let f = |k: &str| seen.form.get(k).cloned().unwrap_or_default();
    match (seen.method.as_str(), seen.path.as_str()) {
        ("POST", "/oauth/token") => match f("grant_type").as_str() {
            "authorization_code" => {
                if f("client_id") != CLIENT || f("redirect_uri") != REDIRECT_URI {
                    return oauth_error("invalid_client");
                }
                match world.codes.remove(&f("code")) {
                    Some(challenge) if challenge == s256(&f("code_verifier")) => {
                        (200, issue(world))
                    }
                    _ => oauth_error("invalid_grant"),
                }
            }
            "refresh_token" => {
                let token = f("refresh_token");
                if f("client_id") != CLIENT || !world.refresh.contains(&token) {
                    return oauth_error("invalid_grant");
                }
                if world.rotate {
                    world.refresh.remove(&token);
                    (200, issue(world))
                } else {
                    // No new refresh token in the answer: the client keeps the old one.
                    world.next += 1;
                    let access = format!("at-{}", world.next);
                    world.access.insert(access.clone());
                    let body = serde_json::json!({
                        "access_token": access, "token_type": "Bearer",
                        "expires_in": world.expires_in,
                    });
                    (200, body.to_string())
                }
            }
            _ => oauth_error("unsupported_grant_type"),
        },
        ("POST", "/oauth/revoke") => {
            let token = f("token");
            world.access.remove(&token);
            world.refresh.remove(&token);
            world.revoked.push(token);
            (200, String::new())
        }
        ("GET", "/v1/me") => {
            if world.me_redirects {
                return (302, String::new());
            }
            let bearer = seen
                .authorization
                .as_deref()
                .and_then(|h| h.strip_prefix("Bearer "));
            match bearer {
                Some(token) if world.access.contains(token) => {
                    let body = serde_json::json!({
                        "id": world.user_id,
                        "name": "Ales Kavalenka",
                        "email": "ales@example.com",
                        "createdAt": "2024-03-05T08:00:00Z",
                        "country": {"en": "Belarus", "be": "Беларусь", "ru": "Беларусь"},
                        "timezone": "(UTC+03:00) Minsk",
                    });
                    (200, body.to_string())
                }
                _ => (401, String::new()),
            }
        }
        _ => (404, String::new()),
    }
}

async fn serve(stream: TcpStream, world: &Mutex<World>) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).await?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_owned();
    let path = parts.next().unwrap_or_default().to_owned();
    let (mut length, mut authorization) = (0_usize, None);
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).await?;
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            match name.trim().to_ascii_lowercase().as_str() {
                "content-length" => length = value.trim().parse().unwrap_or(0),
                "authorization" => authorization = Some(value.trim().to_owned()),
                _ => {}
            }
        }
    }
    let mut body = vec![0_u8; length];
    reader.read_exact(&mut body).await?;
    let seen = Seen {
        method,
        path,
        form: url::form_urlencoded::parse(&body).into_owned().collect(),
        authorization,
    };
    let (status, body) = {
        let mut world = world.lock().unwrap();
        world.seen.push(seen.clone());
        route(&mut world, &seen)
    };
    let reason = match status {
        200 => "OK",
        302 => "Found",
        400 => "Bad Request",
        401 => "Unauthorized",
        _ => "Not Found",
    };
    let location = if status == 302 {
        "Location: https://evil.example/steal\r\n"
    } else {
        ""
    };
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\n{location}\
         Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let mut stream = reader.into_inner();
    stream.write_all(response.as_bytes()).await?;
    stream.shutdown().await
}

// ---------------------------------------------------------------------------------------------
// Client side
// ---------------------------------------------------------------------------------------------

fn config(base: &str) -> OAuthConfig {
    OAuthConfig {
        api_base: base.to_owned(),
        allowlist: Allowlist::new().with("127.0.0.1"),
        // This machine may route HTTP(S)_PROXY elsewhere; the test server is local.
        use_env_proxy: false,
        timeout: Duration::from_secs(5),
        ..OAuthConfig::production()
    }
}

struct Fixture {
    server: Server,
    storage: Arc<Storage>,
    tokens: Arc<MemoryTokenStore>,
    account: OAuthAccount,
}

async fn fixture() -> Fixture {
    let server = Server::start().await;
    let storage = Arc::new(Storage::open_in_memory().unwrap());
    storage.seed_from_fixtures().unwrap();
    let tokens = Arc::new(MemoryTokenStore::new());
    let account =
        OAuthAccount::new(config(&server.base()), tokens.clone(), Arc::clone(&storage)).unwrap();
    Fixture {
        server,
        storage,
        tokens,
        account,
    }
}

impl Fixture {
    async fn sign_in(&self) {
        let url = self.account.begin_sign_in(None).unwrap();
        let callback = self.server.approve(&url);
        self.account.complete(&callback).await.unwrap();
    }

    fn stored(&self) -> TokenSet {
        self.tokens.load("usr_8f2k").unwrap().unwrap()
    }

    /// The same database and credentials, as after a restart.
    fn restarted(&self) -> OAuthAccount {
        OAuthAccount::new(
            config(&self.server.base()),
            self.tokens.clone(),
            Arc::clone(&self.storage),
        )
        .unwrap()
    }
}

fn assert_send<T: Send>(_: &T) {}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

#[tokio::test]
async fn sign_in_exchanges_the_code_and_stores_the_tokens() {
    let f = fixture().await;
    f.account.sign_out().await.unwrap();
    assert!(!f.account.is_signed_in().unwrap());

    let url = f.account.begin_sign_in(Some("ales@example.com")).unwrap();
    assert_eq!(url.path(), "/oauth/authorize");
    assert_eq!(f.account.pending_sign_ins(), 1);
    let callback = f.server.approve(&url);
    let complete = f.account.complete(&callback);
    assert_send(&complete);
    let account = complete.await.unwrap();

    // The local account carries the API's profile.
    assert!(account.signed_in);
    assert_eq!(account.profile.name, "Ales Kavalenka");
    assert_eq!(account.profile.email, "ales@example.com");
    assert_eq!(account.profile.since, "2024-03-05");
    assert_eq!(account.profile.country.be, "Беларусь");
    assert_eq!(account.profile.timezone.en, "(UTC+03:00) Minsk");
    assert_eq!(account.devices.len(), 2, "devices stay local");

    // The token request was a form post with exactly the PKCE fields; the verifier matched.
    let token = f.server.seen_at("/oauth/token");
    assert_eq!(token.len(), 1);
    let form = &token[0].form;
    let mut keys: Vec<&str> = form.keys().map(String::as_str).collect();
    keys.sort_unstable();
    assert_eq!(
        keys,
        [
            "client_id",
            "code",
            "code_verifier",
            "grant_type",
            "redirect_uri"
        ]
    );
    assert_eq!(form["grant_type"], "authorization_code");
    assert_eq!(form["redirect_uri"], "paparats://auth/callback");
    assert_eq!(form["code_verifier"].len(), 64);
    assert!(f.server.world().codes.is_empty(), "code used once");

    // The profile request carried the access token.
    let me = f.server.seen_at("/v1/me");
    assert_eq!(me[0].authorization.as_deref(), Some("Bearer at-2"));

    // Tokens are in the token store under the user id; the database only knows the id.
    let stored = f.stored();
    assert_eq!(stored.access_token.expose(), "at-2");
    assert_eq!(stored.refresh_token.as_ref().unwrap().expose(), "rt-2");
    assert!(stored.expires_at.is_some());
    assert_eq!(
        f.storage.meta(USER_ID_META).unwrap().as_deref(),
        Some("usr_8f2k")
    );
    assert!(f.account.is_signed_in().unwrap());
    assert_eq!(f.account.user_id().unwrap().as_deref(), Some("usr_8f2k"));
    assert_eq!(f.account.pending_sign_ins(), 0);
    assert_eq!(f.account.access_token().await.unwrap().expose(), "at-2");

    // Replaying the same callback is refused: the attempt is gone.
    assert!(matches!(
        f.account.complete(&callback).await,
        Err(AuthError::StateMismatch)
    ));
}

#[tokio::test]
async fn wrong_state_is_rejected_before_any_request() {
    let f = fixture().await;
    let url = f.account.begin_sign_in(None).unwrap();
    let genuine = f.server.approve(&url);
    let code = genuine
        .query_pairs()
        .find(|(k, _)| k == "code")
        .unwrap()
        .1
        .into_owned();
    let mut forged = Url::parse(REDIRECT_URI).unwrap();
    forged
        .query_pairs_mut()
        .append_pair("code", &code)
        .append_pair("state", "attacker-state");
    assert!(matches!(
        f.account.complete(&forged).await,
        Err(AuthError::StateMismatch)
    ));
    assert!(f.server.seen().is_empty(), "no token request was sent");
    assert!(f.tokens.is_empty());

    // The genuine callback still completes afterwards.
    assert!(f.account.complete(&genuine).await.unwrap().signed_in);
}

#[tokio::test]
async fn denied_and_malformed_callbacks() {
    let f = fixture().await;
    let url = f.account.begin_sign_in(None).unwrap();
    let state = url
        .query_pairs()
        .find(|(k, _)| k == "state")
        .unwrap()
        .1
        .into_owned();
    let mut denied = Url::parse(REDIRECT_URI).unwrap();
    denied
        .query_pairs_mut()
        .append_pair("error", "access_denied")
        .append_pair("state", &state);
    assert!(matches!(
        f.account.complete(&denied).await,
        Err(AuthError::Denied(code)) if code == "access_denied"
    ));
    assert_eq!(f.account.pending_sign_ins(), 0, "a denied attempt is over");

    let other = Url::parse("paparats://app/obs?code=x&state=y").unwrap();
    assert!(matches!(
        f.account.complete(&other).await,
        Err(AuthError::NotCallback)
    ));
    assert!(f.server.seen().is_empty());
}

#[tokio::test]
async fn a_code_the_server_refuses_is_an_oauth_error() {
    let f = fixture().await;
    let url = f.account.begin_sign_in(None).unwrap();
    let callback = f.server.approve(&url);
    // The server loses the code (expired, already used elsewhere).
    f.server.world().codes.clear();
    let e = f.account.complete(&callback).await.unwrap_err();
    assert!(matches!(&e, AuthError::OAuth(code) if code == "invalid_grant"));
    assert!(!e.to_string().contains("code-"), "{e}");
    assert!(f.tokens.is_empty());
    assert!(!f.account.is_signed_in().unwrap());
}

#[tokio::test]
async fn pkce_session_completes_on_its_own() {
    let server = Server::start().await;
    let client = OAuthClient::new(config(&server.base())).unwrap();
    let attempt = PkceSession::new().unwrap();
    let url = attempt.authorization_url(client.config(), None).unwrap();
    let callback = server.approve(&url);
    let tokens = attempt.complete(&client, &callback).await.unwrap();
    assert_eq!(tokens.access_token.expose(), "at-2");
    assert_eq!(tokens.refresh_token.unwrap().expose(), "rt-2");
    let profile = client.me(&Secret::new("at-2")).await.unwrap();
    assert_eq!(profile.user_id, "usr_8f2k");
    assert!(matches!(
        client.me(&Secret::new("at-unknown")).await,
        Err(AuthError::Unauthorized)
    ));
}

#[tokio::test]
async fn expiring_access_token_is_refreshed_and_rotated() {
    let f = fixture().await;
    // Tokens that live 30 s are inside the one-minute margin: the next use refreshes.
    f.server.world().expires_in = 30;
    f.sign_in().await;
    let fresh = f.account.access_token().await.unwrap();
    assert_eq!(fresh.expose(), "at-3");
    let refresh = f.server.seen_at("/oauth/token");
    assert_eq!(refresh.len(), 2);
    let form = &refresh[1].form;
    assert_eq!(form["grant_type"], "refresh_token");
    assert_eq!(form["refresh_token"], "rt-2");
    assert_eq!(form["client_id"], CLIENT);
    assert_eq!(form.len(), 3);
    // The rotated tokens replaced the old ones in the store.
    let stored = f.stored();
    assert_eq!(stored.access_token.expose(), "at-3");
    assert_eq!(stored.refresh_token.unwrap().expose(), "rt-3");

    // A long-lived token is used as is.
    f.server.world().expires_in = 3600;
    f.account.refresh().await.unwrap();
    let before = f.server.seen_at("/oauth/token").len();
    assert_eq!(f.account.access_token().await.unwrap().expose(), "at-4");
    assert_eq!(f.server.seen_at("/oauth/token").len(), before);
}

#[tokio::test]
async fn concurrent_callers_share_one_refresh() {
    let f = fixture().await;
    f.server.world().expires_in = 30;
    f.sign_in().await;
    // The refreshed token is long-lived, so the caller that waited has nothing left to do.
    f.server.world().expires_in = 3600;
    let (a, b) = tokio::join!(f.account.access_token(), f.account.access_token());
    // The second caller waited for the first refresh and used its token (rotation would have
    // refused a second use of rt-2).
    assert_eq!(a.unwrap().expose(), "at-3");
    assert_eq!(b.unwrap().expose(), "at-3");
    assert_eq!(f.server.seen_at("/oauth/token").len(), 2);
}

#[tokio::test]
async fn refresh_without_a_new_refresh_token_keeps_the_old_one() {
    let f = fixture().await;
    f.sign_in().await;
    f.server.world().rotate = false;
    f.account.refresh().await.unwrap();
    let stored = f.stored();
    assert_eq!(stored.access_token.expose(), "at-3");
    assert_eq!(stored.refresh_token.unwrap().expose(), "rt-2");
}

#[tokio::test]
async fn refused_refresh_ends_the_session() {
    let f = fixture().await;
    f.sign_in().await;
    // Revoked elsewhere (password change, "Sign out everywhere").
    f.server.world().refresh.clear();
    assert!(matches!(
        f.account.refresh().await,
        Err(AuthError::SessionExpired)
    ));
    assert!(f.tokens.is_empty());
    assert_eq!(f.storage.meta(USER_ID_META).unwrap().as_deref(), Some(""));
    assert!(!f.account.is_signed_in().unwrap());
    assert!(!f.storage.account().unwrap().signed_in);
    assert!(matches!(
        f.account.access_token().await,
        Err(AuthError::NotSignedIn)
    ));
}

#[tokio::test]
async fn profile_refreshes_once_after_a_401() {
    let f = fixture().await;
    f.sign_in().await;
    f.server.expire_access_tokens();
    let account = f.account.profile().await.unwrap();
    assert_eq!(account.profile.name, "Ales Kavalenka");
    let me = f.server.seen_at("/v1/me");
    assert_eq!(me.len(), 3, "sign-in, refused, retried");
    assert_eq!(me[1].authorization.as_deref(), Some("Bearer at-2"));
    assert_eq!(me[2].authorization.as_deref(), Some("Bearer at-3"));

    // A profile for another account is refused.
    f.server.world().user_id = "usr_other".into();
    assert!(matches!(
        f.account.profile().await,
        Err(AuthError::Protocol(_))
    ));
}

#[tokio::test]
async fn sign_out_revokes_and_deletes() {
    let f = fixture().await;
    f.sign_in().await;
    let account = f.account.sign_out().await.unwrap();
    assert!(!account.signed_in);
    // Both tokens were revoked (side by side, so in either order).
    let mut revoke: Vec<(String, String, String)> = f
        .server
        .seen_at("/oauth/revoke")
        .into_iter()
        .map(|s| {
            let v = |k: &str| s.form[k].clone();
            (v("token_type_hint"), v("token"), v("client_id"))
        })
        .collect();
    revoke.sort();
    assert_eq!(
        revoke,
        [
            ("access_token".into(), "at-2".into(), CLIENT.into()),
            ("refresh_token".into(), "rt-2".into(), CLIENT.into()),
        ]
    );
    assert!(
        f.server.world().refresh.is_empty(),
        "the server forgot the session"
    );
    assert!(f.tokens.is_empty());
    assert_eq!(f.storage.meta(USER_ID_META).unwrap().as_deref(), Some(""));
    assert!(!f.account.is_signed_in().unwrap());
    // Signing out twice is harmless and sends nothing.
    f.account.sign_out().await.unwrap();
    assert_eq!(f.server.seen_at("/oauth/revoke").len(), 2);
}

#[tokio::test]
async fn sign_out_works_offline() {
    let storage = Arc::new(Storage::open_in_memory().unwrap());
    storage.seed_from_fixtures().unwrap();
    let tokens = Arc::new(MemoryTokenStore::new());
    tokens
        .save(
            "usr_8f2k",
            &TokenSet {
                access_token: Secret::new("at-1"),
                refresh_token: Some(Secret::new("rt-1")),
                expires_at: None,
            },
        )
        .unwrap();
    storage.set_meta(USER_ID_META, "usr_8f2k").unwrap();
    // Nothing listens on port 9 of this machine.
    let account = OAuthAccount::new(config("http://127.0.0.1:9"), tokens.clone(), storage).unwrap();
    assert!(account.is_signed_in().unwrap());
    assert!(!account.sign_out().await.unwrap().signed_in);
    assert!(tokens.is_empty());
}

#[tokio::test]
async fn session_survives_a_restart() {
    let f = fixture().await;
    f.sign_in().await;
    let again = f.restarted();
    assert!(again.is_signed_in().unwrap());
    assert_eq!(again.access_token().await.unwrap().expose(), "at-2");
    assert!(again.profile().await.unwrap().signed_in);
    // With the credential gone (removed in Credential Manager), the user is signed out.
    f.tokens.delete("usr_8f2k").unwrap();
    assert!(!f.restarted().is_signed_in().unwrap());
}

#[tokio::test]
async fn startup_reconciles_the_snapshot_with_the_stored_session() {
    let f = fixture().await;
    // The mock world is seeded signed in, but no tokens exist: signed out at startup.
    assert!(f.storage.account().unwrap().signed_in);
    assert!(!f.account.reconcile().unwrap().signed_in);
    assert!(!f.storage.account().unwrap().signed_in);

    // A real session survives a restart's reconciliation…
    f.sign_in().await;
    assert!(f.restarted().reconcile().unwrap().signed_in);
    // …until its credential disappears outside the app.
    f.tokens.delete("usr_8f2k").unwrap();
    assert!(!f.restarted().reconcile().unwrap().signed_in);
    assert!(!f.storage.account().unwrap().signed_in);
}

#[tokio::test]
async fn a_new_account_replaces_the_previous_ones_tokens() {
    let f = fixture().await;
    f.sign_in().await;
    f.server.world().user_id = "usr_second".into();
    f.sign_in().await;
    assert!(!f.tokens.contains("usr_8f2k"));
    assert!(f.tokens.contains("usr_second"));
    assert_eq!(f.account.user_id().unwrap().as_deref(), Some("usr_second"));
}

#[tokio::test]
async fn redirects_are_not_followed() {
    let f = fixture().await;
    f.sign_in().await;
    f.server.world().me_redirects = true;
    assert!(matches!(
        f.account.profile().await,
        Err(AuthError::Http(302))
    ));
}

#[tokio::test]
async fn hosts_outside_the_allowlist_are_refused() {
    let storage = Arc::new(Storage::open_in_memory().unwrap());
    let tokens = Arc::new(MemoryTokenStore::new());
    let mut cfg = config("http://127.0.0.1:9");
    cfg.allowlist = Allowlist::new();
    assert!(matches!(
        OAuthAccount::new(cfg, tokens.clone(), Arc::clone(&storage)),
        Err(AuthError::HostNotAllowed(_))
    ));
    assert!(matches!(
        OAuthAccount::new(config("http://example.com"), tokens, storage),
        Err(AuthError::InsecureUrl(_))
    ));
}

#[tokio::test]
async fn pending_sign_ins_are_capped() {
    let f = fixture().await;
    let urls: Vec<Url> = (0..5)
        .map(|_| f.account.begin_sign_in(None).unwrap())
        .collect();
    assert_eq!(f.account.pending_sign_ins(), 4);
    // The oldest attempt was dropped; the newest still completes.
    let oldest = f.server.approve(&urls[0]);
    assert!(matches!(
        f.account.complete(&oldest).await,
        Err(AuthError::StateMismatch)
    ));
    let newest = f.server.approve(&urls[4]);
    assert!(f.account.complete(&newest).await.is_ok());
}
