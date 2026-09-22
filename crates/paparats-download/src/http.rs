//! The real transfer: streams the package to `<work_dir>/<app>-<version>.part`, resumes with an
//! HTTP `Range` request after a pause or while offline, verifies the SHA-256 from the (signed)
//! manifest, then renames the file. Only allowlisted hosts are contacted — redirects included —
//! and only over HTTPS (plain HTTP is accepted for loopback test servers).

use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::Duration;

use paparats_core::bytes_to_mb;
use paparats_core::hosts::{Allowlist, is_loopback};
use paparats_install::{BoxFuture, Gate};
use reqwest::header::{CONTENT_RANGE, RANGE};
use reqwest::{Client, StatusCode, Url, redirect};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::time::MissedTickBehavior;

use crate::{DownloadError, Job, ProgressFn, Transfer, TransferOutput, TransferProgress};

/// Progress cadence while bytes are flowing (10 Hz).
pub const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);

/// How [`HttpTransfer`] is set up.
#[derive(Debug, Clone)]
pub struct HttpTransferConfig {
    /// Where partial and verified downloads are kept.
    pub work_dir: PathBuf,
    /// Hosts the transfer may contact (first-party + hosts from verified manifests).
    pub allowlist: Arc<RwLock<Allowlist>>,
    /// Honour `HTTP(S)_PROXY` from the environment.
    pub use_env_proxy: bool,
}

#[derive(Debug, Clone)]
pub struct HttpTransfer {
    client: Client,
    work_dir: PathBuf,
    allowlist: Arc<RwLock<Allowlist>>,
}

enum Fetch {
    /// The whole body is on disk.
    Complete,
    /// Paused or offline: the connection was dropped, the part file kept.
    Interrupted,
}

/// Checks scheme and host of a URL against the allowlist.
fn check_url(allowlist: &RwLock<Allowlist>, url: &Url) -> Result<(), DownloadError> {
    let host = url
        .host_str()
        .ok_or_else(|| DownloadError::InvalidUrl("no host".into()))?;
    match url.scheme() {
        "https" => {}
        "http" if is_loopback(host) => {}
        "http" => return Err(DownloadError::InsecureUrl(host.to_owned())),
        other => return Err(DownloadError::InvalidUrl(format!("scheme {other}"))),
    }
    // A poisoned allowlist allows nothing.
    let allowed = allowlist.read().is_ok_and(|list| list.is_allowed(host));
    if allowed {
        Ok(())
    } else {
        Err(DownloadError::HostNotAllowed(host.to_owned()))
    }
}

/// Keeps a file-name component to `[A-Za-z0-9._-]`.
fn sanitize(part: &str) -> String {
    part.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

async fn existing_len(path: &Path) -> Result<u64, DownloadError> {
    match tokio::fs::metadata(path).await {
        Ok(m) => Ok(m.len()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(0),
        Err(e) => Err(e.into()),
    }
}

/// Lower-case hex SHA-256 of a file.
pub(crate) async fn sha256_file(path: &Path) -> Result<String, DownloadError> {
    let mut file = tokio::fs::File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0_u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}

/// `Content-Range: bytes <start>-<end>/<total>` must start where the part file ends.
fn content_range_start(value: Option<&reqwest::header::HeaderValue>) -> Option<u64> {
    let text = value?.to_str().ok()?;
    let range = text.strip_prefix("bytes ")?;
    range.split('-').next()?.trim().parse().ok()
}

struct Reporter<'a> {
    progress: ProgressFn<'a>,
    total: u64,
}

impl Reporter<'_> {
    fn report(&self, received: u64) {
        let pct = if self.total == 0 {
            0.0
        } else {
            (received as f64 * 100.0 / self.total as f64).min(100.0)
        };
        (self.progress)(TransferProgress {
            progress: pct,
            received_mb: bytes_to_mb(received),
        });
    }
}

