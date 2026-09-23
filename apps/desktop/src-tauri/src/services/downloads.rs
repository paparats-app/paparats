//! DownloadService: the queue. Finished downloads are recorded by the engine bridge
//! (`events::EngineBridge`) before `installed` is emitted.

use paparats_core::{DownloadRequest, DownloadSnapshot};
use paparats_download::Job;

use super::AppState;
use crate::error::AppResult;

impl AppState {
    pub fn download_snapshot(&self) -> DownloadSnapshot {
        self.engine.snapshot()
    }

    /// Adds requests to the queue (ids already queued/running are ignored). The mock world has
    /// no files: every request becomes a simulated package of `sizeMb`.
    pub fn enqueue_downloads(&self, requests: Vec<DownloadRequest>) {
        self.engine
            .enqueue(requests.into_iter().map(Job::simulated));
    }

    pub fn pause_download(&self, app_id: &str) {
        self.engine.pause(app_id);
    }

    pub fn resume_download(&self, app_id: &str) {
        self.engine.resume(app_id);
    }

    pub fn cancel_download(&self, app_id: &str) {
        self.engine.cancel(app_id);
    }

    pub fn pause_all_downloads(&self) {
        self.engine.pause_all();
    }

    pub fn resume_all_downloads(&self) {
        self.engine.resume_all();
    }

    pub fn cancel_all_downloads(&self) {
        self.engine.cancel_all();
    }

    /// "Parallel downloads"; 0 is rejected as `invalid`.
    pub fn set_download_concurrency(&self, limit: u8) -> AppResult<()> {
        Ok(self.engine.set_concurrency(limit)?)
    }

    /// Offline pauses running downloads; back online resumes them and starts queued ones.
    pub fn set_downloads_online(&self, online: bool) {
        self.engine.set_online(online);
    }
}

#[cfg(test)]
mod tests {
    use paparats_core::{ActivityKind, DownloadKind, DownloadPhase, DownloadState};
    use paparats_download::TICK;

    use super::super::testing::{TODAY, state};
    use super::*;
    use crate::error::AppError;

    fn request(app: &str, version: &str, kind: DownloadKind) -> DownloadRequest {
        DownloadRequest {
            app_id: app.into(),
            version: version.into(),
            size_mb: 12.0,
            kind,
        }
    }

    #[tokio::test(start_paused = true)]
    async fn finished_downloads_land_in_the_library_before_installed() {
        let (s, rec) = state();
        let usage = s.get_account().unwrap().usage.updates_installed;
        s.enqueue_downloads(vec![
            request("obsidian", "1.8.10", DownloadKind::Update),
            request("obs", "31.1.2", DownloadKind::Install),
        ]);
        let snap = s.download_snapshot();
        assert_eq!(snap.items.len(), 2);
        assert_eq!(snap.items[0].state, DownloadState::Downloading);
        assert_eq!(snap.concurrency, 2);

        // +10 % per tick: 100 % at tick 10, installed after the 8-tick hold.
        tokio::time::sleep(TICK * 18 + TICK / 2).await;
        assert!(s.download_snapshot().items.is_empty());

        let lib = s.get_library().unwrap();
        let obsidian = lib
            .installed
            .iter()
            .find(|a| a.app_id == "obsidian")
            .unwrap();
        assert_eq!(obsidian.version, "1.8.10");
        assert_eq!(obsidian.last_used, TODAY);
        assert_eq!(lib.installed.last().map(|a| a.app_id.as_str()), Some("obs"));

        let account = s.get_account().unwrap();
        assert_eq!(account.usage.updates_installed, usage + 1, "updates only");
        let kinds: Vec<_> = account.activity[..2]
            .iter()
            .map(|a| (a.app_id.as_str(), a.kind, a.date.as_str()))
            .collect();
        assert!(kinds.contains(&("obsidian", ActivityKind::Updated, TODAY)));
        assert!(kinds.contains(&("obs", ActivityKind::Installed, TODAY)));

        let states = rec.states.lock().unwrap().clone();
        assert!(states.iter().any(|c| c.app_id == "obsidian"
            && c.phase
                == DownloadPhase::Installed {
                    version: "1.8.10".into(),
                    update: true
                }));
        assert_eq!(rec.progress.lock().unwrap().len(), 20);
    }

