//! Engine behaviour with the simulated transfer, on paused tokio time. The test sleeps to
//! half-tick offsets so it never races the items' 110 ms ticks.

use std::sync::Mutex;

use paparats_core::{DownloadKind, DownloadPhase, DownloadRequest, DownloadState, InstalledApp};
use paparats_install::{BoxFuture, SimulatedInstaller};

use super::*;
use crate::{ProgressFn, SimulatedTransfer, TICK};

#[derive(Debug, Clone, PartialEq)]
enum Ev {
    Progress(String, f64),
    State(String, DownloadPhase),
}

#[derive(Default)]
struct Recorder {
    events: Mutex<Vec<Ev>>,
    installed: Mutex<Vec<(DownloadRequest, InstalledApp)>>,
    reject_installs: Mutex<bool>,
}

impl DownloadObserver for Recorder {
    fn progress(&self, p: DownloadProgress) {
        self.events
            .lock()
            .unwrap()
            .push(Ev::Progress(p.app_id, p.progress));
    }

    fn state(&self, c: DownloadStateChange) {
        self.events
            .lock()
            .unwrap()
            .push(Ev::State(c.app_id, c.phase));
    }

    fn installed(&self, request: &DownloadRequest, app: &InstalledApp) -> Result<(), String> {
        if *self.reject_installs.lock().unwrap() {
            return Err("disk full".into());
        }
        self.installed
            .lock()
            .unwrap()
            .push((request.clone(), app.clone()));
        Ok(())
    }
}

impl Recorder {
    fn events(&self) -> Vec<Ev> {
        self.events.lock().unwrap().clone()
    }

    fn phases(&self, app: &str) -> Vec<DownloadPhase> {
        self.events()
            .into_iter()
            .filter_map(|e| match e {
                Ev::State(id, p) if id == app => Some(p),
                _ => None,
            })
            .collect()
    }

    fn progress_count(&self, app: &str) -> usize {
        self.events()
            .iter()
            .filter(|e| matches!(e, Ev::Progress(id, _) if id == app))
            .count()
    }

    /// Index of the first state event matching.
    fn index_of(&self, app: &str, phase: &DownloadPhase) -> usize {
        self.events()
            .iter()
            .position(|e| matches!(e, Ev::State(id, p) if id == app && p == phase))
            .unwrap_or_else(|| panic!("no {phase:?} for {app}"))
    }
}

fn request(app: &str, kind: DownloadKind) -> DownloadRequest {
    DownloadRequest {
        app_id: app.into(),
        version: "2.0".into(),
        size_mb: 50.0,
        kind,
    }
}

fn job(app: &str) -> Job {
    Job::simulated(request(app, DownloadKind::Install))
}

fn engine_with(concurrency: u8, transfer: Arc<dyn Transfer>) -> (DownloadEngine, Arc<Recorder>) {
    let recorder = Arc::new(Recorder::default());
    let config = EngineConfig {
        concurrency,
        ..EngineConfig::new(Arc::new(|| "2026-09-15".to_owned()))
    };
    let engine = DownloadEngine::new(
        transfer,
        Arc::new(SimulatedInstaller::new()),
        Arc::clone(&recorder) as Arc<dyn DownloadObserver>,
        config,
        Handle::current(),
    )
    .unwrap();
    (engine, recorder)
}

/// +10 % per tick: 100 % after 10 ticks, installed 8 ticks later.
fn engine(concurrency: u8) -> (DownloadEngine, Arc<Recorder>) {
    engine_with(
        concurrency,
        Arc::new(SimulatedTransfer::with_random(|| 1.0)),
    )
}

/// Sleeps to `ticks` ticks (plus half a tick) after the start of the test.
async fn at(start: tokio::time::Instant, ticks: u32) {
    tokio::time::sleep_until(start + TICK * ticks + TICK / 2).await;
}

fn states(engine: &DownloadEngine) -> Vec<(String, DownloadState)> {
    engine
        .snapshot()
        .items
        .into_iter()
        .map(|i| (i.app_id, i.state))
        .collect()
}

fn installed_phase(update: bool) -> DownloadPhase {
    DownloadPhase::Installed {
        version: "2.0".into(),
        update,
    }
}

use DownloadState::{Downloading, Installing, Paused, Queued};

