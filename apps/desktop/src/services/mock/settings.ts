import { DEFAULT_SETTINGS } from "@/domain/settings";
import { sanitizeSettings } from "../common";
import { ServiceError } from "../errors";
import type { SettingsService } from "../contracts";
import type { Settings } from "../types";
import type { MockContext } from "./runtime";

/** `localStorage` key of the persisted settings (JSON). */
export const SETTINGS_STORAGE_KEY = "paparats.settings";

/** Stored settings merged over `DEFAULT_SETTINGS`; unreadable storage means defaults. */
export function readStoredSettings(storage: Storage | null): Settings {
  return { ...DEFAULT_SETTINGS, ...sanitizeSettings(parseStored(storage)) };
}

function parseStored(storage: Storage | null): unknown {
  try {
    const raw = storage?.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createMockSettingsService(ctx: MockContext): SettingsService {
  // Without storage (disabled, or not a browser) settings live for the session only.
  let memory: Settings | null = null;
  const read = () => memory ?? readStoredSettings(ctx.storage);

  return {
    getSettings: () => ctx.respond(read),

    updateSettings: (patch) =>
      ctx.respond(() => {
        const next = { ...read(), ...sanitizeSettings(patch) };
        if (!ctx.storage) {
          memory = next;
          return next;
        }
        try {
          ctx.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          throw new ServiceError("internal", `Settings could not be saved: ${String(e)}`);
        }
        return next;
      }),

    clearSearchHistory: () => ctx.respond(() => undefined),
  };
}