    // --- parity with the TypeScript mock (`services/mock/downloads.test.ts`) -----------------
    // The same scenarios, timings and event sequences the UI tests rely on. Checks happen half a
    // tick after the mock's `ticks(n)` so no timer fires exactly on a boundary.

    use paparats_core::DownloadProgress;
    use tokio::time::Instant;

    use super::super::testing::{Recorder, state_with_random};

    /// Sleeps until `n` ticks and a half after `start`.
    async fn at(start: Instant, n: u32) {
        tokio::time::sleep_until(start + TICK * n + TICK / 2).await;
    }

    /// `appId:state` per queue item, like the mock tests' `states()`.
    fn states(s: &AppState) -> Vec<String> {
        s.download_snapshot()
            .items
            .iter()
            .map(|i| format!("{}:{:?}", i.app_id, i.state).to_lowercase())
            .collect()
    }

    fn phases(rec: &Recorder, app: &str) -> Vec<DownloadPhase> {
        rec.states
            .lock()
            .unwrap()
            .iter()
            .filter(|c| c.app_id == app)
            .map(|c| c.phase.clone())
            .collect()
    }

    fn progress_of(rec: &Recorder, app: &str) -> Vec<f64> {
        rec.progress
            .lock()
            .unwrap()
            .iter()
            .filter(|p| p.app_id == app)
            .map(|p| p.progress)
            .collect()
    }

    fn install(app: &str) -> DownloadRequest {
        DownloadRequest {
            app_id: app.into(),
            version: "9.9.9".into(),
            size_mb: 20.0,
            kind: DownloadKind::Install,
        }
    }

    #[tokio::test(start_paused = true)]
    async fn parity_two_at_a_time_and_queue_order() {
        let (s, rec) = state();
        s.enqueue_downloads(vec![install("files"), install("obs"), install("anki")]);
        assert_eq!(
            states(&s),
            ["files:downloading", "obs:downloading", "anki:queued"]
        );
        let all: Vec<(String, DownloadPhase)> = rec
            .states
            .lock()
            .unwrap()
            .iter()
            .map(|c| (c.app_id.clone(), c.phase.clone()))
            .collect();
        let expected = [
            ("files", DownloadPhase::Queued),
            ("obs", DownloadPhase::Queued),
            ("anki", DownloadPhase::Queued),
            ("files", DownloadPhase::Downloading),
            ("obs", DownloadPhase::Downloading),
        ]
        .map(|(app, phase)| (app.to_owned(), phase));
        assert_eq!(all, expected);
        assert_eq!(s.download_snapshot().concurrency, 2);
    }

    #[tokio::test(start_paused = true)]
    async fn parity_progress_and_received_megabytes() {
        let (s, rec) = state_with_random(0.0);
        let start = Instant::now();
        s.enqueue_downloads(vec![install("files")]);
        at(start, 2).await;
        assert_eq!(progress_of(&rec, "files"), [3.0, 6.0]);
        assert_eq!(
            rec.progress.lock().unwrap().last(),
            Some(&DownloadProgress {
                app_id: "files".into(),
                progress: 6.0,
                received_mb: 1.2,
                size_mb: 20.0,
            })
        );
    }

    #[tokio::test(start_paused = true)]
    async fn parity_concurrency_changes_apply_live() {
        let (s, _) = state();
        s.set_download_concurrency(1).unwrap();
        s.enqueue_downloads(vec![install("files"), install("obs"), install("anki")]);
        assert_eq!(
            states(&s),
            ["files:downloading", "obs:queued", "anki:queued"]
        );
        s.set_download_concurrency(4).unwrap();
        assert_eq!(
            states(&s),
            ["files:downloading", "obs:downloading", "anki:downloading"]
        );
        // Lowering the limit never stops running items; it only holds back new starts.
        s.set_download_concurrency(2).unwrap();
        s.enqueue_downloads(vec![install("joplin")]);
        assert_eq!(
            states(&s),
            [
                "files:downloading",
                "obs:downloading",
                "anki:downloading",
                "joplin:queued"
            ]
        );
    }