#[tokio::test(start_paused = true)]
async fn single_download_runs_the_full_lifecycle() {
    let (engine, rec) = engine(2);
    let start = tokio::time::Instant::now();
    engine.enqueue([Job::simulated(request("vlc", DownloadKind::Update))]);
    assert_eq!(
        rec.phases("vlc"),
        [DownloadPhase::Queued, DownloadPhase::Downloading]
    );

    at(start, 4).await;
    let snap = engine.snapshot();
    assert_eq!(snap.items.len(), 1);
    assert_eq!(snap.items[0].state, Downloading);
    assert_eq!(snap.items[0].progress, 40.0);
    assert_eq!(snap.items[0].kind, DownloadKind::Update);
    assert_eq!(snap.concurrency, 2);
    assert!(snap.online);

    at(start, 10).await;
    assert_eq!(states(&engine), [("vlc".into(), Installing)]);
    assert_eq!(engine.snapshot().items[0].progress, 100.0);
    assert_eq!(rec.progress_count("vlc"), 10);

    at(start, 17).await;
    assert_eq!(states(&engine), [("vlc".into(), Installing)], "8-tick hold");

    at(start, 18).await;
    assert!(engine.snapshot().items.is_empty());
    assert_eq!(
        rec.phases("vlc"),
        [
            DownloadPhase::Queued,
            DownloadPhase::Downloading,
            DownloadPhase::Installing,
            installed_phase(true),
        ]
    );
    let installed = rec.installed.lock().unwrap().clone();
    assert_eq!(installed.len(), 1);
    assert_eq!(
        installed[0].1,
        InstalledApp {
            app_id: "vlc".into(),
            version: "2.0".into(),
            last_used: "2026-09-15".into()
        }
    );
}

#[tokio::test(start_paused = true)]
async fn concurrency_limits_started_items() {
    let (engine, rec) = engine(2);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b", "c"].map(job));
    assert_eq!(
        states(&engine),
        [
            ("a".into(), Downloading),
            ("b".into(), Downloading),
            ("c".into(), Queued)
        ]
    );
    at(start, 17).await;
    assert_eq!(states(&engine)[2], ("c".into(), Queued));
    at(start, 18).await;
    assert_eq!(states(&engine), [("c".into(), Downloading)]);
    assert!(
        rec.index_of("c", &DownloadPhase::Downloading) > rec.index_of("a", &installed_phase(false)),
        "c starts after a slot frees"
    );
    at(start, 36).await;
    assert!(engine.snapshot().items.is_empty());
    assert_eq!(rec.installed.lock().unwrap().len(), 3);
}

#[tokio::test(start_paused = true)]
async fn raising_concurrency_starts_queued_items_immediately() {
    let (engine, rec) = engine(1);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b", "c"].map(job));
    at(start, 3).await;
    assert_eq!(states(&engine)[1], ("b".into(), Queued));
    engine.set_concurrency(4).unwrap();
    assert_eq!(
        states(&engine),
        [
            ("a".into(), Downloading),
            ("b".into(), Downloading),
            ("c".into(), Downloading)
        ]
    );
    assert_eq!(rec.phases("c").last(), Some(&DownloadPhase::Downloading));
    assert_eq!(engine.concurrency(), 4);
}

#[tokio::test(start_paused = true)]
async fn lowering_concurrency_lets_started_items_finish() {
    let (engine, _rec) = engine(2);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b", "c", "d"].map(job));
    at(start, 3).await;
    engine.set_concurrency(1).unwrap();
    assert_eq!(
        states(&engine),
        [
            ("a".into(), Downloading),
            ("b".into(), Downloading),
            ("c".into(), Queued),
            ("d".into(), Queued)
        ],
        "running items keep going"
    );
    at(start, 18).await;
    assert_eq!(
        states(&engine),
        [("c".into(), Downloading), ("d".into(), Queued)],
        "only one slot after both finished"
    );
}

