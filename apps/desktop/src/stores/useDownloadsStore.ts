// The download queue as the UI sees it. `useDownloadsBridge()` feeds it DownloadService events;
// actions delegate to the service (new requests appear as `queued` at once, before the service
// answers).
import { create } from "zustand";
import { getServices } from "@/services";
import type { DownloadEvent, DownloadService } from "@/services";
import type { AppId, DownloadItem, DownloadRequest, DownloadSnapshot } from "@/services/types";

/** "Update all": the apps it started, until the last of them lands. */
export interface DownloadBatch {
  ids: AppId[];
}

export interface DownloadEventOutcome {
  /** The event recorded an app as installed (the library query is stale). */
  installed: { appId: AppId; version: string; update: boolean } | null;
  /** This event landed the batch's last item (the batch has been cleared). */
  batchFinished: boolean;
  /** The event names an item the store does not know: resync with `refresh()`. */
  unknown: boolean;
}

export interface DownloadsState {
  items: Record<AppId, DownloadItem>;
  /** Queue order (by insertion). */
  order: AppId[];
  batch: DownloadBatch | null;
  /** Updates installed while the Updates screen was open ("Updated just now"). */
  justUpdated: Record<AppId, true>;

  /** Replaces the queue with the service's snapshot. */
  applySnapshot(snapshot: DownloadSnapshot): void;
  /** Applies one DownloadService event and reports what the bridge must do about it. */
  applyEvent(event: DownloadEvent): DownloadEventOutcome;
  /** Reloads the snapshot (after an unknown item or a failed call). */
  refresh(): Promise<void>;

  enqueue(requests: DownloadRequest[]): Promise<void>;
  /** "Update all": remembers the batch, then enqueues it. */
  startBatch(requests: DownloadRequest[]): Promise<void>;
  pause(appId: AppId): Promise<void>;
  resume(appId: AppId): Promise<void>;
  cancel(appId: AppId): Promise<void>;
  pauseAll(): Promise<void>;
  resumeAll(): Promise<void>;
  /** Also drops the batch. */
  cancelAll(): Promise<void>;
  /** Clears one "Updated just now" marker, or all of them (leaving the Updates screen). */
  clearJustUpdated(appId?: AppId): void;
}

const NOTHING: DownloadEventOutcome = { installed: null, batchFinished: false, unknown: false };

function without<T>(record: Record<AppId, T>, appId: AppId): Record<AppId, T> {
  const { [appId]: _removed, ...rest } = record;
  return rest;
}

let refreshing: Promise<void> | null = null;

