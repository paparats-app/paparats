//! The queue. State lives behind one mutex that is never held across an `.await` or while
//! calling the observer; events produced under the lock are dispatched right after it is released.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard};

use paparats_core::{
    AppId, DownloadItem, DownloadKind, DownloadPhase, DownloadProgress, DownloadRequest,
    DownloadSnapshot, DownloadState, DownloadStateChange, InstalledApp, IsoDate,
};
use paparats_install::{
    Gate, GateController, GateState, InstallError, InstallRequest, InstallTarget, Installer, gate,
};
use tokio::runtime::Handle;

use crate::{DownloadError, Job, Transfer, TransferOutput, TransferProgress};

/// Today's date, stamped on finished installs.
pub type Clock = Arc<dyn Fn() -> IsoDate + Send + Sync>;

/// The application side of the engine.
pub trait DownloadObserver: Send + Sync + 'static {
    /// Progress of a downloading item (every transfer tick / ≥ 10 Hz for HTTP).
    fn progress(&self, progress: DownloadProgress);
    /// A lifecycle change.
    fn state(&self, change: DownloadStateChange);
    /// The installer finished: record the app in the inventory (and activity) now — this runs
    /// before `installed` is emitted. An error turns the outcome into `failed`.
    fn installed(&self, request: &DownloadRequest, app: &InstalledApp) -> Result<(), String>;
}

/// Engine settings.
#[derive(Clone)]
pub struct EngineConfig {
    /// "Parallel downloads" (1, 2 or 4 in the UI; any value ≥ 1 is accepted).
    pub concurrency: u8,
    pub target: InstallTarget,
    /// Keep downloaded installers after installing ("Keep installers").
    pub keep_downloads: bool,
    pub clock: Clock,
}

impl std::fmt::Debug for EngineConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("EngineConfig")
            .field("concurrency", &self.concurrency)
            .field("target", &self.target)
            .field("keep_downloads", &self.keep_downloads)
            .finish_non_exhaustive()
    }
}

/// The prototype's default: 2 parallel downloads.
pub const DEFAULT_CONCURRENCY: u8 = 2;

impl EngineConfig {
    pub fn new(clock: Clock) -> Self {
        Self {
            concurrency: DEFAULT_CONCURRENCY,
            target: InstallTarget::default(),
            keep_downloads: false,
            clock,
        }
    }
}

struct Entry {
    /// Unique per start of this engine; stale tasks compare it before touching the entry.
    run: u64,
    job: Arc<Job>,
    state: DownloadState,
    progress: f64,
    /// Present once started.
    gate: Option<GateController>,
}

impl Entry {
    fn app_id(&self) -> &str {
        &self.job.request.app_id
    }

    fn item(&self) -> DownloadItem {
        let r = &self.job.request;
        DownloadItem {
            app_id: r.app_id.clone(),
            version: r.version.clone(),
            kind: r.kind,
            state: self.state,
            progress: self.progress,
            size_mb: r.size_mb,
        }
    }
}

struct State {
    /// Started items (downloading, paused, installing) in start order.
    running: Vec<Entry>,
    /// Waiting items in queue order.
    queue: VecDeque<Entry>,
    concurrency: u8,
    online: bool,
    next_run: u64,
}

/// Lifecycle events produced under the lock, dispatched after it is released.
type Event = DownloadStateChange;

fn phase(app_id: &str, phase: DownloadPhase) -> Event {
    DownloadStateChange {
        app_id: app_id.to_owned(),
        phase,
    }
}

/// An item to spawn once the lock is released.
struct Start {
    run: u64,
    job: Arc<Job>,
    gate: Gate,
}

impl State {
    fn contains(&self, app_id: &str) -> bool {
        self.running.iter().any(|e| e.app_id() == app_id)
            || self.queue.iter().any(|e| e.app_id() == app_id)
    }

    fn running_mut(&mut self, run: u64) -> Option<&mut Entry> {
        self.running.iter_mut().find(|e| e.run == run)
    }

    fn take_running(&mut self, run: u64) -> Option<Entry> {
        let at = self.running.iter().position(|e| e.run == run)?;
        Some(self.running.remove(at))
    }

    /// Starts queued items while there is room (the prototype's `pump()`).
    fn pump(&mut self, events: &mut Vec<Event>) -> Vec<Start> {
        let mut starts = Vec::new();
        if !self.online {
            return starts;
        }
        while self.running.len() < usize::from(self.concurrency) {
            let Some(mut entry) = self.queue.pop_front() else {
                break;
            };
            let (controller, gate) = gate(GateState::OPEN);
            entry.state = DownloadState::Downloading;
            entry.gate = Some(controller);
            events.push(phase(entry.app_id(), DownloadPhase::Downloading));
            starts.push(Start {
                run: entry.run,
                job: Arc::clone(&entry.job),
                gate,
            });
            self.running.push(entry);
        }
        starts
    }

