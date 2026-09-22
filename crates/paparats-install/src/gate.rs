//! The run permission of one queue item. The download engine owns the [`GateController`]; the
//! transfer and the installer step hold the [`Gate`] and only advance while it is open (not
//! paused, online) — exactly like the prototype's tick, which does nothing while an item is
//! paused or the client is offline.

use tokio::sync::watch;

/// The item was cancelled (or the engine forgot it).
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("cancelled")]
pub struct Cancelled;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GateState {
    /// Paused by the user (downloading items only).
    pub paused: bool,
    /// The client is online.
    pub online: bool,
    /// Removed from the queue; the step must stop and clean up.
    pub cancelled: bool,
}

impl GateState {
    /// Running, online, not cancelled.
    pub const OPEN: Self = Self {
        paused: false,
        online: true,
        cancelled: false,
    };

    /// Whether the step may advance now.
    pub fn is_open(self) -> bool {
        !self.paused && self.online && !self.cancelled
    }
}

/// The engine's end: flips the flags the step observes.
#[derive(Debug)]
pub struct GateController {
    tx: watch::Sender<GateState>,
}

/// The step's end.
#[derive(Debug, Clone)]
pub struct Gate {
    rx: watch::Receiver<GateState>,
}

/// A connected controller/gate pair.
pub fn gate(initial: GateState) -> (GateController, Gate) {
    let (tx, rx) = watch::channel(initial);
    (GateController { tx }, Gate { rx })
}

impl GateController {
    pub fn state(&self) -> GateState {
        *self.tx.borrow()
    }

    pub fn set_paused(&self, paused: bool) {
        self.tx
            .send_if_modified(|s| std::mem::replace(&mut s.paused, paused) != paused);
    }

    pub fn set_online(&self, online: bool) {
        self.tx
            .send_if_modified(|s| std::mem::replace(&mut s.online, online) != online);
    }

    pub fn cancel(&self) {
        self.tx
            .send_if_modified(|s| !std::mem::replace(&mut s.cancelled, true));
    }
}

impl Drop for GateController {
    /// A forgotten item counts as cancelled.
    fn drop(&mut self) {
        self.cancel();
    }
}

impl Gate {
    pub fn state(&self) -> GateState {
        *self.rx.borrow()
    }

    pub fn is_open(&self) -> bool {
        self.state().is_open()
    }

    pub fn is_cancelled(&self) -> bool {
        self.state().cancelled
    }

    /// Waits until the gate is open; `Err(Cancelled)` as soon as it is cancelled.
    pub async fn wait_open(&mut self) -> Result<(), Cancelled> {
        loop {
            let state = *self.rx.borrow_and_update();
            if state.cancelled {
                return Err(Cancelled);
            }
            if state.is_open() {
                return Ok(());
            }
            if self.rx.changed().await.is_err() {
                return Err(Cancelled);
            }
        }
    }

    /// Waits for the next change and returns the new state (cancelled once the controller is
    /// gone).
    pub async fn changed(&mut self) -> GateState {
        match self.rx.changed().await {
            Ok(()) => *self.rx.borrow_and_update(),
            Err(_) => GateState {
                cancelled: true,
                ..self.state()
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn wait_open_follows_the_controller() {
        let (ctl, mut gate) = gate(GateState {
            paused: true,
            ..GateState::OPEN
        });
        assert!(!gate.is_open());
        let waiter = tokio::spawn(async move { gate.wait_open().await.map(|()| gate.state()) });
        tokio::task::yield_now().await;
        ctl.set_online(false);
        ctl.set_paused(false);
        tokio::task::yield_now().await;
        assert!(!waiter.is_finished(), "still offline");
        ctl.set_online(true);
        let state = waiter.await.unwrap().unwrap();
        assert!(state.is_open());
    }

    #[tokio::test]
    async fn cancel_and_drop_both_cancel() {
        let (ctl, mut gate) = gate(GateState::OPEN);
        ctl.cancel();
        assert_eq!(gate.wait_open().await, Err(Cancelled));
        assert!(gate.is_cancelled());

        let (ctl, mut gate) = super::gate(GateState {
            online: false,
            ..GateState::OPEN
        });
        drop(ctl);
        assert_eq!(gate.wait_open().await, Err(Cancelled));
        assert!(gate.changed().await.cancelled);
    }

    #[tokio::test(start_paused = true)]
    async fn changed_reports_each_flip() {
        let (ctl, mut gate) = gate(GateState::OPEN);
        let task = tokio::spawn(async move { gate.changed().await });
        tokio::time::sleep(Duration::from_millis(1)).await;
        ctl.set_paused(true);
        let state = task.await.unwrap();
        assert!(state.paused);
        assert!(!state.is_open());
    }
}
