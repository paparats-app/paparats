//! `HttpTransfer` end to end through the engine, against a tiny local HTTP/1.1 server that
//! supports `Range` and streams slowly enough to pause, go offline and cancel mid-download.

// Test code: helpers outside `#[test]` fns are not covered by clippy's allow-unwrap-in-tests.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

use paparats_core::hosts::Allowlist;
use paparats_core::{
    DownloadKind, DownloadPhase, DownloadProgress, DownloadRequest, DownloadStateChange,
    InstallStrategy, InstalledApp, Package,
};
use paparats_download::{
    DownloadEngine, DownloadObserver, EngineConfig, HttpTransfer, HttpTransferConfig, Job,
};
use paparats_install::{BoxFuture, Gate, InstallError, InstallRequest, Installer};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;

// ---------------------------------------------------------------------------------------------
// Test server
// ---------------------------------------------------------------------------------------------

struct Server {
    addr: SocketAddr,
    /// The `Range` header of every request, in order.
    ranges: Arc<Mutex<Vec<Option<String>>>>,
}

impl Server {
    /// Serves `body` at every path except `/missing` (404), `chunk` bytes at a time with `delay`
    /// between chunks.
    async fn start(body: Arc<Vec<u8>>, chunk: usize, delay: Duration) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let ranges = Arc::new(Mutex::new(Vec::new()));
        let seen = Arc::clone(&ranges);
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    return;
                };
                let (body, seen) = (Arc::clone(&body), Arc::clone(&seen));
                tokio::spawn(async move {
                    // A client that hangs up mid-body is expected (pause, cancel).
                    let _ = serve(stream, &body, chunk, delay, &seen).await;
                });
            }
        });
        Self { addr, ranges }
    }

    fn url(&self, path: &str) -> String {
        format!("http://{}{path}", self.addr)
    }

    fn ranges(&self) -> Vec<Option<String>> {
        self.ranges.lock().unwrap().clone()
    }
}

async fn serve(
    stream: TcpStream,
    body: &[u8],
    chunk: usize,
    delay: Duration,
    seen: &Mutex<Vec<Option<String>>>,
) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).await?;
    let path = request_line
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .to_owned();
    let mut range = None;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).await?;
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':')
            && name.eq_ignore_ascii_case("range")
        {
            range = Some(value.trim().to_owned());
        }
    }
    seen.lock().unwrap().push(range.clone());
    let mut stream = reader.into_inner();

    if path == "/missing" {
        let head = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        return stream.write_all(head.as_bytes()).await;
    }
    let len = body.len();
    let start: usize = range
        .as_deref()
        .and_then(|r| r.strip_prefix("bytes="))
        .and_then(|r| r.strip_suffix('-'))
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);
    if start >= len && range.is_some() {
        let head = format!(
            "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{len}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        return stream.write_all(head.as_bytes()).await;
    }
    let head = if range.is_some() {
        format!(
            "HTTP/1.1 206 Partial Content\r\nContent-Length: {}\r\nContent-Range: bytes {start}-{}/{len}\r\nConnection: close\r\n\r\n",
            len - start,
            len - 1
        )
    } else {
        format!("HTTP/1.1 200 OK\r\nContent-Length: {len}\r\nConnection: close\r\n\r\n")
    };
    stream.write_all(head.as_bytes()).await?;
    for piece in body[start..].chunks(chunk) {
        stream.write_all(piece).await?;
        stream.flush().await?;
        tokio::time::sleep(delay).await;
    }
    stream.shutdown().await
}

// ---------------------------------------------------------------------------------------------
// Engine plumbing
// ---------------------------------------------------------------------------------------------

#[derive(Debug)]
enum Ev {
    Progress(DownloadProgress),
    State(DownloadStateChange),
}

struct Channel {
    tx: mpsc::UnboundedSender<Ev>,
}

impl DownloadObserver for Channel {
    fn progress(&self, p: DownloadProgress) {
        let _ = self.tx.send(Ev::Progress(p));
    }

