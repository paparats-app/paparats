// Persisted settings. The shell applies theme/locale/motion to the document; this store never
// touches the DOM.
import { create } from "zustand";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import { getServices } from "@/services";
import type { Settings } from "@/services/types";

export interface SettingsState {
  settings: Settings;
  /** Stored settings have been loaded (defaults until then). */
  hydrated: boolean;
  /** Loads the stored settings; on failure keeps the defaults. */
  hydrate(): Promise<void>;
  /**
   * Applies `patch` at once and persists it. On failure the patched keys roll back (unless a later
   * update changed them meanwhile). Resolves `false` when persisting failed.
   */
  update(patch: Partial<Settings>): Promise<boolean>;
}

/** Latest `update()`; an older response must not overwrite a newer optimistic value. */
let updateSeq = 0;

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,

  async hydrate() {
    try {
      const settings = await getServices().settings.getSettings();
      set({ settings, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  async update(patch) {
    const seq = ++updateSeq;
    const before = get().settings;
    set({ settings: { ...before, ...patch } });
    try {
      const saved = await getServices().settings.updateSettings(patch);
      if (seq === updateSeq) set({ settings: saved });
      return true;
    } catch {
      const current = get().settings;
      const rollback: Partial<Settings> = {};
      for (const key of Object.keys(patch) as (keyof Settings)[]) {
        if (current[key] === patch[key]) Object.assign(rollback, { [key]: before[key] });
      }
      set({ settings: { ...current, ...rollback } });
      return false;
    }
  },
}));