impl HttpTransfer {
    pub fn new(config: HttpTransferConfig) -> Result<Self, DownloadError> {
        let policy_list = Arc::clone(&config.allowlist);
        let policy = redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() >= 5 {
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
            .connect_timeout(Duration::from_secs(20))
            .read_timeout(Duration::from_secs(60));
        if !config.use_env_proxy {
            builder = builder.no_proxy();
        }
        Ok(Self {
            client: builder.build()?,
            work_dir: config.work_dir,
            allowlist: config.allowlist,
        })
    }

    /// Where the partial download of `job` lives.
    pub fn part_path(&self, job: &Job) -> PathBuf {
        let p = &job.package;
        self.work_dir.join(format!(
            "{}-{}.part",
            sanitize(&p.app_id),
            sanitize(&p.version)
        ))
    }

    /// Where the verified download of `job` is moved (keeps the URL's file extension).
    fn final_path(&self, job: &Job, url: &Url) -> PathBuf {
        let p = &job.package;
        let ext = url
            .path_segments()
            .and_then(|mut s| s.next_back())
            .and_then(|name| Path::new(name).extension())
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", sanitize(e)))
            .unwrap_or_default();
        self.work_dir.join(format!(
            "{}-{}{ext}",
            sanitize(&p.app_id),
            sanitize(&p.version)
        ))
    }

    async fn download(
        &self,
        job: &Job,
        gate: &mut Gate,
        progress: ProgressFn<'_>,
        part: &Path,
    ) -> Result<TransferOutput, DownloadError> {
        let url = job
            .package
            .url
            .as_deref()
            .ok_or(DownloadError::MissingUrl)?;
        let url = Url::parse(url).map_err(|e| DownloadError::InvalidUrl(e.to_string()))?;
        check_url(&self.allowlist, &url)?;
        let expected = job
            .package
            .sha256
            .as_deref()
            .ok_or(DownloadError::MissingHash)?
            .to_ascii_lowercase();
        let limit = job.package.size_bytes;
        tokio::fs::create_dir_all(&self.work_dir).await?;
        let mut reporter = Reporter {
            progress,
            total: limit,
        };

        loop {
            gate.wait_open().await?;
            let offset = existing_len(part).await?;
            if limit > 0 && offset > limit {
                return Err(DownloadError::TooLarge { expected: limit });
            }
            if limit > 0 && offset == limit {
                break;
            }
            match self
                .fetch(&url, offset, limit, gate, part, &mut reporter)
                .await?
            {
                Fetch::Complete => break,
                Fetch::Interrupted => {}
            }
        }

        let actual = sha256_file(part).await?;
        if actual != expected {
            return Err(DownloadError::HashMismatch { expected, actual });
        }
        let done = self.final_path(job, &url);
        tokio::fs::rename(part, &done).await?;
        let size = existing_len(&done).await?;
        (reporter.progress)(TransferProgress {
            progress: 100.0,
            received_mb: bytes_to_mb(size),
        });
        Ok(TransferOutput { file: Some(done) })
    }

    /// One HTTP request from `offset` to the end, or until the gate closes.
    async fn fetch(
        &self,
        url: &Url,
        offset: u64,
        limit: u64,
        gate: &mut Gate,
        part: &Path,
        reporter: &mut Reporter<'_>,
    ) -> Result<Fetch, DownloadError> {
        let mut request = self.client.get(url.clone());
        if offset > 0 {
            request = request.header(RANGE, format!("bytes={offset}-"));
        }
        let send = request.send();
        tokio::pin!(send);
        let mut response = loop {
            tokio::select! {
                response = &mut send => break response?,
                state = gate.changed() => {
                    if state.cancelled {
                        return Err(DownloadError::Cancelled);
                    }
                    if !state.is_open() {
                        return Ok(Fetch::Interrupted);
                    }
                }
            }
        };

        let (mut file, mut received) = match response.status() {
            StatusCode::PARTIAL_CONTENT if offset > 0 => {
                if content_range_start(response.headers().get(CONTENT_RANGE)) != Some(offset) {
                    return Err(DownloadError::Network("unexpected Content-Range".into()));
                }
                let file = tokio::fs::OpenOptions::new()
                    .append(true)
                    .open(part)
                    .await?;
                (file, offset)
            }
            // The server ignored the range (or this is the first request): start over.
            StatusCode::OK => (tokio::fs::File::create(part).await?, 0),
            // Everything is already on disk.
            StatusCode::RANGE_NOT_SATISFIABLE if offset > 0 => return Ok(Fetch::Complete),
            status => return Err(DownloadError::Http(status.as_u16())),
        };
        if limit == 0 {
            reporter.total = response.content_length().map_or(0, |len| len + received);
        }
        reporter.report(received);

        let mut ticker = tokio::time::interval(PROGRESS_INTERVAL);
        ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            tokio::select! {
                chunk = response.chunk() => match chunk? {
                    Some(bytes) => {
                        received += bytes.len() as u64;
                        if limit > 0 && received > limit {
                            return Err(DownloadError::TooLarge { expected: limit });
                        }
                        file.write_all(&bytes).await?;
                    }
                    None => {
                        file.flush().await?;
                        reporter.report(received);
                        return Ok(Fetch::Complete);
                    }
                },
                _ = ticker.tick() => reporter.report(received),
                state = gate.changed() => {
                    if state.cancelled {
                        return Err(DownloadError::Cancelled);
                    }
                    if !state.is_open() {
                        file.flush().await?;
                        reporter.report(received);
                        return Ok(Fetch::Interrupted);
                    }
                }
            }
        }
    }
}