    /// Pauses (`true`) or resumes (`false`) a started item in the matching state.
    fn set_paused(entry: &mut Entry, paused: bool, events: &mut Vec<Event>) {
        let (from, to) = if paused {
            (DownloadState::Downloading, DownloadState::Paused)
        } else {
            (DownloadState::Paused, DownloadState::Downloading)
        };
        if entry.state != from {
            return;
        }
        entry.state = to;
        if let Some(g) = &entry.gate {
            g.set_paused(paused);
        }
        let p = if paused {
            DownloadPhase::Paused
        } else {
            DownloadPhase::Downloading
        };
        events.push(phase(entry.app_id(), p));
    }

    fn cancel_entry(entry: Entry, events: &mut Vec<Event>) {
        if let Some(g) = &entry.gate {
            g.cancel();
        }
        events.push(phase(entry.app_id(), DownloadPhase::Cancelled));
    }
}

struct Inner {
    state: Mutex<State>,
    transfer: Arc<dyn Transfer>,
    installer: Arc<dyn Installer>,
    observer: Arc<dyn DownloadObserver>,
    runtime: Handle,
    target: InstallTarget,
    keep_downloads: bool,
    clock: Clock,
}

/// The download queue. Cheap to clone (shared state).
#[derive(Clone)]
pub struct DownloadEngine {
    inner: Arc<Inner>,
}

impl std::fmt::Debug for DownloadEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DownloadEngine").finish_non_exhaustive()
    }
}

impl DownloadEngine {
    /// Creates an engine that spawns its item tasks on `runtime`.
    pub fn new(
        transfer: Arc<dyn Transfer>,
        installer: Arc<dyn Installer>,
        observer: Arc<dyn DownloadObserver>,
        config: EngineConfig,
        runtime: Handle,
    ) -> Result<Self, DownloadError> {
        if config.concurrency == 0 {
            return Err(DownloadError::InvalidConcurrency(0));
        }
        Ok(Self {
            inner: Arc::new(Inner {
                state: Mutex::new(State {
                    running: Vec::new(),
                    queue: VecDeque::new(),
                    concurrency: config.concurrency,
                    online: true,
                    next_run: 0,
                }),
                transfer,
                installer,
                observer,
                runtime,
                target: config.target,
                keep_downloads: config.keep_downloads,
                clock: config.clock,
            }),
        })
    }

    /// The whole queue: started items first (in start order), then queued ones.
    pub fn snapshot(&self) -> DownloadSnapshot {
        let s = self.inner.lock();
        DownloadSnapshot {
            items: s.running.iter().chain(&s.queue).map(Entry::item).collect(),
            concurrency: s.concurrency,
            online: s.online,
        }
    }

    /// Adds jobs to the end of the queue; apps already queued or started are ignored.
    pub fn enqueue(&self, jobs: impl IntoIterator<Item = Job>) {
        self.inner.mutate(|s, events| {
            for job in jobs {
                if s.contains(&job.request.app_id) {
                    continue;
                }
                let run = s.next_run;
                s.next_run += 1;
                events.push(phase(&job.request.app_id, DownloadPhase::Queued));
                s.queue.push_back(Entry {
                    run,
                    job: Arc::new(job),
                    state: DownloadState::Queued,
                    progress: 0.0,
                    gate: None,
                });
            }
            s.pump(events)
        });
    }

    /// Pauses a downloading item (anything else is ignored).
    pub fn pause(&self, app_id: &str) {
        self.set_paused(Some(app_id), true);
    }

    /// Resumes a paused item (anything else is ignored).
    pub fn resume(&self, app_id: &str) {
        self.set_paused(Some(app_id), false);
    }

    pub fn pause_all(&self) {
        self.set_paused(None, true);
    }

    pub fn resume_all(&self) {
        self.set_paused(None, false);
    }

    fn set_paused(&self, app_id: Option<&str>, paused: bool) {
        self.inner.mutate(|s, events| {
            for entry in &mut s.running {
                if app_id.is_none_or(|id| entry.app_id() == id) {
                    State::set_paused(entry, paused, events);
                }
            }
            Vec::new()
        });
    }

    /// Removes an item from the queue (any state) and starts the next one.
    pub fn cancel(&self, app_id: &str) {
        self.inner.mutate(|s, events| {
            if let Some(at) = s.running.iter().position(|e| e.app_id() == app_id) {
                State::cancel_entry(s.running.remove(at), events);
            } else if let Some(at) = s.queue.iter().position(|e| e.app_id() == app_id)
                && let Some(entry) = s.queue.remove(at)
            {
                State::cancel_entry(entry, events);
            }
            s.pump(events)
        });
    }

    /// Empties the queue.
    pub fn cancel_all(&self) {
        self.inner.mutate(|s, events| {
            let running = std::mem::take(&mut s.running);
            let queued = std::mem::take(&mut s.queue);
            for entry in running.into_iter().chain(queued) {
                State::cancel_entry(entry, events);
            }
            Vec::new()
        });
    }

    /// Changes "Parallel downloads" live. Lowering it lets started items finish; raising it
    /// starts queued items immediately.
    pub fn set_concurrency(&self, limit: u8) -> Result<(), DownloadError> {
        if limit == 0 {
            return Err(DownloadError::InvalidConcurrency(limit));
        }
        self.inner.mutate(|s, events| {
            s.concurrency = limit;
            s.pump(events)
        });
        Ok(())
    }

