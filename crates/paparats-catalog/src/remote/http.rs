//! Conditional GET of a manifest: allowlisted hosts only (redirects included), HTTPS only (plain
//! HTTP for loopback test servers), timeouts, a size cap, `ETag` / `If-None-Match`.

use std::sync::{Arc, RwLock};
use std::time::Duration;

use paparats_core::hosts::{Allowlist, is_loopback};
use reqwest::header::{ACCEPT, ETAG, HeaderValue, IF_NONE_MATCH};
use reqwest::{Client, StatusCode, Url, redirect};

use crate::CatalogError;

/// Longest `ETag` kept for revalidation; a longer one is ignored (the copy is still cached).
const MAX_ETAG_LEN: usize = 512;
/// Redirect hops followed before giving up.
const MAX_REDIRECTS: usize = 5;

/// What a conditional GET returned.
#[derive(Debug)]
pub(crate) enum Fetched {
    /// A new body (200).
    Fresh { body: Vec<u8>, etag: Option<String> },
    /// The copy we revalidated is current (304).
    NotModified,
}

/// How the client is set up (from [`super::RemoteConfig`]).
pub(crate) struct FetcherConfig {
    pub allowlist: Arc<RwLock<Allowlist>>,
    pub use_env_proxy: bool,
    pub connect_timeout: Duration,
    pub request_timeout: Duration,
    pub max_bytes: u64,
}

pub(crate) struct Fetcher {
    client: Client,
    allowlist: Arc<RwLock<Allowlist>>,
    max_bytes: u64,
}

/// Parses an absolute manifest URL and checks it against the scheme rules (not the allowlist).
pub(crate) fn parse_url(text: &str) -> Result<Url, CatalogError> {
    let url = Url::parse(text).map_err(|e| CatalogError::InvalidUrl(e.to_string()))?;
    check_scheme(&url)?;
    Ok(url)
}

fn check_scheme(url: &Url) -> Result<&str, CatalogError> {
    let host = url
        .host_str()
        .ok_or_else(|| CatalogError::InvalidUrl("no host".into()))?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err(CatalogError::InvalidUrl("credentials in URL".into()));
    }
    match url.scheme() {
        "https" => Ok(host),
        "http" if is_loopback(host) => Ok(host),
        "http" => Err(CatalogError::InsecureUrl(host.to_owned())),
        other => Err(CatalogError::InvalidUrl(format!("scheme {other}"))),
    }
}

/// Scheme rules plus the allowlist. A poisoned allowlist allows nothing.
pub(crate) fn check_url(allowlist: &RwLock<Allowlist>, url: &Url) -> Result<(), CatalogError> {
    let host = check_scheme(url)?;
    if allowlist.read().is_ok_and(|list| list.is_allowed(host)) {
        Ok(())
    } else {
        Err(CatalogError::HostNotAllowed(host.to_owned()))
    }
}

impl Fetcher {
    pub(crate) fn new(config: FetcherConfig) -> Result<Self, CatalogError> {
        let policy_list = Arc::clone(&config.allowlist);
        let policy = redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() >= MAX_REDIRECTS {
                attempt.error("too many redirects")
            } else if check_url(&policy_list, attempt.url()).is_ok() {
                attempt.follow()
            } else {
                attempt.error("redirect to a host outside the allowlist")
            }
        });
        let mut builder = Client::builder()
            .redirect(policy)
            .user_agent(concat!("Paparats/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(config.connect_timeout)
            .timeout(config.request_timeout);
        if !config.use_env_proxy {
            builder = builder.no_proxy();
        }
        Ok(Self {
            client: builder.build()?,
            allowlist: config.allowlist,
            max_bytes: config.max_bytes,
        })
    }

    /// GETs `url`, revalidating with `etag` when given. Only a request that sent `etag` may be
    /// answered with 304.
    pub(crate) async fn get(&self, url: &Url, etag: Option<&str>) -> Result<Fetched, CatalogError> {
        check_url(&self.allowlist, url)?;
        let mut request = self
            .client
            .get(url.clone())
            .header(ACCEPT, HeaderValue::from_static("application/json"));
        let validator = etag.and_then(|e| HeaderValue::from_str(e).ok());
        let revalidating = validator.is_some();
        if let Some(value) = validator {
            request = request.header(IF_NONE_MATCH, value);
        }
        let mut response = request.send().await?;
        let status = response.status();
        if status == StatusCode::NOT_MODIFIED && revalidating {
            return Ok(Fetched::NotModified);
        }
        if status != StatusCode::OK {
            return Err(CatalogError::Http(status.as_u16()));
        }
        let limit = self.max_bytes;
        if response.content_length().is_some_and(|len| len > limit) {
            return Err(CatalogError::TooLarge { limit });
        }
        let etag = response
            .headers()
            .get(ETAG)
            .and_then(|v| v.to_str().ok())
            .filter(|v| !v.is_empty() && v.len() <= MAX_ETAG_LEN)
            .map(str::to_owned);
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            let len = u64::try_from(body.len() + chunk.len()).unwrap_or(u64::MAX);
            if len > limit {
                return Err(CatalogError::TooLarge { limit });
            }
            body.extend_from_slice(&chunk);
        }
        Ok(Fetched::Fresh { body, etag })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list(hosts: &[&str]) -> RwLock<Allowlist> {
        RwLock::new(
            hosts
                .iter()
                .fold(Allowlist::new(), |list, host| list.with(host)),
        )
    }

    #[test]
    fn urls_must_be_allowlisted_and_https() {
        let allow = list(&["127.0.0.1", "downloads.kvetka.example"]);
        let ok = |u: &str| check_url(&allow, &Url::parse(u).unwrap());
        assert!(ok("https://paparats-app.github.io/v1/catalog.json").is_ok());
        assert!(ok("https://downloads.kvetka.example/m.json").is_ok());
        assert!(ok("http://127.0.0.1:8080/catalog.json").is_ok());
        assert!(matches!(
            ok("https://evil.example/catalog.json"),
            Err(CatalogError::HostNotAllowed(h)) if h == "evil.example"
        ));
        assert!(matches!(
            ok("http://paparats-app.github.io/v1/catalog.json"),
            Err(CatalogError::InsecureUrl(_))
        ));
        assert!(matches!(
            ok("ftp://paparats-app.github.io/x"),
            Err(CatalogError::InvalidUrl(_))
        ));
        assert!(matches!(
            ok("https://user:pw@paparats-app.github.io/x"),
            Err(CatalogError::InvalidUrl(_))
        ));
        // Loopback over HTTP still needs the allowlist.
        assert!(matches!(
            ok("http://localhost:8080/x"),
            Err(CatalogError::HostNotAllowed(_))
        ));
        assert!(matches!(
            parse_url("not a url"),
            Err(CatalogError::InvalidUrl(_))
        ));
        assert!(matches!(
            parse_url("http://kvetka.example/m.json"),
            Err(CatalogError::InsecureUrl(_))
        ));
    }

    #[test]
    fn a_poisoned_allowlist_allows_nothing() {
        let allow = Arc::new(list(&["127.0.0.1"]));
        let poison = Arc::clone(&allow);
        let _ = std::thread::spawn(move || {
            let _guard = poison.write().unwrap();
            panic!("poison the lock");
        })
        .join();
        assert!(matches!(
            check_url(
                &allow,
                &Url::parse("https://paparats-app.github.io/x").unwrap()
            ),
            Err(CatalogError::HostNotAllowed(_))
        ));
    }
}