#[tokio::test(start_paused = true)]
async fn pause_and_resume_one_item() {
    let (engine, rec) = engine(2);
    let start = tokio::time::Instant::now();
    engine.enqueue([job("a")]);
    at(start, 2).await;
    engine.pause("a");
    assert_eq!(states(&engine), [("a".into(), Paused)]);
    assert_eq!(rec.phases("a").last(), Some(&DownloadPhase::Paused));
    at(start, 6).await;
    assert_eq!(
        engine.snapshot().items[0].progress,
        20.0,
        "paused ticks do nothing"
    );
    assert_eq!(rec.progress_count("a"), 2);
    engine.resume("a");
    assert_eq!(states(&engine), [("a".into(), Downloading)]);
    // Ticks 7‥14 add the remaining 80 %, then the 8-tick hold.
    at(start, 14).await;
    assert_eq!(states(&engine), [("a".into(), Installing)]);
    at(start, 22).await;
    assert!(engine.snapshot().items.is_empty());
    assert_eq!(rec.phases("a").last(), Some(&installed_phase(false)));
}

#[tokio::test(start_paused = true)]
async fn pause_only_touches_downloading_items() {
    let (engine, rec) = engine(1);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b"].map(job));
    engine.pause("b");
    engine.resume("a");
    assert_eq!(rec.phases("b"), [DownloadPhase::Queued]);
    assert_eq!(
        rec.phases("a"),
        [DownloadPhase::Queued, DownloadPhase::Downloading]
    );
    at(start, 11).await;
    engine.pause("a"); // installing: ignored
    assert_eq!(states(&engine)[0], ("a".into(), Installing));
    at(start, 18).await;
    assert_eq!(rec.phases("a").last(), Some(&installed_phase(false)));
    engine.pause("ghost");
}

#[tokio::test(start_paused = true)]
async fn pause_all_and_resume_all() {
    let (engine, rec) = engine(2);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b", "c"].map(job));
    at(start, 1).await;
    engine.pause_all();
    assert_eq!(
        states(&engine),
        [
            ("a".into(), Paused),
            ("b".into(), Paused),
            ("c".into(), Queued)
        ]
    );
    at(start, 5).await;
    assert_eq!(rec.progress_count("a"), 1);
    engine.resume_all();
    assert_eq!(
        states(&engine),
        [
            ("a".into(), Downloading),
            ("b".into(), Downloading),
            ("c".into(), Queued)
        ]
    );
}

#[tokio::test(start_paused = true)]
async fn offline_freezes_started_items_and_holds_the_queue() {
    let (engine, rec) = engine(1);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b"].map(job));
    at(start, 2).await;
    engine.set_online(false);
    assert!(!engine.snapshot().online);
    engine.enqueue([job("c")]);
    at(start, 10).await;
    assert_eq!(engine.snapshot().items[0].progress, 20.0);
    assert_eq!(
        states(&engine),
        [
            ("a".into(), Downloading),
            ("b".into(), Queued),
            ("c".into(), Queued)
        ],
        "state stays downloading, like the mock"
    );
    engine.set_online(true);
    assert!(engine.is_online());
    // Ticks 11‥18 finish the transfer, 19‥26 the hold; then b starts.
    at(start, 18).await;
    assert_eq!(states(&engine)[0], ("a".into(), Installing));
    at(start, 26).await;
    assert_eq!(states(&engine)[0], ("b".into(), Downloading));
    assert_eq!(rec.phases("a").last(), Some(&installed_phase(false)));
}

#[tokio::test(start_paused = true)]
async fn offline_also_stops_the_installing_hold() {
    let (engine, _rec) = engine(1);
    let start = tokio::time::Instant::now();
    engine.enqueue([job("a")]);
    at(start, 12).await;
    engine.set_online(false);
    at(start, 30).await;
    assert_eq!(states(&engine), [("a".into(), Installing)]);
    engine.set_online(true);
    // Hold ticks 11 and 12 counted; 6 more after going back online.
    at(start, 36).await;
    assert!(engine.snapshot().items.is_empty());
}

#[tokio::test(start_paused = true)]
async fn nothing_starts_while_offline() {
    let (engine, rec) = engine(2);
    engine.set_online(false);
    engine.enqueue([job("a")]);
    assert_eq!(states(&engine), [("a".into(), Queued)]);
    assert_eq!(rec.phases("a"), [DownloadPhase::Queued]);
    engine.set_online(true);
    assert_eq!(states(&engine), [("a".into(), Downloading)]);
}

