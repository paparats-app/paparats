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
