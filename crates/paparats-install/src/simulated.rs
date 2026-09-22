//! The simulated strategy: no file-system side effects; "Installing…" holds for 8 ticks of
//! 110 ms (≈ 880 ms), counting only ticks during which the gate is open (the prototype's hold
//! also stops while offline).

use std::time::Duration;

use paparats_core::InstalledApp;

use crate::{BoxFuture, Gate, InstallError, InstallRequest, Installer};

/// The prototype's tick.
pub const TICK: Duration = Duration::from_millis(110);
/// Ticks spent in "Installing…" at 100 % before the app is installed.
pub const HOLD_TICKS: u32 = 8;

#[derive(Debug, Clone)]
pub struct SimulatedInstaller {
    tick: Duration,
    hold_ticks: u32,
}

impl Default for SimulatedInstaller {
    fn default() -> Self {
        Self {
            tick: TICK,
            hold_ticks: HOLD_TICKS,
        }
    }
}

impl SimulatedInstaller {
    /// The prototype's timings (8 × 110 ms).
    pub fn new() -> Self {
        Self::default()
    }

    /// Custom timings (tests).
    pub fn with_timing(tick: Duration, hold_ticks: u32) -> Self {
        Self { tick, hold_ticks }
    }
}

impl Installer for SimulatedInstaller {
    fn install<'a>(
        &'a self,
        request: InstallRequest<'a>,
        gate: &'a mut Gate,
    ) -> BoxFuture<'a, Result<InstalledApp, InstallError>> {
        Box::pin(async move {
            let mut held = 0;
            while held < self.hold_ticks {
                tokio::time::sleep(self.tick).await;
                let state = gate.state();
                if state.cancelled {
                    return Err(InstallError::Cancelled);
                }
                if state.is_open() {
                    held += 1;
                }
            }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GateState, InstallTarget, gate};
    use paparats_core::Package;
    use tokio::time::Instant;

    fn request<'a>(package: &'a Package, target: &'a InstallTarget) -> InstallRequest<'a> {
        InstallRequest {
            package,
            file: None,
            target,
            date: "2026-09-15",
        }
    }

    #[tokio::test(start_paused = true)]
    async fn holds_for_eight_ticks() {
        let package = Package::simulated("vlc", "3.0.21", 41.0);
        let target = InstallTarget::default();
        let (_ctl, mut g) = gate(GateState::OPEN);
        let start = Instant::now();
        let app = SimulatedInstaller::new()
            .install(request(&package, &target), &mut g)
            .await
            .unwrap();
        assert_eq!(start.elapsed(), TICK * HOLD_TICKS);
        assert_eq!(
            app,
            InstalledApp {
                app_id: "vlc".into(),
                version: "3.0.21".into(),
                last_used: "2026-09-15".into()
            }
        );
    }

    #[tokio::test(start_paused = true)]
    async fn offline_ticks_do_not_count() {
        let package = Package::simulated("vlc", "3.0.21", 41.0);
        let target = InstallTarget::default();
        let (ctl, mut g) = gate(GateState::OPEN);
        let start = Instant::now();
        let installer = SimulatedInstaller::new();
        let run = installer.install(request(&package, &target), &mut g);
        let toggler = async {
            tokio::time::sleep(TICK * 3 + TICK / 2).await;
            ctl.set_online(false);
            tokio::time::sleep(TICK * 5).await;
            ctl.set_online(true);
        };
        let (result, ()) = tokio::join!(run, toggler);
        result.unwrap();
        assert_eq!(start.elapsed(), TICK * (HOLD_TICKS + 5));
    }

    #[tokio::test(start_paused = true)]
    async fn cancel_stops_the_hold() {
        let package = Package::simulated("vlc", "3.0.21", 41.0);
        let target = InstallTarget::default();
        let (ctl, mut g) = gate(GateState::OPEN);
        ctl.cancel();
        let result = SimulatedInstaller::new()
            .install(request(&package, &target), &mut g)
            .await;
        assert!(matches!(result, Err(InstallError::Cancelled)));
        let app = InstalledApp {
            app_id: "vlc".into(),
            version: "1".into(),
            last_used: "2026-09-15".into(),
        };
        SimulatedInstaller::new().uninstall(&app).await.unwrap();
    }
}
