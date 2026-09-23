// Small JSON wrapper over the WebView's `localStorage` for client-only records (e.g. the
// first-launch record, FIRST_LAUNCH_SPEC "Persistence"). Every access is guarded: storage can be
// missing (tests without jsdom, locked-down WebView), full or corrupted, and none of that may break
// the UI — a failed read is `null`, a failed write is `false`.

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export const localStore = {
  /** The parsed JSON stored under `key`; `null` when absent, unreadable or not JSON. */
  readJson(key: string): unknown {
    try {
      const raw = storage()?.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  },

  /** Stores `value` as JSON under `key`; `false` when storage is unavailable or full. */
  writeJson(key: string, value: unknown): boolean {
    try {
      const target = storage();
      if (!target) return false;
      target.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): void {
    try {
      storage()?.removeItem(key);
    } catch {
      // Nothing to do: the record simply stays.
    }
  },
};
