// The Tauri adapters against @tauri-apps/api/mocks: every contract method reaches its command
// with the argument names the Rust side expects, results and `{kind, message}` errors come back as
// the contract says, the typed download events map onto `DownloadEvent`, and settings round-trip
// through the store plugin's commands. The update check, autostart and the native shell have their
// own file (system.test.ts).
import { emit } from "@tauri-apps/api/event";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { openUrl } from "@tauri-apps/plugin-opener";
import catalogJson from "@fixtures/catalog.json";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import type { DownloadEvent, Services } from "../contracts";
import { ServiceError } from "../errors";
import type {
  DownloadProgress,
  DownloadRequest,
  DownloadStateChange,
  IdeaDraft,
  ReportTarget,
} from "../types";
import { SETTINGS_STORE_FILE, createTauriServices } from "./index";
import { unwrap } from "./result";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

type Args = Record<string, unknown>;
type Handler = (args: Args) => unknown;

interface Call {
  cmd: string;
  args: Args;
}

/** Commands the fake core received, in order (event-plugin traffic is handled by the mock). */
let calls: Call[];

/**
 * Installs a fake core: `handlers[cmd]` answers, a throw is the command's error (thrown values
 * reach the adapter like Tauri's rejections), and an unknown command rejects with Tauri's string.
 */
function core(handlers: Record<string, Handler> = {}): Services {
  calls = [];
  mockIPC(
    (cmd, payload) => {
      const args = (payload ?? {}) as Args;
      calls.push({ cmd, args });
      const handler = handlers[cmd];
      if (!handler) throw `command ${cmd} not found`;
      return handler(args);
    },
    { shouldMockEvents: true },
  );
  return createTauriServices();
}

/** A command answering `value` whatever the arguments. */
const answer =
  (value: unknown): Handler =>
  () =>
    value;

/** A command failing with the Rust `AppError` wire shape. */
const fail =
  (kind: string, message: string): Handler =>
  () => {
    throw { kind, message };
  };

afterEach(() => {
  clearMocks();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(openUrl).mockClear();
});

describe("unwrap", () => {
  it("returns the data of an ok result", async () => {
    await expect(unwrap(Promise.resolve({ status: "ok", data: 7 }))).resolves.toBe(7);
  });

  it("turns an error result into a ServiceError of the same kind", async () => {
    const pending = unwrap(
      Promise.resolve({ status: "error", error: { kind: "notFound", message: "no app" } }),
    );
    await expect(pending).rejects.toBeInstanceOf(ServiceError);
    await expect(pending).rejects.toMatchObject({ kind: "notFound", message: "no app" });
  });

  it("turns an IPC failure into an internal ServiceError", async () => {
    await expect(unwrap(Promise.reject(new Error("ipc down")))).rejects.toMatchObject({
      kind: "internal",
      message: "ipc down",
    });
  });

  it("treats an error that is not an AppError as internal", async () => {
    const tauriString = "invalid args `limit` for command `downloads_set_concurrency`";
    const odd = { kind: "teapot", message: "?" };
    for (const error of [tauriString, odd]) {
      const pending = unwrap(Promise.resolve({ status: "error", error } as never));
      await expect(pending).rejects.toBeInstanceOf(ServiceError);
      await expect(pending).rejects.toMatchObject({ kind: "internal" });
    }
  });
});

