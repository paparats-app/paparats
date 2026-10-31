import {
  SELF_UPDATE_CHECK_MS,
  browserCopyToClipboard,
  browserIsOnline,
  browserOnConnectivityChange,
  externalUrl,
} from "../common";
import type { SystemService } from "../contracts";
import type { SelfUpdateCheck } from "../types";
import { delay } from "./runtime";
import type { MockContext } from "./runtime";

// The browser-backed pieces live in ../common: the Tauri adapter uses them too.

export function createMockSystemService(ctx: MockContext): SystemService {
  return {
    today: () => ctx.today,
    isOnline: browserIsOnline,
    onConnectivityChange: browserOnConnectivityChange,
    async checkForAppUpdate(): Promise<SelfUpdateCheck> {
      await delay(SELF_UPDATE_CHECK_MS);
      return { kind: "upToDate" };
    },
    // The demo world is always up to date, so there is never anything to install.
    installAppUpdate: () => ctx.respond(() => undefined),
    openExternal: (url) => ctx.respond(() => void externalUrl(url)),
    copyToClipboard: browserCopyToClipboard,
    setAutostart: () => ctx.respond(() => undefined),
  };
}
