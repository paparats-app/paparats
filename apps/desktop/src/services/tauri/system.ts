// SystemService over the Rust core, the Tauri plugins and the WebView: "today" comes from the
// core; the client's own update check is tauri-plugin-updater's `check()`; start on login is
// tauri-plugin-autostart; links open in the default browser through tauri-plugin-opener;
// connectivity and the clipboard are WebView2's own.
//
// `tauriShell` is the native shell's side of the core (tray language, "Minimize to system tray",
// showing the window after the first frame, `paparats://` links, tray actions). It is not a
// service: `platform/shell.ts` wraps it for the app shell, which works without it in a browser.
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check } from "@tauri-apps/plugin-updater";
import { commands, events } from "@/bindings";
import type { DeepLinkTarget, TrayAction } from "@/bindings";
import { toIso } from "@/domain/dates";
import type { SystemService, Unsubscribe } from "../contracts";
import type { IsoDate, Locale, SelfUpdateCheck } from "../types";
import {
  SELF_UPDATE_CHECK_MS,
  browserCopyToClipboard,
  browserIsOnline,
  browserOnConnectivityChange,
  externalUrl,
} from "../mock/system";
import { toServiceError, unwrap, unwrapVoid } from "./result";

export type { DeepLinkTarget, TrayAction };

/** How long the update endpoint may take to answer before the check counts as "up to date". */
export const UPDATE_CHECK_TIMEOUT_MS = 15_000;

/** Today's local calendar date. */
export function localToday(): IsoDate {
  return toIso(new Date());
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Settings › About › Check for updates: asks the update endpoint (tauri.conf.json › plugins ›
 * updater) for a newer Paparats. Never rejects — offline, an endpoint that is down or has nothing
 * published yet all read as "up to date" — and never answers before the prototype's 1.2 s, so the
 * "Checking…" state looks the same as with the mock.
 */
export async function checkForClientUpdate(): Promise<SelfUpdateCheck> {
  const minimum = wait(SELF_UPDATE_CHECK_MS);
  let result: SelfUpdateCheck = { kind: "upToDate" };
  try {
    const update = await check({ timeout: UPDATE_CHECK_TIMEOUT_MS });
    if (update) {
      result = { kind: "available", version: update.version };
      // Nothing downloads it yet: release the core's handle.
      await update.close().catch(() => undefined);
    }
  } catch {
    // Up to date, as far as we can tell.
  }
  await minimum;
  return result;
}

/** Start on Windows login: registers or removes the login entry only when it differs. */
async function setAutostart(enabled: boolean): Promise<void> {
  try {
    const registered = await isAutostartEnabled();
    if (enabled && !registered) await enableAutostart();
    else if (!enabled && registered) await disableAutostart();
  } catch (e) {
    throw toServiceError(e);
  }
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
    checkForAppUpdate: checkForClientUpdate,
    async openExternal(url) {
      const href = externalUrl(url);
      try {
        await openUrl(href);
      } catch (e) {
        throw toServiceError(e);
      }
    },
    copyToClipboard: browserCopyToClipboard,
    setAutostart,
  };
}

/**
 * Registers `listen` (a typed event), then — once the core will send to it — runs `after`. The
 * returned function stops listening, also when the registration is still in flight.
 */
function listenThen(
  listen: () => Promise<() => void>,
  after: () => void = () => undefined,
): Unsubscribe {
  let active = true;
  const registration = listen();
  registration.then(
    () => {
      if (active) after();
    },
    (e: unknown) => console.error("Paparats: cannot listen to shell events", e),
  );
  return () => {
    if (!active) return;
    active = false;
    registration.then((unlisten) => unlisten()).catch(() => undefined);
  };
}

/** The native shell's commands and events (see the file comment). */
export const tauriShell = {
  /** The UI language, for the tray menu. */
  setLocale: (locale: Locale): Promise<void> => unwrapVoid(commands.shellSetLocale(locale)),
  /** Settings › General › Minimize to system tray. */
  setMinimizeToTray: (enabled: boolean): Promise<void> =>
    unwrapVoid(commands.shellSetMinimizeToTray(enabled)),
  /** The first frame is on screen: the core may show the window. */
  windowReady: (): Promise<void> => unwrapVoid(commands.shellWindowReady()),

  /**
   * `paparats://app/<id>` and `paparats://channel/<id>` links. Listens first, then takes the links
   * that arrived before (a cold start from a link), so none is lost or delivered twice.
   */
  subscribeDeepLinks(listener: (target: DeepLinkTarget) => void): Unsubscribe {
    let active = true;
    const deliver = (target: DeepLinkTarget) => {
      if (active) listener(target);
    };
    const stop = listenThen(
      () => events.shellDeepLink.listen(({ payload }) => deliver(payload)),
      () => {
        unwrap(commands.shellTakeDeepLinks()).then(
          (pending) => pending.forEach(deliver),
          (e: unknown) => console.error("Paparats: cannot read pending links", e),
        );
      },
    );
    return () => {
      active = false;
      stop();
    };
  },

  /** Tray menu entries the UI carries out ("Check for updates"). */
  subscribeTrayActions(listener: (action: TrayAction) => void): Unsubscribe {
    let active = true;
    const stop = listenThen(() =>
      events.shellTrayAction.listen(({ payload }) => {
        if (active) listener(payload);
      }),
    );
    return () => {
      active = false;
      stop();
    };
  },
};