    /// Offline: started items stop advancing and nothing new starts. Online: they continue and
    /// queued items start.
    pub fn set_online(&self, online: bool) {
        self.inner.mutate(|s, events| {
            s.online = online;
            for entry in &s.running {
                if let Some(g) = &entry.gate {
                    g.set_online(online);
                }
            }
            s.pump(events)
        });
    }

    pub fn concurrency(&self) -> u8 {
        self.inner.lock().concurrency
    }

    pub fn is_online(&self) -> bool {
        self.inner.lock().online
    }
}

impl Inner {
    fn lock(&self) -> MutexGuard<'_, State> {
        // The state is plain data; a panic elsewhere must not wedge the queue.
        self.state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn dispatch(&self, events: Vec<Event>) {
        for event in events {
            self.observer.state(event);
        }
    }

    /// Runs `f` under the lock, then emits its events and spawns the items it started.
    fn mutate(self: &Arc<Self>, f: impl FnOnce(&mut State, &mut Vec<Event>) -> Vec<Start>) {
        let mut events = Vec::new();
        let starts = {
            let mut s = self.lock();
            f(&mut s, &mut events)
        };
        self.dispatch(events);
        for start in starts {
            let inner = Arc::clone(self);
            self.runtime
                .spawn(async move { inner.drive(start.run, start.job, start.gate).await });
        }
    }

    fn report(&self, run: u64, p: TransferProgress) {
        let event = {
            let mut s = self.lock();
            let Some(entry) = s.running_mut(run) else {
                return;
            };
            if entry.state == DownloadState::Installing {
                return;
            }
            entry.progress = p.progress;
            DownloadProgress {
                app_id: entry.job.request.app_id.clone(),
                progress: p.progress,
                received_mb: p.received_mb,
                size_mb: entry.job.request.size_mb,
            }
        };
        self.observer.progress(event);
    }

    /// Moves a started item to `installing`. `false` when it was cancelled meanwhile.
    fn begin_install(&self, run: u64) -> bool {
        let event = {
            let mut s = self.lock();
            let Some(entry) = s.running_mut(run) else {
                return false;
            };
            entry.state = DownloadState::Installing;
            entry.progress = 100.0;
            // A pause that raced with the last tick must not freeze the install step.
            if let Some(g) = &entry.gate {
                g.set_paused(false);
            }
            phase(entry.app_id(), DownloadPhase::Installing)
        };
        self.dispatch(vec![event]);
        true
    }

    /// The item's task: transfer → install → record → `installed`.
    async fn drive(self: Arc<Self>, run: u64, job: Arc<Job>, mut gate: Gate) {
        let app_id: AppId = job.request.app_id.clone();
        let report = |p: TransferProgress| self.report(run, p);
        let output = match self.transfer.run(&job, &mut gate, &report).await {
            Ok(output) => output,
            Err(DownloadError::Cancelled) => return,
            Err(e) => {
                tracing::warn!(app = %app_id, error = %e, "download failed");
                return self.fail(run, e.to_string());
            }
        };
        if !self.begin_install(run) {
            self.discard(&output).await;
            return;
        }
        let date = (self.clock)();
        let request = InstallRequest {
            package: &job.package,
            file: output.file.as_deref(),
            target: &self.target,
            date: &date,
        };
        let result = self.installer.install(request, &mut gate).await;
        if !self.keep_downloads {
            self.discard(&output).await;
        }
        match result {
            Ok(app) => self.finish(run, &job.request, &app),
            Err(InstallError::Cancelled) => {}
            Err(e) => {
                tracing::warn!(app = %app_id, error = %e, "install failed");
                self.fail(run, e.to_string());
            }
        }
    }

    async fn discard(&self, output: &TransferOutput) {
        if let Some(file) = &output.file
            && let Err(e) = tokio::fs::remove_file(file).await
        {
            tracing::debug!(error = %e, "could not remove a downloaded package");
        }
    }

    fn finish(self: &Arc<Self>, run: u64, request: &DownloadRequest, app: &InstalledApp) {
        if self.lock().take_running(run).is_none() {
            return; // cancelled while installing
        }
        let outcome = match self.observer.installed(request, app) {
            Ok(()) => DownloadPhase::Installed {
                version: app.version.clone(),
                update: request.kind == DownloadKind::Update,
            },
            Err(message) => {
                tracing::warn!(app = %request.app_id, "recording the install failed");
                DownloadPhase::Failed { message }
            }
        };
        self.dispatch(vec![phase(&request.app_id, outcome)]);
        self.mutate(|s, events| s.pump(events));
    }

    fn fail(self: &Arc<Self>, run: u64, message: String) {
        let Some(entry) = self.lock().take_running(run) else {
            return;
        };
        self.dispatch(vec![phase(
            entry.app_id(),
            DownloadPhase::Failed { message },
        )]);
        self.mutate(|s, events| s.pump(events));
    }
}

#[cfg(test)]
mod tests;