describe("tauri adapters: commands", () => {
  const request: DownloadRequest = {
    appId: "obs",
    version: "31.1.2",
    sizeMb: 118,
    kind: "install",
  };
  const draft: IdeaDraft = {
    kind: "new",
    appId: null,
    category: "utilities",
    title: "Tray timer",
    body: "",
  };
  const target: ReportTarget = { appId: "vlc", channelId: "paparats" };

  // Every contract method with a Rust side → [command, arguments as the core deserializes them].
  const routes: [string, (s: Services) => Promise<unknown>, string, Args][] = [
    ["catalog.getCatalog", (s) => s.catalog.getCatalog(), "catalog_get_catalog", {}],
    ["catalog.getPlatform", (s) => s.catalog.getPlatform(), "catalog_get_platform", {}],
    ["install.getLibrary", (s) => s.install.getLibrary(), "install_get_library", {}],
    [
      "install.setFavorite",
      (s) => s.install.setFavorite("krita", true),
      "install_set_favorite",
      { appId: "krita", favorite: true },
    ],
    ["install.uninstall", (s) => s.install.uninstall("vlc"), "install_uninstall", { appId: "vlc" }],
    ["install.open", (s) => s.install.open("vlc"), "install_open", { appId: "vlc" }],
    [
      "install.openInstallFolder",
      (s) => s.install.openInstallFolder("vlc"),
      "install_open_folder",
      { appId: "vlc" },
    ],
    ["downloads.getSnapshot", (s) => s.downloads.getSnapshot(), "downloads_snapshot", {}],
    [
      "downloads.enqueue",
      (s) => s.downloads.enqueue([request]),
      "downloads_enqueue",
      { requests: [request] },
    ],
    ["downloads.pause", (s) => s.downloads.pause("obs"), "downloads_pause", { appId: "obs" }],
    ["downloads.resume", (s) => s.downloads.resume("obs"), "downloads_resume", { appId: "obs" }],
    ["downloads.cancel", (s) => s.downloads.cancel("obs"), "downloads_cancel", { appId: "obs" }],
    ["downloads.pauseAll", (s) => s.downloads.pauseAll(), "downloads_pause_all", {}],
    ["downloads.resumeAll", (s) => s.downloads.resumeAll(), "downloads_resume_all", {}],
    ["downloads.cancelAll", (s) => s.downloads.cancelAll(), "downloads_cancel_all", {}],
    [
      "downloads.setConcurrency",
      (s) => s.downloads.setConcurrency(4),
      "downloads_set_concurrency",
      { limit: 4 },
    ],
    [
      "downloads.setOnline",
      (s) => s.downloads.setOnline(false),
      "downloads_set_online",
      { online: false },
    ],
    ["channels.getChannels", (s) => s.channels.getChannels(), "channels_get_channels", {}],
    [
      "channels.getSubscriptions",
      (s) => s.channels.getSubscriptions(),
      "channels_get_subscriptions",
      {},
    ],
    [
      "channels.lookup",
      (s) => s.channels.lookup("@vitrazh"),
      "channels_lookup",
      { address: "@vitrazh" },
    ],
    [
      "channels.subscribe",
      (s) => s.channels.subscribe("vitrazh"),
      "channels_subscribe",
      { channelId: "vitrazh" },
    ],
    [
      "channels.unsubscribe",
      (s) => s.channels.unsubscribe("vitrazh"),
      "channels_unsubscribe",
      { channelId: "vitrazh" },
    ],
    [
      "channels.setPaused",
      (s) => s.channels.setPaused("kvetka", true),
      "channels_set_paused",
      { channelId: "kvetka", paused: true },
    ],
    [
      "channels.acknowledgeStale",
      (s) => s.channels.acknowledgeStale("fossfriends"),
      "channels_acknowledge_stale",
      { channelId: "fossfriends" },
    ],
    ["channels.sync", (s) => s.channels.sync("vitrazh"), "channels_sync", { channelId: "vitrazh" }],
    [
      "channels.report",
      (s) => s.channels.report(target, "Crashes on start"),
      "channels_report",
      { target, text: "Crashes on start" },
    ],
    ["ideas.getIdeas", (s) => s.ideas.getIdeas(), "ideas_get", {}],
    ["ideas.vote", (s) => s.ideas.vote("clip"), "ideas_vote", { ideaId: "clip" }],
    ["ideas.propose", (s) => s.ideas.propose(draft), "ideas_propose", { draft }],
    [
      "ideas.comment",
      (s) => s.ideas.comment("clip", "On it", { kind: "developer", channelId: "kvetka" }),
      "ideas_comment",
      { ideaId: "clip", text: "On it", actor: { kind: "developer", channelId: "kvetka" } },
    ],
    [
      "ideas.take",
      (s) => s.ideas.take("clip", "kvetka"),
      "ideas_take",
      { ideaId: "clip", channelId: "kvetka" },
    ],
    [
      "ideas.release",
      (s) => s.ideas.release("clip", "shell", "1.9.16"),
      "ideas_release",
      { ideaId: "clip", appId: "shell", version: "1.9.16" },
    ],
    [
      "ideas.dismissReleaseNote",
      (s) => s.ideas.dismissReleaseNote("slounik"),
      "ideas_dismiss_release_note",
      { ideaId: "slounik" },
    ],
    ["account.getAccount", (s) => s.account.getAccount(), "account_get", {}],
    [
      "account.updateProfile",
      (s) => s.account.updateProfile({ name: "Ales", email: "ales@example.com" }),
      "account_update_profile",
      { patch: { name: "Ales", email: "ales@example.com" } },
    ],
    [
      "account.removeDevice",
      (s) => s.account.removeDevice("dev-2"),
      "account_remove_device",
      { deviceId: "dev-2" },
    ],
    [
      "account.setTwoFactor",
      (s) => s.account.setTwoFactor(false),
      "account_set_two_factor",
      { enabled: false },
    ],
    [
      "account.purchase",
      (s) => s.account.purchase("yearly"),
      "account_purchase",
      { plan: "yearly" },
    ],
    ["account.cancelPlan", (s) => s.account.cancelPlan(), "account_cancel_plan", {}],
    ["account.claimIdeaBonus", (s) => s.account.claimIdeaBonus(), "account_claim_idea_bonus", {}],
    [
      "account.signIn",
      (s) => s.account.signIn("me@example.com", "pw"),
      "account_sign_in",
      { email: "me@example.com", password: "pw" },
    ],
    ["account.signOut", (s) => s.account.signOut(), "account_sign_out", {}],
  ];

  const table = routes.map(([method, call, cmd, args]) => [method, cmd, args, call] as const);
  it.each(table)("%s → %s", async (_method, cmd, args, call) => {
    const reply = { from: cmd };
    const services = core({ [cmd]: answer(reply), system_today: answer("2026-09-15") });
    const result = await call(services);
    expect(calls.at(-1)).toEqual({ cmd, args });
    // Queries and mutations return the core's answer untouched; actions resolve with nothing.
    expect([reply, undefined]).toContainEqual(result);
  });

  it("returns the core's data unchanged (the catalog snapshot)", async () => {
    const services = core({ catalog_get_catalog: answer(catalogJson) });
    const catalog = await services.catalog.getCatalog();
    expect(catalog.apps).toHaveLength(32);
    expect(catalog).toEqual(catalogJson);
  });

  it("rejects with the core's error kind (the mock's rules, D12)", async () => {
    const services = core({
      channels_unsubscribe: fail("invalid", "the official catalog cannot be removed"),
      ideas_vote: fail("notFound", "idea ghost"),
      account_purchase: fail("internal", "database is locked"),
    });
    await expect(services.channels.unsubscribe("paparats")).rejects.toMatchObject({
      name: "ServiceError",
      kind: "invalid",
      message: "the official catalog cannot be removed",
    });
    await expect(services.ideas.vote("ghost")).rejects.toMatchObject({ kind: "notFound" });
    await expect(services.account.purchase("monthly")).rejects.toMatchObject({
      kind: "internal",
    });
  });

  it("reports a command the core does not know as internal", async () => {
    const services = core();
    await expect(services.catalog.getPlatform()).rejects.toMatchObject({
      kind: "internal",
      message: "command catalog_get_platform not found",
    });
  });

  it("rejects a concurrency the mock rejects without reaching the core", async () => {
    const services = core({ downloads_set_concurrency: answer(null) });
    for (const limit of [0, -1, 1.5, Number.NaN]) {
      await expect(services.downloads.setConcurrency(limit)).rejects.toMatchObject({
        kind: "invalid",
      });
    }
    expect(calls.filter((c) => c.cmd === "downloads_set_concurrency")).toEqual([]);
  });
});

