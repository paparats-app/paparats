// The one service with real platform behaviour today: the real local date, the default browser
// through tauri-plugin-opener, WebView2 connectivity and clipboard. The client self-update check
// and autostart have no Rust side yet and delegate to the mock.
import { openUrl } from "@tauri-apps/plugin-opener";
import { toIso } from "@/domain/dates";
import type { SystemService } from "../contracts";
import type { IsoDate } from "../types";
import {
  browserCopyToClipboard,
  browserIsOnline,
  browserOnConnectivityChange,
  externalUrl,
} from "../mock/system";
import { toServiceError } from "./result";

/** Today's local calendar date. */
export function localToday(): IsoDate {
  return toIso(new Date());
}

export function createTauriSystemService(mock: SystemService): SystemService {
  return {
    today: localToday,
    isOnline: browserIsOnline,
    onConnectivityChange: browserOnConnectivityChange,
    checkForAppUpdate: () => mock.checkForAppUpdate(),
    async openExternal(url) {
      const href = externalUrl(url);
      try {
        await openUrl(href);
      } catch (e) {
        throw toServiceError(e);
      }
    },
    copyToClipboard: browserCopyToClipboard,
    setAutostart: (enabled) => mock.setAutostart(enabled),
  };
}
