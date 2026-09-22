// No download commands in bindings.ts yet: every method delegates to the mock queue. To switch,
// replace a body with `unwrap(commands.<name>(…))` (see ./result.ts) and back `subscribe` with the
// typed `download://progress` / `download://state` events.
import type { DownloadService } from "../contracts";

export function createTauriDownloadService(mock: DownloadService): DownloadService {
  return {
    getSnapshot: () => mock.getSnapshot(),
    subscribe: (listener) => mock.subscribe(listener),
    enqueue: (requests) => mock.enqueue(requests),
    pause: (appId) => mock.pause(appId),
    resume: (appId) => mock.resume(appId),
    cancel: (appId) => mock.cancel(appId),
    pauseAll: () => mock.pauseAll(),
    resumeAll: () => mock.resumeAll(),
    cancelAll: () => mock.cancelAll(),
    setConcurrency: (limit) => mock.setConcurrency(limit),
    setOnline: (online) => mock.setOnline(online),
  };
}