export const useDownloadsStore = create<DownloadsState>()((set, get) => {
  /** Runs a service call; a failure means our view may be wrong, so resync. */
  async function call(action: (downloads: DownloadService) => Promise<void>): Promise<void> {
    try {
      await action(getServices().downloads);
    } catch {
      await get().refresh();
    }
  }

  return {
    items: {},
    order: [],
    batch: null,
    justUpdated: {},

    applySnapshot(snapshot) {
      const items = Object.fromEntries(snapshot.items.map((i) => [i.appId, i]));
      const batch = get().batch;
      set({
        items,
        order: snapshot.items.map((i) => i.appId),
        batch: batch && batch.ids.some((id) => items[id]) ? batch : null,
      });
    },

    applyEvent(event) {
      const { items, order, batch, justUpdated } = get();
      if (event.type === "progress") {
        const { appId, progress, sizeMb } = event.payload;
        const item = items[appId];
        if (!item) return { ...NOTHING, unknown: true };
        set({ items: { ...items, [appId]: { ...item, progress, sizeMb } } });
        return NOTHING;
      }

      const { appId, phase } = event.payload;
      switch (phase.kind) {
        case "queued":
        case "downloading":
        case "paused":
        case "installing": {
          const item = items[appId];
          if (!item) return { ...NOTHING, unknown: true };
          const progress = phase.kind === "installing" ? 100 : item.progress;
          set({ items: { ...items, [appId]: { ...item, state: phase.kind, progress } } });
          return NOTHING;
        }
        case "installed":
        case "cancelled":
        case "failed": {
          const nextItems = without(items, appId);
          const landed = batch?.ids.includes(appId) === true;
          const batchDone = landed && batch !== null && batch.ids.every((id) => !nextItems[id]);
          const installed =
            phase.kind === "installed"
              ? { appId, version: phase.version, update: phase.update }
              : null;
          set({
            items: nextItems,
            order: order.filter((id) => id !== appId),
            batch: batchDone ? null : batch,
            justUpdated: installed?.update ? { ...justUpdated, [appId]: true } : justUpdated,
          });
          return { installed, batchFinished: batchDone && installed !== null, unknown: false };
        }
      }
    },

    refresh() {
      refreshing ??= (async () => {
        try {
          get().applySnapshot(await getServices().downloads.getSnapshot());
        } catch {
          // Keep the current view; the next event or call resyncs.
        } finally {
          refreshing = null;
        }
      })();
      return refreshing;
    },

    async enqueue(requests) {
      const { items } = get();
      const fresh = new Map<AppId, DownloadItem>();
      for (const r of requests) {
        if (items[r.appId] || fresh.has(r.appId)) continue;
        fresh.set(r.appId, { ...r, state: "queued", progress: 0 });
      }
      if (fresh.size > 0) {
        set((s) => ({
          items: { ...s.items, ...Object.fromEntries(fresh) },
          order: [...s.order, ...fresh.keys()],
        }));
      }
      try {
        await getServices().downloads.enqueue(requests);
      } catch {
        // Drop what we added and is still untouched, then trust the service's view.
        set((s) => {
          const stale = [...fresh.keys()].filter(
            (id) => s.items[id]?.state === "queued" && s.items[id]?.progress === 0,
          );
          const nextItems = stale.reduce(without, s.items);
          return {
            items: nextItems,
            order: s.order.filter((id) => !stale.includes(id)),
            batch: s.batch && s.batch.ids.some((id) => nextItems[id]) ? s.batch : null,
          };
        });
        await get().refresh();
      }
    },

    async startBatch(requests) {
      set({ batch: { ids: [...new Set(requests.map((r) => r.appId))] } });
      await get().enqueue(requests);
    },

    pause: (appId) => call((d) => d.pause(appId)),
    resume: (appId) => call((d) => d.resume(appId)),
    cancel: (appId) => call((d) => d.cancel(appId)),
    pauseAll: () => call((d) => d.pauseAll()),
    resumeAll: () => call((d) => d.resumeAll()),

    cancelAll() {
      set({ batch: null });
      return call((d) => d.cancelAll());
    },

    clearJustUpdated(appId) {
      set((s) => ({ justUpdated: appId === undefined ? {} : without(s.justUpdated, appId) }));
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Selectors (pure; use with `useDownloadsStore(selector)` only when the result is referentially
// stable — otherwise compute from `items`/`batch` in a `useMemo`).
// ---------------------------------------------------------------------------------------------

export interface BatchProgress {
  /** Some batch item is still queued or running. */
  active: boolean;
  /** Items that have landed (or left the queue). */
  done: number;
  total: number;
  /** Average progress, 0–100 (landed items count as 100). */
  percent: number;
}

/** "Updating 2 of 5 · 43 %" for the Updates hero; `null` without a batch. */
export function batchProgress(
  batch: DownloadBatch | null,
  items: Readonly<Record<AppId, DownloadItem>>,
): BatchProgress | null {
  if (!batch || batch.ids.length === 0) return null;
  let done = 0;
  let sum = 0;
  for (const id of batch.ids) {
    const item = items[id];
    if (item) sum += Math.min(100, item.progress);
    else {
      done += 1;
      sum += 100;
    }
  }
  return {
    active: done < batch.ids.length,
    done,
    total: batch.ids.length,
    percent: Math.round(sum / batch.ids.length),
  };
}

/** Every started download is paused ("Resume all" instead of "Pause all"). */
export function allPaused(items: Readonly<Record<AppId, DownloadItem>>): boolean {
  const started = Object.values(items).filter((i) => i.state !== "queued");
  return started.length > 0 && started.every((i) => i.state === "paused");
}
