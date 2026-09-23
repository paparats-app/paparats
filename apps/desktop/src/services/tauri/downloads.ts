// The download queue lives in the Rust core (`paparats-download`). Lifecycle changes and progress
// arrive as the typed `download://state` / `download://progress` events (docs/decisions.md D19),
// mapped onto the contract's `DownloadEvent`.
import type { UnlistenFn } from "@tauri-apps/api/event";
import { commands, events } from "@/bindings";
import type { DownloadEvent, DownloadService } from "../contracts";
import { ServiceError } from "../errors";
import { unwrap, unwrapVoid } from "./result";

export function createTauriDownloadService(): DownloadService {
  // Listener registrations still in flight. `getSnapshot()` waits for them, so a caller that
  // subscribes and then reads the snapshot (the downloads bridge) misses no event that follows it.
  const registering = new Set<Promise<UnlistenFn>>();

  function register(registration: Promise<UnlistenFn>): Promise<UnlistenFn> {
    registering.add(registration);
    registration.then(
      () => registering.delete(registration),
      (e: unknown) => {
        registering.delete(registration);
        console.error("Paparats: cannot listen to download events", e);
      },
    );
    return registration;
  }

  return {
    async getSnapshot() {
      await Promise.allSettled(registering);
      return unwrap(commands.downloadsSnapshot());
    },

    subscribe(listener) {
      let active = true;
      const deliver = (event: DownloadEvent) => {
        if (active) listener(event);
      };
      const registrations = [
        register(
          events.downloadProgress.listen(({ payload }) => deliver({ type: "progress", payload })),
        ),
        register(events.downloadState.listen(({ payload }) => deliver({ type: "state", payload }))),
      ];
      return () => {
        if (!active) return;
        active = false;
        for (const registration of registrations) {
          registration.then(
            (unlisten) => unlisten(),
            () => undefined,
          );
        }
      };
    },

    enqueue: (requests) => unwrapVoid(commands.downloadsEnqueue(requests)),
    pause: (appId) => unwrapVoid(commands.downloadsPause(appId)),
    resume: (appId) => unwrapVoid(commands.downloadsResume(appId)),
    cancel: (appId) => unwrapVoid(commands.downloadsCancel(appId)),
    pauseAll: () => unwrapVoid(commands.downloadsPauseAll()),
    resumeAll: () => unwrapVoid(commands.downloadsResumeAll()),
    cancelAll: () => unwrapVoid(commands.downloadsCancelAll()),

    async setConcurrency(limit) {
      // The core rejects 0 itself; a fraction or a negative number would not even reach it
      // (argument deserialization), so it is rejected here with the mock's `invalid`.
      if (!Number.isInteger(limit) || limit < 1) {
        throw new ServiceError("invalid", `Invalid download concurrency: ${limit}`);
      }
      await unwrapVoid(commands.downloadsSetConcurrency(limit));
    },

    setOnline: (online) => unwrapVoid(commands.downloadsSetOnline(online)),
  };
}