describe("tauri adapters: download events", () => {
  const progress: DownloadProgress = { appId: "obs", progress: 10, receivedMb: 11.8, sizeMb: 118 };
  const installing: DownloadStateChange = { appId: "obs", phase: { kind: "installing" } };
  const installed: DownloadStateChange = {
    appId: "obs",
    phase: { kind: "installed", version: "31.1.2", update: false },
  };
  const snapshot = { items: [], concurrency: 2, online: true };

  it("maps download://progress and download://state onto DownloadEvent, in order", async () => {
    const services = core({ downloads_snapshot: answer(snapshot) });
    const seen: DownloadEvent[] = [];
    const unsubscribe = services.downloads.subscribe((e) => seen.push(e));
    // The snapshot is read once the listeners are registered.
    await expect(services.downloads.getSnapshot()).resolves.toEqual(snapshot);

    await emit("download://progress", progress);
    await emit("download://state", installing);
    await emit("download://state", installed);
    await emit("download://other", installed);
    expect(seen).toEqual([
      { type: "progress", payload: progress },
      { type: "state", payload: installing },
      { type: "state", payload: installed },
    ]);
    unsubscribe();
  });

  it("stops delivering at once when unsubscribed", async () => {
    // The mocked event plugin warns about callbacks it no longer finds.
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const services = core({ downloads_snapshot: answer(snapshot) });
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = services.downloads.subscribe(first);
    services.downloads.subscribe(second);
    await services.downloads.getSnapshot();

    unsubscribeFirst();
    unsubscribeFirst(); // idempotent
    await emit("download://progress", progress);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ type: "progress", payload: progress });
  });
});