    fn state(&self, c: DownloadStateChange) {
        let _ = self.tx.send(Ev::State(c));
    }

    fn installed(&self, _request: &DownloadRequest, _app: &InstalledApp) -> Result<(), String> {
        Ok(())
    }
}

/// Installs only a file that exists and matches the manifest hash; remembers what it saw.
#[derive(Default)]
struct CheckingInstaller {
    seen: Mutex<Vec<PathBuf>>,
}

impl Installer for CheckingInstaller {
    fn install<'a>(
        &'a self,
        request: InstallRequest<'a>,
        _gate: &'a mut Gate,
    ) -> BoxFuture<'a, Result<InstalledApp, InstallError>> {
        Box::pin(async move {
            let file = request.file.ok_or(InstallError::MissingFile)?;
            let bytes = tokio::fs::read(file)
                .await
                .map_err(|e| InstallError::Failed(e.to_string()))?;
            if Some(sha256(&bytes)) != request.package.sha256 {
                return Err(InstallError::Failed("hash".into()));
            }
            self.seen.lock().unwrap().push(file.to_path_buf());
            Ok(InstalledApp {
                app_id: request.package.app_id.clone(),
                version: request.package.version.clone(),
                last_used: request.date.to_owned(),
            })
        })
    }

    fn uninstall<'a>(&'a self, _app: &'a InstalledApp) -> BoxFuture<'a, Result<(), InstallError>> {
        Box::pin(async { Ok(()) })
    }
}

fn sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn body(len: usize) -> Arc<Vec<u8>> {
    Arc::new((0..len).map(|i| (i * 31 % 251) as u8).collect())
}

struct Harness {
    engine: DownloadEngine,
    events: mpsc::UnboundedReceiver<Ev>,
    installer: Arc<CheckingInstaller>,
    work_dir: tempfile::TempDir,
    transfer: Arc<HttpTransfer>,
}

fn harness(allow: &[&str]) -> Harness {
    let work_dir = tempfile::tempdir().unwrap();
    let allowlist = allow.iter().fold(Allowlist::new(), |l, h| l.with(h));
    let transfer = Arc::new(
        HttpTransfer::new(HttpTransferConfig {
            work_dir: work_dir.path().to_path_buf(),
            allowlist: Arc::new(RwLock::new(allowlist)),
            use_env_proxy: false,
        })
        .unwrap(),
    );
    let (tx, events) = mpsc::unbounded_channel();
    let installer = Arc::new(CheckingInstaller::default());
    let engine = DownloadEngine::new(
        Arc::clone(&transfer) as _,
        Arc::clone(&installer) as _,
        Arc::new(Channel { tx }),
        EngineConfig::new(Arc::new(|| "2026-09-15".to_owned())),
        tokio::runtime::Handle::current(),
    )
    .unwrap();
    Harness {
        engine,
        events,
        installer,
        work_dir,
        transfer,
    }
}

fn job(url: String, body: &[u8], sha: Option<String>) -> Job {
    Job {
        request: DownloadRequest {
            app_id: "shell".into(),
            version: "1.9.15".into(),
            size_mb: body.len() as f64 / 1_048_576.0,
            kind: DownloadKind::Update,
        },
        package: Package {
            app_id: "shell".into(),
            version: "1.9.15".into(),
            url: Some(url),
            sha256: Some(sha.unwrap_or_else(|| sha256(body))),
            size_bytes: body.len() as u64,
            strategy: InstallStrategy::Msi,
            signer: None,
        },
    }
}

impl Harness {
    /// Waits (≤ 10 s) for an event matching `pred`, returning it.
    async fn wait_for(&mut self, what: &str, pred: impl Fn(&Ev) -> bool) -> Ev {
        let wait = async {
            while let Some(ev) = self.events.recv().await {
                if pred(&ev) {
                    return ev;
                }
            }
            panic!("event stream ended before {what}");
        };
        tokio::time::timeout(Duration::from_secs(10), wait)
            .await
            .unwrap_or_else(|_| panic!("timed out waiting for {what}"))
    }

