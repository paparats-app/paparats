// SystemService's plugin-backed parts and the native shell against @tauri-apps/api/mocks: the
// update check and install (tauri-plugin-updater), start on login (tauri-plugin-autostart), and the shell's
// commands and events (`tauriShell`).
import { emit } from "@tauri-apps/api/event";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { ServiceError } from "../errors";
import { SELF_UPDATE_CHECK_MS } from "../common";
import type { DeepLinkTarget, TrayAction } from "./system";
import {
  UPDATE_CHECK_TIMEOUT_MS,
  checkForClientUpdate,
  createTauriSystemService,
  installClientUpdate,
  tauriShell,
} from "./system";

type Args = Record<string, unknown>;
type Handler = (args: Args) => unknown;

interface Call {
  cmd: string;
  args: Args;
}

let calls: Call[] = [];

/** A fake core: `handlers[cmd]` answers (a throw is the command's error); others reject. */
function core(handlers: Record<string, Handler> = {}): void {
  calls = [];
  mockIPC(
    (cmd, payload) => {
      const args = (payload ?? {}) as Args;
      calls.push({ cmd, args });
      const handler = handlers[cmd] ?? (cmd === "system_today" ? () => "2026-09-15" : undefined);
      if (!handler) throw `command ${cmd} not found`;
      return handler(args);
    },
    { shouldMockEvents: true },
  );
}

const commandsCalled = () => calls.map((c) => c.cmd);

afterEach(() => {
  clearMocks();
  vi.useRealTimers();
});

describe("checkForAppUpdate (tauri-plugin-updater)", () => {
  const metadata = {
    rid: 7,
    currentVersion: "0.1.0",
    version: "0.2.0",
    date: "2026-09-20T10:00:00Z",
    body: "Notes",
    rawJson: {},
  };

  it("reports a newer version after at least 1.2 s and releases the update handle", async () => {
    vi.useFakeTimers();
    core({ "plugin:updater|check": () => metadata, "plugin:resources|close": () => null });
    let settled: unknown = null;
    void checkForClientUpdate().then((r) => (settled = r));
    await vi.advanceTimersByTimeAsync(SELF_UPDATE_CHECK_MS - 1);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ kind: "available", version: "0.2.0" });
    expect(calls[0]).toEqual({
      cmd: "plugin:updater|check",
      args: { timeout: UPDATE_CHECK_TIMEOUT_MS },
    });
    expect(calls).toContainEqual({ cmd: "plugin:resources|close", args: { rid: 7 } });
  });

  it("is up to date when nothing newer is published", async () => {
    vi.useFakeTimers();
    core({ "plugin:updater|check": () => null });
    const pending = checkForClientUpdate();
    await vi.advanceTimersByTimeAsync(SELF_UPDATE_CHECK_MS);
    await expect(pending).resolves.toEqual({ kind: "upToDate" });
  });

  it("treats a failed check (offline, endpoint down) as up to date, after the same 1.2 s", async () => {
    vi.useFakeTimers();
    core({
      "plugin:updater|check": () => {
        throw "error sending request for url (https://updates.paparats.app/latest.json)";
      },
    });
    const services = createTauriSystemService();
    let settled: unknown = null;
    void services.checkForAppUpdate().then((r) => (settled = r));
    await vi.advanceTimersByTimeAsync(SELF_UPDATE_CHECK_MS - 1);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ kind: "upToDate" });
  });
});

describe("installAppUpdate (tauri-plugin-updater)", () => {
  const metadata = {
    rid: 9,
    currentVersion: "0.1.0",
    version: "0.2.0",
    date: "2026-09-20T10:00:00Z",
    body: "Notes",
    rawJson: {},
  };

  it("checks again, then downloads and installs the update it found", async () => {
    core({
      "plugin:updater|check": () => metadata,
      "plugin:updater|download_and_install": () => null,
    });
    await expect(installClientUpdate()).resolves.toBeUndefined();
    expect(commandsCalled()).toEqual([
      "plugin:updater|check",
      "plugin:updater|download_and_install",
    ]);
    const install = calls.find((c) => c.cmd === "plugin:updater|download_and_install");
    expect(install?.args).toMatchObject({ rid: 9 });
  });

  it("does nothing when nothing newer is published", async () => {
    core({ "plugin:updater|check": () => null });
    await expect(installClientUpdate()).resolves.toBeUndefined();
    expect(commandsCalled()).toEqual(["plugin:updater|check"]);
  });

  it("rejects with a service error when the download or its signature fails", async () => {
    core({
      "plugin:updater|check": () => metadata,
      "plugin:updater|download_and_install": () => {
        throw "the signature of the update does not match";
      },
    });
    await expect(installClientUpdate()).rejects.toBeInstanceOf(ServiceError);
  });
});

