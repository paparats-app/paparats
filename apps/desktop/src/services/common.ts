// Pieces both service sets share: the WebView's own connectivity and clipboard (WebView2 has the
// same APIs as a browser), the rule for links `openExternal` may open, the settings sanitizer and
// the prototype's update-check time. It lives outside `mock/` so the Tauri adapters never import
// the mock world: `services/mock/**` and `fixtures/*.json` are a separate chunk that
// `createServices("mock")` loads on demand (docs/architecture.md §2).
import { DEFAULT_SETTINGS } from "@/domain/settings";
import type { Unsubscribe } from "./contracts";
import { ServiceError } from "./errors";
import type { Settings } from "./types";

/** Settings › About › Check for updates takes this long in the prototype. */
export const SELF_UPDATE_CHECK_MS = 1200;

/**
 * The URL `openExternal` may open: `https:` and `mailto:` only; a bare address such as
 * `kvetka.example/support` gets `https://`. Anything else rejects `invalid`.
 */
export function externalUrl(url: string): string {
  const trimmed = url.trim();
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ServiceError("invalid", `Not a URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "mailto:") {
    throw new ServiceError("invalid", `Refusing to open ${parsed.protocol} links`);
  }
  return parsed.href;
}

export function browserIsOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function browserOnConnectivityChange(listener: (online: boolean) => void): Unsubscribe {
  if (typeof window === "undefined") return () => undefined;
  const online = () => listener(true);
  const offline = () => listener(false);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}

export async function browserCopyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    throw new ServiceError("internal", `Clipboard write failed: ${String(e)}`);
  }
}

/**
 * Keeps only known keys whose value has the default's type. Stored settings are untrusted: the
 * mock's `localStorage` JSON and the Tauri store's user-editable `settings.json` alike.
 */
export function sanitizeSettings(value: unknown): Partial<Settings> {
  if (typeof value !== "object" || value === null) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof source[key] === typeof fallback) result[key] = source[key];
  }
  return result as Partial<Settings>;
}