    async fn wait_phase(
        &mut self,
        what: &str,
        pred: impl Fn(&DownloadPhase) -> bool,
    ) -> DownloadPhase {
        match self
            .wait_for(what, |e| matches!(e, Ev::State(c) if pred(&c.phase)))
            .await
        {
            Ev::State(c) => c.phase,
            Ev::Progress(_) => unreachable!(),
        }
    }

    async fn wait_progress_over(&mut self, pct: f64) {
        self.wait_for(
            "progress",
            |e| matches!(e, Ev::Progress(p) if p.progress > pct),
        )
        .await;
    }

    fn part_file(&self, job: &Job) -> PathBuf {
        self.transfer.part_path(job)
    }

    fn files(&self) -> Vec<PathBuf> {
        list(self.work_dir.path())
    }
}

fn list(dir: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(dir)
        .map(|entries| entries.filter_map(|e| e.ok().map(|e| e.path())).collect())
        .unwrap_or_default()
}

fn is_installed(p: &DownloadPhase) -> bool {
    matches!(p, DownloadPhase::Installed { .. })
}

fn is_failed(p: &DownloadPhase) -> bool {
    matches!(p, DownloadPhase::Failed { .. })
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

#[tokio::test]
async fn downloads_verifies_installs_and_cleans_up() {
    let data = body(200_000);
    let server = Server::start(Arc::clone(&data), 16 * 1024, Duration::ZERO).await;
    let mut h = harness(&["127.0.0.1"]);
    let job = job(server.url("/shell-1.9.15.msi"), &data, None);
    h.engine.enqueue([job]);

    let phase = h
        .wait_phase("installed", |p| is_installed(p) || is_failed(p))
        .await;
    assert_eq!(
        phase,
        DownloadPhase::Installed {
            version: "1.9.15".into(),
            update: true
        }
    );
    let seen = h.installer.seen.lock().unwrap().clone();
    assert_eq!(seen.len(), 1);
    assert_eq!(
        seen[0].file_name().and_then(|n| n.to_str()),
        Some("shell-1.9.15.msi"),
        "the verified file is named for its strategy (MSI)"
    );
    assert!(h.files().is_empty(), "installer file removed after install");
    assert_eq!(server.ranges(), [None]);
}

#[tokio::test]
async fn pause_resumes_with_a_range_request() {
    let data = body(256 * 1024);
    let server = Server::start(Arc::clone(&data), 8 * 1024, Duration::from_millis(15)).await;
    let mut h = harness(&["127.0.0.1"]);
    let job = job(server.url("/shell.msi"), &data, None);
    let part = h.part_file(&job);
    h.engine.enqueue([job]);

    h.wait_progress_over(10.0).await;
    h.engine.pause("shell");
    h.wait_phase("paused", |p| *p == DownloadPhase::Paused)
        .await;
    // Give the transfer a moment to drop the connection and flush.
    tokio::time::sleep(Duration::from_millis(150)).await;
    let kept = std::fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    assert!(
        kept > 0 && kept < data.len() as u64,
        "partial file kept ({kept})"
    );
    assert_eq!(
        h.engine.snapshot().items[0].state,
        paparats_core::DownloadState::Paused
    );

    h.engine.resume("shell");
    let phase = h
        .wait_phase("installed", |p| is_installed(p) || is_failed(p))
        .await;
    assert!(is_installed(&phase), "{phase:?}");
    let ranges = server.ranges();
    assert_eq!(ranges.len(), 2, "{ranges:?}");
    assert_eq!(ranges[0], None);
    let resumed_from: u64 = ranges[1]
        .as_deref()
        .and_then(|r| r.strip_prefix("bytes="))
        .and_then(|r| r.strip_suffix('-'))
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);
    assert!(
        resumed_from >= kept,
        "resumed at {resumed_from}, kept {kept}"
    );
    assert!(resumed_from > 0);
}