describe("tauri adapters: system", () => {
  it("today() is the core's date, asked again when the local date changes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 5, 23, 59));
    let coreToday = "2027-01-05";
    const services = core({ system_today: () => coreToday });
    // Until the core answers, the local date stands in.
    expect(services.system.today()).toBe("2027-01-05");
    await vi.waitFor(() => expect(calls.map((c) => c.cmd)).toEqual(["system_today"]));

    coreToday = "2027-01-04"; // the core's clock is authoritative
    vi.setSystemTime(new Date(2027, 0, 6, 0, 1));
    expect(services.system.today()).toBe("2027-01-06");
    await vi.waitFor(() => expect(services.system.today()).toBe("2027-01-04"));
    expect(calls.filter((c) => c.cmd === "system_today")).toHaveLength(2);
    services.system.today();
    expect(calls.filter((c) => c.cmd === "system_today")).toHaveLength(2);
  });

  it("falls back to the local date when the core cannot answer", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 5, 12, 0));
    const services = core({ system_today: fail("internal", "clock") });
    expect(calls).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 0)); // the failure settles
    expect(services.system.today()).toBe("2027-01-05");
    expect(services.system.today()).toBe("2027-01-05");
    expect(calls).toHaveLength(1);
  });

  it("opens external links through the opener plugin", async () => {
    const services = core({ system_today: answer("2026-09-15") });
    await services.system.openExternal("kvetka.example/support");
    expect(openUrl).toHaveBeenCalledWith("https://kvetka.example/support");

    await expect(services.system.openExternal("file:///C:/")).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(openUrl).toHaveBeenCalledTimes(1);
  });

  it("reports an opener failure as a ServiceError", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce("not allowed");
    const services = core({ system_today: answer("2026-09-15") });
    await expect(services.system.openExternal("https://paparats.app")).rejects.toMatchObject({
      kind: "internal",
      message: "not allowed",
    });
  });
});

