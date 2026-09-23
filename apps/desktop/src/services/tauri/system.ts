// SystemService over the Rust core and the WebView: "today" and the client update check come from
// the core; links open in the default browser through tauri-plugin-opener; connectivity and the
// clipboard are WebView2's own. Autostart has no Rust side yet (tauri-plugin-autostart is still
// to be added).
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/bindings";
import { toIso } from "@/domain/dates";
import type { SystemService } from "../contracts";
import type { IsoDate } from "../types";
import {
  browserCopyToClipboard,
  browserIsOnline,
  browserOnConnectivityChange,
  externalUrl,
} from "../mock/system";
import { toServiceError, unwrap } from "./result";

/** Today's local calendar date. */
export function localToday(): IsoDate {
  return toIso(new Date());
}

export function createTauriSystemService(): SystemService {
  // `today()` is synchronous, the core's `system_today` is not: keep the core's answer for the
  // local day it was asked on, and ask again when the local date changes (a session that crosses
  // midnight). Until the answer arrives — or if the call fails — the local date stands in; both
  // read the same Windows clock and time zone (D21).
  let answered: { local: IsoDate; today: IsoDate } | null = null;
  let asking: IsoDate | null = null;

  function ask(local: IsoDate): void {
    if (asking === local) return;
    asking = local;
    unwrap(commands.systemToday()).then(
      (today) => {
        answered = { local, today };
      },
      () => {
        answered = { local, today: local };
      },
    );
  }

  ask(localToday());

  return {
    today() {
      const local = localToday();
      if (answered?.local === local) return answered.today;
      ask(local);
      return local;
    },
    isOnline: browserIsOnline,
    onConnectivityChange: browserOnConnectivityChange,
    checkForAppUpdate: () => unwrap(commands.systemCheckForAppUpdate()),
    async openExternal(url) {
      const href = externalUrl(url);
      try {
        await openUrl(href);
      } catch (e) {
        throw toServiceError(e);
      }
    },
    copyToClipboard: browserCopyToClipboard,
    // Nothing to switch yet: the mock resolves too.
    setAutostart: async () => undefined,
  };
}