#[tokio::test]
async fn offline_interrupts_and_back_online_resumes() {
    let data = body(256 * 1024);
    let server = Server::start(Arc::clone(&data), 8 * 1024, Duration::from_millis(15)).await;
    let mut h = harness(&["127.0.0.1"]);
    h.engine
        .enqueue([job(server.url("/shell.msi"), &data, None)]);

    h.wait_progress_over(10.0).await;
    h.engine.set_online(false);
    tokio::time::sleep(Duration::from_millis(200)).await;
    let progress = h.engine.snapshot().items[0].progress;
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(
        h.engine.snapshot().items[0].progress,
        progress,
        "no progress while offline"
    );
    h.engine.set_online(true);
    let phase = h
        .wait_phase("installed", |p| is_installed(p) || is_failed(p))
        .await;
    assert!(is_installed(&phase), "{phase:?}");
    assert!(server.ranges().iter().skip(1).all(Option::is_some));
    assert!(server.ranges().len() >= 2);
}

#[tokio::test]
async fn hash_mismatch_fails_and_removes_the_file() {
    let data = body(50_000);
    let server = Server::start(Arc::clone(&data), 16 * 1024, Duration::ZERO).await;
    let mut h = harness(&["127.0.0.1"]);
    h.engine
        .enqueue([job(server.url("/shell.msi"), &data, Some("00".repeat(32)))]);
    let phase = h
        .wait_phase("failed", |p| is_installed(p) || is_failed(p))
        .await;
    match phase {
        DownloadPhase::Failed { message } => assert!(message.contains("SHA-256"), "{message}"),
        other => panic!("expected failed, got {other:?}"),
    }
    assert!(
        h.installer.seen.lock().unwrap().is_empty(),
        "never installed"
    );
    assert!(h.files().is_empty(), "no untrusted file left behind");
    assert!(h.engine.snapshot().items.is_empty());
}

#[tokio::test]
async fn hosts_outside_the_allowlist_are_never_contacted() {
    let data = body(1_000);
    let server = Server::start(Arc::clone(&data), 1_000, Duration::ZERO).await;
    let mut h = harness(&[]);
    h.engine
        .enqueue([job(server.url("/shell.msi"), &data, None)]);
    let phase = h
        .wait_phase("failed", |p| is_installed(p) || is_failed(p))
        .await;
    match phase {
        DownloadPhase::Failed { message } => assert!(message.contains("allowlist"), "{message}"),
        other => panic!("expected failed, got {other:?}"),
    }
    assert!(server.ranges().is_empty());
}

#[tokio::test]
async fn server_errors_fail_the_item() {
    let data = body(1_000);
    let server = Server::start(Arc::clone(&data), 1_000, Duration::ZERO).await;
    let mut h = harness(&["127.0.0.1"]);
    h.engine.enqueue([job(server.url("/missing"), &data, None)]);
    let phase = h
        .wait_phase("failed", |p| is_installed(p) || is_failed(p))
        .await;
    assert_eq!(
        phase,
        DownloadPhase::Failed {
            message: "server answered HTTP 404".into()
        }
    );
}

#[tokio::test]
async fn cancel_removes_the_partial_download() {
    let data = body(256 * 1024);
    let server = Server::start(Arc::clone(&data), 8 * 1024, Duration::from_millis(15)).await;
    let mut h = harness(&["127.0.0.1"]);
    let job = job(server.url("/shell.msi"), &data, None);
    let part = h.part_file(&job);
    h.engine.enqueue([job]);
    h.wait_progress_over(5.0).await;
    h.engine.cancel("shell");
    h.wait_phase("cancelled", |p| *p == DownloadPhase::Cancelled)
        .await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert!(!part.exists(), "partial download removed");
    assert!(h.files().is_empty());
    assert!(h.installer.seen.lock().unwrap().is_empty());
}