describe("tauri adapters: settings store", () => {
  /** settings.json on "disk". */
  interface SettingsFile {
    data: Args;
  }
  const file = (data: Args = {}): SettingsFile => ({ data });

  /** The store plugin's commands over `disk` and an in-memory copy, like tauri-plugin-store. */
  function storePlugin(disk: SettingsFile, fail: { load?: boolean; save?: boolean } = {}) {
    let memory: Args = {};
    const handlers: Record<string, Handler> = {
      system_today: answer("2026-09-15"),
      "plugin:store|load": ({ path, options }) => {
        if (fail.load) throw "store unavailable";
        expect(path).toBe(SETTINGS_STORE_FILE);
        expect(options).toMatchObject({ autoSave: false });
        memory = { ...disk.data };
        return 7;
      },
      "plugin:store|entries": ({ rid }) => {
        expect(rid).toBe(7);
        return Object.entries(memory);
      },
      "plugin:store|set": ({ key, value }) => {
        memory[key as string] = value;
        return null;
      },
      "plugin:store|save": () => {
        if (fail.save) throw "disk full";
        disk.data = { ...memory };
        return null;
      },
      "plugin:store|reload": ({ ignoreDefaults }) => {
        expect(ignoreDefaults).toBe(true);
        memory = { ...disk.data };
        return null;
      },
    };
    return handlers;
  }

  it("returns the defaults while settings.json is empty", async () => {
    const services = core(storePlugin(file()));
    expect(await services.settings.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("persists changed keys to settings.json and reads them back after a restart", async () => {
    const disk = file({});
    const services = core(storePlugin(disk));
    const next = await services.settings.updateSettings({ theme: "light", parallel: 4 });
    expect(next).toEqual({ ...DEFAULT_SETTINGS, theme: "light", parallel: 4 });
    expect(disk.data).toEqual({ theme: "light", parallel: 4 });
    expect(await services.settings.updateSettings({ locale: "be" })).toMatchObject({
      theme: "light",
      locale: "be",
    });
    expect(calls.filter((c) => c.cmd === "plugin:store|load")).toHaveLength(1);

    const restarted = core(storePlugin(disk));
    expect(await restarted.settings.getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "light",
      parallel: 4,
      locale: "be",
    });
  });

  it("ignores unknown keys and values of the wrong type, in the file and in patches", async () => {
    const disk = file({ parallel: "4", tray: false, extra: 1, locale: "ru" });
    const services = core(storePlugin(disk));
    expect(await services.settings.getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      tray: false,
      locale: "ru",
    });
    const patch = { dev: "yes", nope: true, crash: true } as unknown as Partial<
      typeof DEFAULT_SETTINGS
    >;
    await services.settings.updateSettings(patch);
    expect(disk.data).toMatchObject({ crash: true });
    expect(disk.data).not.toHaveProperty("nope");
    expect(disk.data).not.toHaveProperty("dev");
  });

  it("applies quick successive updates in order", async () => {
    const disk = file({});
    const services = core(storePlugin(disk));
    const updates = [true, false, true].map((dev) => services.settings.updateSettings({ dev }));
    const results = await Promise.all(updates);
    expect(results.map((s) => s.dev)).toEqual([true, false, true]);
    expect(disk.data).toEqual({ dev: true });
  });

  it("a failed save rejects internal and does not leak into later reads", async () => {
    const disk = file({ theme: "light" });
    const services = core(storePlugin(disk, { save: true }));
    await expect(services.settings.updateSettings({ theme: "system" })).rejects.toMatchObject({
      kind: "internal",
      message: "Settings could not be saved: disk full",
    });
    expect((await services.settings.getSettings()).theme).toBe("light");
    expect(disk.data).toEqual({ theme: "light" });
  });

  it("a store that cannot be opened rejects internal and is retried on the next call", async () => {
    const fails = { load: true };
    const services = core(storePlugin(file(), fails));
    await expect(services.settings.getSettings()).rejects.toMatchObject({
      kind: "internal",
      message: "Settings could not be read: store unavailable",
    });
    fails.load = false;
    await expect(services.settings.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    expect(calls.filter((c) => c.cmd === "plugin:store|load")).toHaveLength(2);
  });

  it("clearSearchHistory resolves (nothing is stored yet)", async () => {
    const services = core(storePlugin(file()));
    await expect(services.settings.clearSearchHistory()).resolves.toBeUndefined();
  });
});