describe("setAutostart (tauri-plugin-autostart)", () => {
  function autostart(registered: boolean): void {
    core({
      "plugin:autostart|is_enabled": () => registered,
      "plugin:autostart|enable": () => null,
      "plugin:autostart|disable": () => null,
    });
  }

  const pluginCalls = () => commandsCalled().filter((c) => c.startsWith("plugin:autostart"));

  it("registers the login entry when it is missing", async () => {
    autostart(false);
    await createTauriSystemService().setAutostart(true);
    expect(pluginCalls()).toEqual(["plugin:autostart|is_enabled", "plugin:autostart|enable"]);
  });

  it("removes it when it is there", async () => {
    autostart(true);
    await createTauriSystemService().setAutostart(false);
    expect(pluginCalls()).toEqual(["plugin:autostart|is_enabled", "plugin:autostart|disable"]);
  });

  it("does nothing when the entry already matches", async () => {
    autostart(true);
    await createTauriSystemService().setAutostart(true);
    autostart(false);
    await createTauriSystemService().setAutostart(false);
    expect(pluginCalls()).toEqual(["plugin:autostart|is_enabled"]);
  });

  it("rejects with a ServiceError when Windows refuses", async () => {
    core({
      "plugin:autostart|is_enabled": () => false,
      "plugin:autostart|enable": () => {
        throw "Access is denied. (os error 5)";
      },
    });
    const pending = createTauriSystemService().setAutostart(true);
    await expect(pending).rejects.toBeInstanceOf(ServiceError);
    await expect(pending).rejects.toMatchObject({ kind: "internal" });
  });
});

describe("tauriShell", () => {
  it("sends the tray language, the tray setting and the first frame to the core", async () => {
    core({
      shell_set_locale: () => null,
      shell_set_minimize_to_tray: () => null,
      shell_window_ready: () => null,
    });
    await tauriShell.setLocale("be");
    await tauriShell.setMinimizeToTray(false);
    await tauriShell.windowReady();
    expect(calls).toEqual([
      { cmd: "shell_set_locale", args: { locale: "be" } },
      { cmd: "shell_set_minimize_to_tray", args: { enabled: false } },
      { cmd: "shell_window_ready", args: {} },
    ]);
  });

  it("listens for links first, then takes the ones that came before", async () => {
    const pending: DeepLinkTarget[] = [{ kind: "app", id: "obs" }];
    core({
      shell_take_deep_links: () => {
        // From here on the core sends links as events: the listener must already be there.
        void emit("shell://deep-link", { kind: "app", id: "vlc" });
        return pending;
      },
    });
    const received: DeepLinkTarget[] = [];
    const stop = tauriShell.subscribeDeepLinks((target) => received.push(target));
    await vi.waitFor(() => expect(received).toEqual([{ kind: "app", id: "vlc" }, ...pending]));

    await emit("shell://deep-link", { kind: "channel", id: "kvetka" });
    expect(received).toHaveLength(3);
    expect(received.at(-1)).toEqual({ kind: "channel", id: "kvetka" });

    stop();
    stop(); // idempotent
    await emit("shell://deep-link", { kind: "app", id: "krita" });
    expect(received).toHaveLength(3);
  });

  it("does not take the pending links when unsubscribed before listening", async () => {
    core({ shell_take_deep_links: () => [{ kind: "app", id: "obs" }] });
    const listener = vi.fn();
    tauriShell.subscribeDeepLinks(listener)();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(commandsCalled()).not.toContain("shell_take_deep_links");
    expect(listener).not.toHaveBeenCalled();
  });

  it("delivers tray actions", async () => {
    core();
    const received: TrayAction[] = [];
    const stop = tauriShell.subscribeTrayActions((action) => received.push(action));
    await new Promise((resolve) => setTimeout(resolve, 0)); // the listener registers
    await emit("shell://tray-action", "checkForUpdates");
    expect(received).toEqual(["checkForUpdates"]);
    stop();
    await emit("shell://tray-action", "checkForUpdates");
    expect(received).toHaveLength(1);
  });
});
