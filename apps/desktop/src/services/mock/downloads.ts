// Download queue with the prototype's simulated timings (`pump()` / `startInstall()`):
// at most `concurrency` items run, the rest wait in `queued`; every tick a running item gains
// 3–10 % (`3 + random·7`) unless it is paused or the client is offline; at 100 % it holds in
// `installing` for 8 ticks, then the app is recorded in the library and the next item starts.
import { ServiceError } from "../errors";
import type { DownloadEvent, DownloadService } from "../contracts";
import type {
  AppId,
  DownloadItem,
  DownloadPhase,
  DownloadRequest,
  DownloadState,
  InstalledApp,
} from "../types";
import type { MockContext } from "./runtime";
import type { MockWorld } from "./world";

/** Ticks spent in `installing` at 100 % before the app is recorded (≈ 880 ms). */
export const INSTALL_HOLD_TICKS = 8;

/** "Parallel downloads" default (`settings.parallel`). */
export const DEFAULT_CONCURRENCY = 2;

export interface MockDownloadService extends DownloadService {
  /** Stops every tick timer (teardown). */
  dispose(): void;
}

interface Entry {
  request: DownloadRequest;
  state: DownloadState;
  /** 0–100, fractional like the prototype's. */
  progress: number;
  holdTicks: number;
  timer: ReturnType<typeof setInterval> | null;
}

export function createMockDownloadService(
  world: MockWorld,
  ctx: MockContext,
  initialConcurrency = DEFAULT_CONCURRENCY,
): MockDownloadService {
  /** Started items (downloading, paused, installing) in start order. */
  let running: Entry[] = [];
  /** Waiting items in queue order. */
  let queue: Entry[] = [];
  let concurrency = initialConcurrency;
  let online = true;
  const listeners = new Set<(event: DownloadEvent) => void>();

  const emit = (event: DownloadEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  const emitPhase = (appId: AppId, phase: DownloadPhase) =>
    emit({ type: "state", payload: { appId, phase } });
  const find = (appId: AppId) =>
    running.find((e) => e.request.appId === appId) ?? queue.find((e) => e.request.appId === appId);

  function stop(entry: Entry) {
    if (entry.timer !== null) clearInterval(entry.timer);
    entry.timer = null;
  }

  function pump() {
    if (!online) return;
    while (running.length < concurrency) {
      const next = queue.shift();
      if (!next) return;
      next.state = "downloading";
      running.push(next);
      next.timer = setInterval(() => tick(next), ctx.tickMs);
      emitPhase(next.request.appId, { kind: "downloading" });
    }
  }

  function tick(entry: Entry) {
    if (entry.state === "paused" || !online) return;
    const { appId, sizeMb } = entry.request;
    if (entry.progress < 100) {
      entry.progress = Math.min(100, entry.progress + 3 + ctx.random() * 7);
      const receivedMb = Math.round((sizeMb * entry.progress) / 10) / 10;
      emit({ type: "progress", payload: { appId, progress: entry.progress, receivedMb, sizeMb } });
      if (entry.progress >= 100) {
        entry.state = "installing";
        emitPhase(appId, { kind: "installing" });
      }
      return;
    }
    entry.holdTicks += 1;
    if (entry.holdTicks < INSTALL_HOLD_TICKS) return;
    finish(entry);
  }

  function finish(entry: Entry) {
    stop(entry);
    running = running.filter((e) => e !== entry);
    const { appId, version, kind } = entry.request;
    const update = kind === "update";
    const record: InstalledApp = { appId, version, lastUsed: ctx.today };
    const installed = world.library.installed;
    const at = installed.findIndex((app) => app.appId === appId);
    if (at >= 0) installed[at] = record;
    else installed.push(record);
    world.account.activity.unshift({
      kind: update ? "updated" : "installed",
      appId,
      version,
      date: ctx.today,
    });
    if (update) world.account.usage.updatesInstalled += 1;
    emitPhase(appId, { kind: "installed", version, update });
    pump();
  }

  function remove(entry: Entry) {
    stop(entry);
    running = running.filter((e) => e !== entry);
    queue = queue.filter((e) => e !== entry);
    emitPhase(entry.request.appId, { kind: "cancelled" });
  }

  function setPaused(entry: Entry | undefined, paused: boolean) {
    if (!entry || entry.state !== (paused ? "downloading" : "paused")) return;
    entry.state = paused ? "paused" : "downloading";
    emitPhase(entry.request.appId, { kind: entry.state });
  }

  const toItem = ({ request, state, progress }: Entry): DownloadItem => ({
    appId: request.appId,
    version: request.version,
    kind: request.kind,
    state,
    progress,
    sizeMb: request.sizeMb,
  });

  return {
    getSnapshot: () =>
      ctx.respond(() => ({ items: [...running, ...queue].map(toItem), concurrency, online })),

    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    enqueue: (requests) =>
      ctx.respond(() => {
        for (const request of requests) {
          if (find(request.appId)) continue;
          queue.push({
            request: { ...request },
            state: "queued",
            progress: 0,
            holdTicks: 0,
            timer: null,
          });
          emitPhase(request.appId, { kind: "queued" });
        }
        pump();
      }),

    pause: (appId) => ctx.respond(() => setPaused(find(appId), true)),
    resume: (appId) => ctx.respond(() => setPaused(find(appId), false)),

    cancel: (appId) =>
      ctx.respond(() => {
        const entry = find(appId);
        if (!entry) return;
        remove(entry);
        pump();
      }),

    pauseAll: () => ctx.respond(() => running.forEach((e) => setPaused(e, true))),
    resumeAll: () => ctx.respond(() => running.forEach((e) => setPaused(e, false))),

    cancelAll: () => ctx.respond(() => [...running, ...queue].forEach(remove)),

    setConcurrency: (limit) =>
      ctx.respond(() => {
        if (!Number.isInteger(limit) || limit < 1) {
          throw new ServiceError("invalid", `Invalid download concurrency: ${limit}`);
        }
        concurrency = limit;
        pump();
      }),

    setOnline: (value) =>
      ctx.respond(() => {
        online = value;
        pump();
      }),

    dispose() {
      [...running, ...queue].forEach(stop);
      listeners.clear();
    },
  };
}