    #[tokio::test(start_paused = true)]
    async fn parity_installing_hold_then_record_then_next() {
        let (s, rec) = state();
        let usage = s.get_account().unwrap().usage.updates_installed;
        s.set_download_concurrency(1).unwrap();
        let start = Instant::now();
        s.enqueue_downloads(vec![install("files"), install("obs")]);

        at(start, 10).await;
        assert_eq!(
            phases(&rec, "files"),
            [
                DownloadPhase::Queued,
                DownloadPhase::Downloading,
                DownloadPhase::Installing
            ]
        );
        assert_eq!(states(&s), ["files:installing", "obs:queued"]);

        at(start, 17).await;
        assert_eq!(phases(&rec, "files").len(), 3, "still installing");
        let has_files = |s: &AppState| {
            s.get_library()
                .unwrap()
                .installed
                .iter()
                .any(|a| a.app_id == "files")
        };
        assert!(!has_files(&s));

        at(start, 18).await;
        assert_eq!(
            phases(&rec, "files").last(),
            Some(&DownloadPhase::Installed {
                version: "9.9.9".into(),
                update: false
            })
        );
        let lib = s.get_library().unwrap();
        let last = lib.installed.last().unwrap();
        assert_eq!(
            (
                last.app_id.as_str(),
                last.version.as_str(),
                last.last_used.as_str()
            ),
            ("files", "9.9.9", TODAY)
        );
        let account = s.get_account().unwrap();
        let first = &account.activity[0];
        assert_eq!(
            (first.kind, first.app_id.as_str(), first.date.as_str()),
            (ActivityKind::Installed, "files", TODAY)
        );
        assert_eq!(
            account.usage.updates_installed, usage,
            "installs are not counted"
        );
        assert_eq!(states(&s), ["obs:downloading"]);
    }

    #[tokio::test(start_paused = true)]
    async fn parity_paused_items_keep_their_slot() {
        let (s, rec) = state_with_random(0.0);
        s.set_download_concurrency(1).unwrap();
        let start = Instant::now();
        s.enqueue_downloads(vec![install("files"), install("obs")]);
        at(start, 1).await;

        s.pause_download("files");
        s.pause_download("obs"); // queued: nothing to pause
        at(start, 6).await;
        assert_eq!(progress_of(&rec, "files"), [3.0]);
        assert_eq!(states(&s), ["files:paused", "obs:queued"]);

        s.resume_download("files");
        at(start, 7).await;
        assert_eq!(progress_of(&rec, "files"), [3.0, 6.0]);
        assert_eq!(
            phases(&rec, "files"),
            [
                DownloadPhase::Queued,
                DownloadPhase::Downloading,
                DownloadPhase::Paused,
                DownloadPhase::Downloading
            ]
        );
        assert_eq!(phases(&rec, "obs"), [DownloadPhase::Queued]);
    }

    #[tokio::test(start_paused = true)]
    async fn parity_pause_all_and_resume_all_touch_running_items_only() {
        let (s, _) = state();
        s.enqueue_downloads(vec![install("files"), install("obs"), install("anki")]);
        s.pause_all_downloads();
        assert_eq!(states(&s), ["files:paused", "obs:paused", "anki:queued"]);
        s.resume_all_downloads();
        assert_eq!(
            states(&s),
            ["files:downloading", "obs:downloading", "anki:queued"]
        );
    }

