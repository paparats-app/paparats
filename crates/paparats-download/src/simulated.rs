//! The simulated transfer: the prototype's timings. Every 110 ms tick a running item gains
//! `3 + random·7` % (capped at 100); ticks while paused or offline do nothing.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use paparats_install::{BoxFuture, Gate};

use crate::{DownloadError, Job, ProgressFn, Transfer, TransferOutput, TransferProgress};

/// The prototype's download tick.
pub const TICK: Duration = Duration::from_millis(110);

/// Source of the per-tick increment, in `[0, 1)`. Injectable so tests are deterministic.
pub type Random = Arc<dyn Fn() -> f64 + Send + Sync>;

#[derive(Clone)]
pub struct SimulatedTransfer {
    tick: Duration,
    random: Random,
}

impl std::fmt::Debug for SimulatedTransfer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SimulatedTransfer")
            .field("tick", &self.tick)
            .finish_non_exhaustive()
    }
}

impl Default for SimulatedTransfer {
    fn default() -> Self {
        Self {
            tick: TICK,
            random: xorshift(),
        }
    }
}

impl SimulatedTransfer {
    /// The prototype's tick and a time-seeded pseudo-random increment.
    pub fn new() -> Self {
        Self::default()
    }

    /// A fixed source of randomness (tests).
    pub fn with_random(random: impl Fn() -> f64 + Send + Sync + 'static) -> Self {
        Self {
            tick: TICK,
            random: Arc::new(random),
        }
    }

    pub fn with_tick(mut self, tick: Duration) -> Self {
        self.tick = tick;
        self
    }
}

/// xorshift64*: plenty for a progress animation, no dependency, not for anything secret.
fn xorshift() -> Random {
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0x9E37_79B9_7F4A_7C15, |d| d.as_nanos() as u64)
        | 1;
    let state = AtomicU64::new(seed);
    Arc::new(move || {
        let step = |mut x: u64| {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            x
        };
        // A compare-exchange loop rather than `fetch_update`, which newer toolchains deprecate
        // (renamed `try_update`, not yet in the minimum supported Rust).
        let mut prev = state.load(Ordering::Relaxed);
        while let Err(current) =
            state.compare_exchange_weak(prev, step(prev), Ordering::Relaxed, Ordering::Relaxed)
        {
            prev = current;
        }
        (step(prev) >> 11) as f64 / (1_u64 << 53) as f64
    })
}

/// Megabytes received at `progress` %, rounded to 0.1 MB like the mock.
fn received_mb(size_mb: f64, progress: f64) -> f64 {
    (size_mb * progress / 10.0).round() / 10.0
}

impl Transfer for SimulatedTransfer {
    fn run<'a>(
        &'a self,
        job: &'a Job,
        gate: &'a mut Gate,
        progress: ProgressFn<'a>,
    ) -> BoxFuture<'a, Result<TransferOutput, DownloadError>> {
        Box::pin(async move {
            let size_mb = job.request.size_mb;
            let mut pct: f64 = 0.0;
            loop {
                tokio::time::sleep(self.tick).await;
                let state = gate.state();
                if state.cancelled {
                    return Err(DownloadError::Cancelled);
                }
                if !state.is_open() {
                    continue;
                }
                let r = (self.random)().clamp(0.0, 1.0);
                pct = (pct + 3.0 + r * 7.0).min(100.0);
                progress(TransferProgress {
                    progress: pct,
                    received_mb: received_mb(size_mb, pct),
                });
                if pct >= 100.0 {
                    return Ok(TransferOutput::default());
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use paparats_core::{DownloadKind, DownloadRequest};
    use paparats_install::{GateState, gate};
    use std::sync::Mutex;
    use tokio::time::Instant;

    fn job() -> Job {
        Job::simulated(DownloadRequest {
            app_id: "vlc".into(),
            version: "3.0.21".into(),
            size_mb: 40.0,
            kind: DownloadKind::Update,
        })
    }

    #[test]
    fn default_random_stays_in_range() {
        let r = xorshift();
        for _ in 0..10_000 {
            let x = r();
            assert!((0.0..1.0).contains(&x), "{x}");
        }
    }

    #[tokio::test(start_paused = true)]
    async fn ten_percent_per_tick_takes_ten_ticks() {
        let seen = Mutex::new(Vec::new());
        let report = |p: TransferProgress| seen.lock().unwrap().push(p);
        let (_ctl, mut g) = gate(GateState::OPEN);
        let start = Instant::now();
        let out = SimulatedTransfer::with_random(|| 1.0)
            .run(&job(), &mut g, &report)
            .await
            .unwrap();
        assert_eq!(out, TransferOutput::default());
        assert_eq!(start.elapsed(), TICK * 10);
        let seen = seen.into_inner().unwrap();
        assert_eq!(seen.len(), 10);
        assert_eq!(seen[0].progress, 10.0);
        assert_eq!(seen[0].received_mb, 4.0);
        assert_eq!(seen[9].progress, 100.0);
        assert_eq!(seen[9].received_mb, 40.0);
    }

    #[tokio::test(start_paused = true)]
    async fn slowest_increment_and_cap() {
        let (_ctl, mut g) = gate(GateState::OPEN);
        let start = Instant::now();
        let last = Mutex::new(0.0);
        let report = |p: TransferProgress| *last.lock().unwrap() = p.progress;
        SimulatedTransfer::with_random(|| 0.0)
            .run(&job(), &mut g, &report)
            .await
            .unwrap();
        // 3 % per tick: 34 ticks, the last one capped at exactly 100.
        assert_eq!(start.elapsed(), TICK * 34);
        assert_eq!(*last.lock().unwrap(), 100.0);
    }

    #[tokio::test(start_paused = true)]
    async fn paused_ticks_do_nothing_and_cancel_stops() {
        let (ctl, mut g) = gate(GateState::OPEN);
        let count = Mutex::new(0);
        let report = |_: TransferProgress| *count.lock().unwrap() += 1;
        let transfer = SimulatedTransfer::with_random(|| 1.0);
        let job = job();
        let run = transfer.run(&job, &mut g, &report);
        let driver = async {
            tokio::time::sleep(TICK * 2 + TICK / 2).await;
            ctl.set_paused(true);
            tokio::time::sleep(TICK * 4).await;
            assert_eq!(*count.lock().unwrap(), 2, "no progress while paused");
            ctl.cancel();
        };
        let (result, ()) = tokio::join!(run, driver);
        assert!(matches!(result, Err(DownloadError::Cancelled)));
    }
}
