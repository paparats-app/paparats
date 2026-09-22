import { ServiceError } from "../errors";
import type { SystemService, Unsubscribe } from "../contracts";
import type { SelfUpdateCheck } from "../types";
import { delay } from "./runtime";
import type { MockContext } from "./runtime";

/** Settings › About › Check for updates takes this long in the prototype. */
export const SELF_UPDATE_CHECK_MS = 1200;

/**
 * The URL `openExternal` may open: `https:` and `mailto:` only; a bare address such as
 * `nilesoft.org/support` gets `https://`. Anything else rejects `invalid`.
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

// Browser-backed pieces, shared with the Tauri adapter (WebView2 has the same APIs).

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

export function createMockSystemService(ctx: MockContext): SystemService {
  return {
    today: () => ctx.today,
    isOnline: browserIsOnline,
    onConnectivityChange: browserOnConnectivityChange,
    async checkForAppUpdate(): Promise<SelfUpdateCheck> {
      await delay(SELF_UPDATE_CHECK_MS);
      return { kind: "upToDate" };
    },
    openExternal: (url) => ctx.respond(() => void externalUrl(url)),
    copyToClipboard: browserCopyToClipboard,
    setAutostart: () => ctx.respond(() => undefined),
  };
}