    #[tokio::test(start_paused = true)]
    async fn parity_cancel_pumps_the_next_item() {
        let (s, rec) = state();
        let start = Instant::now();
        s.enqueue_downloads(vec![
            install("files"),
            install("obs"),
            install("anki"),
            install("joplin"),
        ]);
        s.cancel_download("files");
        assert_eq!(
            states(&s),
            ["obs:downloading", "anki:downloading", "joplin:queued"]
        );
        s.cancel_download("joplin");
        assert_eq!(states(&s), ["obs:downloading", "anki:downloading"]);
        assert_eq!(
            phases(&rec, "files").last(),
            Some(&DownloadPhase::Cancelled)
        );
        assert_eq!(
            phases(&rec, "joplin"),
            [DownloadPhase::Queued, DownloadPhase::Cancelled]
        );
        at(start, 30).await;
        let lib = s.get_library().unwrap();
        assert!(!lib.installed.iter().any(|a| a.app_id == "files"));
        assert!(progress_of(&rec, "files").is_empty());
    }

    #[tokio::test(start_paused = true)]
    async fn parity_offline_holds_everything_until_back_online() {
        let (s, rec) = state();
        s.set_download_concurrency(1).unwrap();
        let start = Instant::now();
        s.enqueue_downloads(vec![install("files")]);
        at(start, 2).await;
        s.set_downloads_online(false);
        s.enqueue_downloads(vec![install("obs")]);
        s.cancel_download("files");

        at(start, 22).await;
        assert_eq!(progress_of(&rec, "files"), [10.0, 20.0]);
        assert_eq!(states(&s), ["obs:queued"]);
        assert!(!s.download_snapshot().online);

        s.set_downloads_online(true);
        assert_eq!(states(&s), ["obs:downloading"]);
        // obs started half a tick off the grid: its first tick is one tick from now.
        tokio::time::sleep(TICK + TICK / 2).await;
        assert_eq!(progress_of(&rec, "obs"), [10.0]);
    }

    #[tokio::test(start_paused = true)]
    async fn parity_offline_freezes_without_changing_states() {
        let (s, rec) = state();
        let start = Instant::now();
        s.enqueue_downloads(vec![install("files")]);
        at(start, 1).await;
        s.set_downloads_online(false);
        at(start, 11).await;
        assert_eq!(progress_of(&rec, "files"), [10.0]);
        assert_eq!(states(&s), ["files:downloading"]);
        s.set_downloads_online(true);
        at(start, 12).await;
        assert_eq!(progress_of(&rec, "files"), [10.0, 20.0]);
    }

    #[tokio::test(start_paused = true)]
    async fn parity_duplicates_are_ignored() {
        let (s, rec) = state();
        s.set_download_concurrency(1).unwrap();
        s.enqueue_downloads(vec![install("files"), install("obs")]);
        s.enqueue_downloads(vec![
            install("files"),
            install("obs"),
            install("anki"),
            install("anki"),
        ]);
        assert_eq!(
            states(&s),
            ["files:downloading", "obs:queued", "anki:queued"]
        );
        assert_eq!(phases(&rec, "anki"), [DownloadPhase::Queued]);
    }

    #[tokio::test(start_paused = true)]
    async fn queue_controls() {
        let (s, rec) = state();
        s.set_download_concurrency(1).unwrap();
        assert!(matches!(
            s.set_download_concurrency(0),
            Err(AppError::Invalid(_))
        ));
        s.enqueue_downloads(vec![
            request("a", "1", DownloadKind::Install),
            request("b", "1", DownloadKind::Install),
        ]);
        s.pause_download("a");
        s.resume_download("a");
        s.pause_all_downloads();
        assert_eq!(s.download_snapshot().items[0].state, DownloadState::Paused);
        s.resume_all_downloads();
        s.set_downloads_online(false);
        assert!(!s.download_snapshot().online);
        s.set_downloads_online(true);
        s.cancel_download("a");
        assert_eq!(s.download_snapshot().items[0].app_id, "b");
        s.cancel_all_downloads();
        assert!(s.download_snapshot().items.is_empty());
        let cancelled = rec
            .states
            .lock()
            .unwrap()
            .iter()
            .filter(|c| c.phase == DownloadPhase::Cancelled)
            .count();
        assert_eq!(cancelled, 2);
    }
}