impl Transfer for HttpTransfer {
    fn run<'a>(
        &'a self,
        job: &'a Job,
        gate: &'a mut Gate,
        progress: ProgressFn<'a>,
    ) -> BoxFuture<'a, Result<TransferOutput, DownloadError>> {
        Box::pin(async move {
            let part = self.part_path(job);
            let result = self.download(job, gate, progress, &part).await;
            if result.is_err() {
                // Cancelled, failed or unverifiable: never leave an untrusted file behind.
                if let Err(e) = tokio::fs::remove_file(&part).await
                    && e.kind() != std::io::ErrorKind::NotFound
                {
                    tracing::debug!(error = %e, "could not remove a partial download");
                }
            }
            result
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list(hosts: &[&str]) -> RwLock<Allowlist> {
        RwLock::new(hosts.iter().fold(Allowlist::new(), |l, h| l.with(h)))
    }

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn urls_must_be_allowlisted_and_https() {
        let l = list(&["downloads.nilesoft.org", "127.0.0.1"]);
        assert!(check_url(&l, &url("https://cdn.paparats.app/x.msi")).is_ok());
        assert!(check_url(&l, &url("https://downloads.nilesoft.org/x.msi")).is_ok());
        assert!(check_url(&l, &url("http://127.0.0.1:8080/x")).is_ok());
        assert!(matches!(
            check_url(&l, &url("http://downloads.nilesoft.org/x.msi")),
            Err(DownloadError::InsecureUrl(_))
        ));
        assert!(matches!(
            check_url(&l, &url("https://evil.example/x.msi")),
            Err(DownloadError::HostNotAllowed(_))
        ));
        assert!(matches!(
            check_url(&l, &url("ftp://cdn.paparats.app/x")),
            Err(DownloadError::InvalidUrl(_))
        ));
        assert!(matches!(
            check_url(&list(&[]), &url("http://127.0.0.1/x")),
            Err(DownloadError::HostNotAllowed(_))
        ));
    }

    #[test]
    fn file_names_are_sanitised() {
        assert_eq!(sanitize("shell"), "shell");
        assert_eq!(sanitize("../evil\\x y"), ".._evil_x_y");
        assert_eq!(sanitize("1.9.15-beta_2"), "1.9.15-beta_2");
    }

    #[test]
    fn content_range_parsing() {
        use reqwest::header::HeaderValue;
        let v = HeaderValue::from_static("bytes 1024-2047/2048");
        assert_eq!(content_range_start(Some(&v)), Some(1024));
        assert_eq!(content_range_start(None), None);
        let bad = HeaderValue::from_static("items 1-2/3");
        assert_eq!(content_range_start(Some(&bad)), None);
    }
}