#[tokio::test(start_paused = true)]
async fn cancel_removes_an_item_and_starts_the_next() {
    let (engine, rec) = engine(1);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b", "c"].map(job));
    at(start, 2).await;
    engine.cancel("a");
    assert_eq!(rec.phases("a").last(), Some(&DownloadPhase::Cancelled));
    assert_eq!(
        states(&engine),
        [("b".into(), Downloading), ("c".into(), Queued)]
    );
    engine.cancel("c");
    assert_eq!(rec.phases("c").last(), Some(&DownloadPhase::Cancelled));
    engine.cancel("ghost");
    let count = rec.progress_count("a");
    at(start, 30).await;
    assert_eq!(rec.progress_count("a"), count, "a's task stopped");
    assert_eq!(
        rec.phases("a"),
        [
            DownloadPhase::Queued,
            DownloadPhase::Downloading,
            DownloadPhase::Cancelled
        ]
    );
    assert_eq!(rec.phases("b").last(), Some(&installed_phase(false)));
}

#[tokio::test(start_paused = true)]
async fn cancel_while_installing_records_nothing() {
    let (engine, rec) = engine(1);
    let start = tokio::time::Instant::now();
    engine.enqueue([job("a")]);
    at(start, 12).await;
    engine.cancel("a");
    at(start, 30).await;
    assert!(rec.installed.lock().unwrap().is_empty());
    assert_eq!(rec.phases("a").last(), Some(&DownloadPhase::Cancelled));
}

#[tokio::test(start_paused = true)]
async fn cancel_all_empties_the_queue() {
    let (engine, rec) = engine(2);
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b", "c"].map(job));
    at(start, 3).await;
    engine.cancel_all();
    assert!(engine.snapshot().items.is_empty());
    for app in ["a", "b", "c"] {
        assert_eq!(rec.phases(app).last(), Some(&DownloadPhase::Cancelled));
    }
    let before = rec.events().len();
    at(start, 30).await;
    assert_eq!(rec.events().len(), before, "no events after cancel all");
}

#[tokio::test(start_paused = true)]
async fn duplicates_are_ignored() {
    let (engine, rec) = engine(1);
    engine.enqueue(["a", "a", "b"].map(job));
    engine.enqueue(["a", "b"].map(job));
    assert_eq!(engine.snapshot().items.len(), 2);
    assert_eq!(
        rec.phases("a"),
        [DownloadPhase::Queued, DownloadPhase::Downloading]
    );
    assert_eq!(rec.phases("b"), [DownloadPhase::Queued]);
}

#[tokio::test(start_paused = true)]
async fn a_failed_recording_becomes_failed() {
    let (engine, rec) = engine(1);
    *rec.reject_installs.lock().unwrap() = true;
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b"].map(job));
    at(start, 18).await;
    assert_eq!(
        rec.phases("a").last(),
        Some(&DownloadPhase::Failed {
            message: "disk full".into()
        })
    );
    assert_eq!(states(&engine), [("b".into(), Downloading)]);
}

struct BrokenTransfer;

impl Transfer for BrokenTransfer {
    fn run<'a>(
        &'a self,
        _job: &'a Job,
        _gate: &'a mut Gate,
        _progress: ProgressFn<'a>,
    ) -> BoxFuture<'a, Result<TransferOutput, DownloadError>> {
        Box::pin(async {
            tokio::time::sleep(TICK).await;
            Err(DownloadError::Http(503))
        })
    }
}

#[tokio::test(start_paused = true)]
async fn transfer_errors_fail_the_item_and_start_the_next() {
    let (engine, rec) = engine_with(1, Arc::new(BrokenTransfer));
    let start = tokio::time::Instant::now();
    engine.enqueue(["a", "b"].map(job));
    at(start, 1).await;
    assert_eq!(
        rec.phases("a").last(),
        Some(&DownloadPhase::Failed {
            message: "server answered HTTP 503".into()
        })
    );
    assert_eq!(states(&engine), [("b".into(), Downloading)]);
}

#[tokio::test(start_paused = true)]
async fn concurrency_must_be_positive() {
    let (engine, _rec) = engine(2);
    assert!(matches!(
        engine.set_concurrency(0),
        Err(DownloadError::InvalidConcurrency(0))
    ));
    assert_eq!(engine.concurrency(), 2);
    let config = EngineConfig {
        concurrency: 0,
        ..EngineConfig::new(Arc::new(|| "2026-09-15".to_owned()))
    };
    assert!(
        DownloadEngine::new(
            Arc::new(SimulatedTransfer::new()),
            Arc::new(SimulatedInstaller::new()),
            Arc::new(Recorder::default()),
            config,
            Handle::current(),
        )
        .is_err()
    );
}
