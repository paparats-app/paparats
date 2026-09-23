import { DEFAULT_SETTINGS } from "@/domain/settings";
import { ServiceError } from "../errors";
import type { SettingsService } from "../contracts";
import type { Settings } from "../types";
import type { MockContext } from "./runtime";

/** `localStorage` key of the persisted settings (JSON). */
export const SETTINGS_STORAGE_KEY = "paparats.settings";

/** Keeps only known keys whose value has the default's type (the stored JSON is untrusted). */
function sanitize(value: unknown): Partial<Settings> {
  if (typeof value !== "object" || value === null) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof source[key] === typeof fallback) result[key] = source[key];
  }
  return result as Partial<Settings>;
}

// The Tauri settings store (services/tauri/settings.ts) applies the same rules to settings.json.
export { sanitize as sanitizeSettings };

/** Stored settings merged over `DEFAULT_SETTINGS`; unreadable storage means defaults. */
export function readStoredSettings(storage: Storage | null): Settings {
  return { ...DEFAULT_SETTINGS, ...sanitize(parseStored(storage)) };
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
        const next = { ...read(), ...sanitize(patch) };
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
