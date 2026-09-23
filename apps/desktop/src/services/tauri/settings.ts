// Settings persist in `settings.json` in the app data directory through tauri-plugin-store
// (STACK.md decision 4): one key per setting, only the ones the user changed. Reads merge the file
// over `DEFAULT_SETTINGS` and drop unknown keys and values of the wrong type — the file is
// user-editable — with the same rules as the mock's localStorage.
import { load } from "@tauri-apps/plugin-store";
import type { Store } from "@tauri-apps/plugin-store";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import type { SettingsService } from "../contracts";
import { ServiceError } from "../errors";
import { sanitizeSettings } from "../mock/settings";
import type { Settings } from "../types";
import { toServiceError } from "./result";

/** The settings file, relative to the app data directory. */
export const SETTINGS_STORE_FILE = "settings.json";

function failure(action: string, e: unknown): ServiceError {
  return new ServiceError(
    "internal",
    `Settings could not be ${action}: ${toServiceError(e).message}`,
  );
}

export function createTauriSettingsService(): SettingsService {
  let opened: Promise<Store> | null = null;
  // Calls run one after another, so quick successive changes reach the file in order and a read
  // never sees half of an update.
  let queue: Promise<unknown> = Promise.resolve();

  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  function open(): Promise<Store> {
    if (!opened) {
      // Saved explicitly after every change: an update resolves once it is on disk.
      const pending = load(SETTINGS_STORE_FILE, { defaults: {}, autoSave: false });
      opened = pending;
      pending.catch(() => {
        if (opened === pending) opened = null; // try again on the next call
      });
    }
    return opened;
  }

  async function read(store: Store): Promise<Settings> {
    const entries = await store.entries<unknown>();
    return { ...DEFAULT_SETTINGS, ...sanitizeSettings(Object.fromEntries(entries)) };
  }

  return {
    getSettings: () =>
      serial(async () => {
        try {
          return await read(await open());
        } catch (e) {
          throw failure("read", e);
        }
      }),

    updateSettings: (patch) =>
      serial(async () => {
        let store: Store;
        try {
          store = await open();
        } catch (e) {
          throw failure("saved", e);
        }
        try {
          await Promise.all(
            Object.entries(sanitizeSettings(patch)).map(([key, value]) => store.set(key, value)),
          );
          await store.save();
        } catch (e) {
          // Keep the in-memory store equal to the file, so a later read cannot return a change
          // that was reported as failed.
          await store.reload({ ignoreDefaults: true }).catch(() => undefined);
          throw failure("saved", e);
        }
        try {
          return await read(store);
        } catch (e) {
          throw failure("read", e);
        }
      }),

    // Search history is not stored yet (nothing to clear).
    clearSearchHistory: async () => undefined,
  };
}
