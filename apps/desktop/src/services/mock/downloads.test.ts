import type { DownloadEvent } from "../contracts";
import type { DownloadPhase, DownloadRequest } from "../types";
import { createMockServices } from "./index";
import type { MockServiceOptions, MockServices } from "./index";
import { createMemoryStorage } from "./runtime";

const TICK = 110;

let services: MockServices;
let events: DownloadEvent[];

function setup(options: MockServiceOptions = {}) {
  // random = 1 → +10 % per tick: 100 % after 10 ticks, installed 8 ticks later.
  services = createMockServices({
    latencyMs: 0,
    random: () => 1,
    storage: createMemoryStorage(),
    ...options,
  });
  events = [];
  services.downloads.subscribe((e) => events.push(e));
  return services.downloads;
}

const request = (appId: string, kind: DownloadRequest["kind"] = "install"): DownloadRequest => ({
  appId,
  version: "9.9.9",
  sizeMb: 20,
  kind,
});

async function states() {
  const { items } = await services.downloads.getSnapshot();
  return items.map((i) => `${i.appId}:${i.state}`);
}

function phases(appId?: string): DownloadPhase["kind"][] {
  return events.flatMap((e) =>
    e.type === "state" && (!appId || e.payload.appId === appId) ? [e.payload.phase.kind] : [],
  );
}

const progressOf = (appId: string) =>
  events.flatMap((e) =>
    e.type === "progress" && e.payload.appId === appId ? [e.payload.progress] : [],
  );

const ticks = (n: number) => vi.advanceTimersByTimeAsync(n * TICK);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  services.dispose();
  vi.useRealTimers();
});

describe("mock downloads", () => {
  it("runs at most two items by default and queues the rest in order", async () => {
    const downloads = setup();
    await downloads.enqueue([request("files"), request("obs"), request("anki")]);

    expect(await states()).toEqual(["files:downloading", "obs:downloading", "anki:queued"]);
    expect(phases()).toEqual(["queued", "queued", "queued", "downloading", "downloading"]);
    expect((await downloads.getSnapshot()).concurrency).toBe(2);
  });

  it("advances 3–10 % per tick (3 + random·7) and reports received megabytes", async () => {
    const downloads = setup({ random: () => 0 });
    await downloads.enqueue([request("files")]);

    await ticks(2);
    expect(progressOf("files")).toEqual([3, 6]);
    const last = events.at(-1);
    expect(last).toEqual({
      type: "progress",
      payload: { appId: "files", progress: 6, receivedMb: 1.2, sizeMb: 20 },
    });
  });

  it("applies concurrency changes live (1 → 4 → 2)", async () => {
    const downloads = setup();
    await downloads.setConcurrency(1);
    await downloads.enqueue([request("files"), request("obs"), request("anki")]);
    expect(await states()).toEqual(["files:downloading", "obs:queued", "anki:queued"]);

    await downloads.setConcurrency(4);
    expect(await states()).toEqual(["files:downloading", "obs:downloading", "anki:downloading"]);

    // Lowering the limit never stops running items; it only holds back new starts.
    await downloads.setConcurrency(2);
    await downloads.enqueue([request("joplin")]);
    expect(await states()).toEqual([
      "files:downloading",
      "obs:downloading",
      "anki:downloading",
      "joplin:queued",
    ]);
  });

  it("starts with the persisted Parallel downloads setting", async () => {
    const storage = createMemoryStorage();
    storage.setItem("paparats.settings", JSON.stringify({ parallel: 4 }));
    const downloads = setup({ storage });
    expect((await downloads.getSnapshot()).concurrency).toBe(4);
  });

  it("holds in installing for 8 ticks, then records the install and starts the next item", async () => {
    const downloads = setup();
    await downloads.setConcurrency(1);
    await downloads.enqueue([request("files"), request("obs")]);

    await ticks(10);
    expect(phases("files")).toEqual(["queued", "downloading", "installing"]);
    expect(await states()).toEqual(["files:installing", "obs:queued"]);

    await ticks(7);
    expect(phases("files")).not.toContain("installed");
    expect(services.world.library.installed.some((a) => a.appId === "files")).toBe(false);

    await ticks(1);
    const installed = events.find(
      (e) => e.type === "state" && e.payload.phase.kind === "installed",
    );
    expect(installed).toEqual({
      type: "state",
      payload: { appId: "files", phase: { kind: "installed", version: "9.9.9", update: false } },
    });
    expect(services.world.library.installed.at(-1)).toEqual({
      appId: "files",
      version: "9.9.9",
      lastUsed: "2026-09-15",
    });
    expect(services.world.account.activity[0]).toEqual({
      kind: "installed",
      appId: "files",
      version: "9.9.9",
      date: "2026-09-15",
    });
    expect(services.world.account.usage.updatesInstalled).toBe(248);
    expect(await states()).toEqual(["obs:downloading"]);
  });

  it("records updates in place, as 'updated' activity, and counts them", async () => {
    const downloads = setup();
    await downloads.enqueue([{ appId: "obsidian", version: "1.8.10", sizeMb: 32, kind: "update" }]);

    await ticks(18);
    const library = await services.install.getLibrary();
    expect(library.installed.find((a) => a.appId === "obsidian")).toEqual({
      appId: "obsidian",
      version: "1.8.10",
      lastUsed: "2026-09-15",
    });
    expect(library.installed.filter((a) => a.appId === "obsidian")).toHaveLength(1);
    const account = await services.account.getAccount();
    expect(account.activity[0]).toMatchObject({ kind: "updated", appId: "obsidian" });
    expect(account.usage.updatesInstalled).toBe(249);
    expect(phases("obsidian").at(-1)).toBe("installed");
  });

  it("pauses and resumes a running download; paused items keep their slot", async () => {
    const downloads = setup({ random: () => 0 });
    await downloads.setConcurrency(1);
    await downloads.enqueue([request("files"), request("obs")]);
    await ticks(1);

    await downloads.pause("files");
    await downloads.pause("obs"); // queued: nothing to pause
    await ticks(5);
    expect(progressOf("files")).toEqual([3]);
    expect(await states()).toEqual(["files:paused", "obs:queued"]);

    await downloads.resume("files");
    await ticks(1);
    expect(progressOf("files")).toEqual([3, 6]);
    expect(phases("files")).toEqual(["queued", "downloading", "paused", "downloading"]);
    expect(phases("obs")).toEqual(["queued"]);
  });

  it("pauseAll / resumeAll act on every running download", async () => {
    const downloads = setup();
    await downloads.enqueue([request("files"), request("obs"), request("anki")]);
    await downloads.pauseAll();
    expect(await states()).toEqual(["files:paused", "obs:paused", "anki:queued"]);

    await downloads.resumeAll();
    expect(await states()).toEqual(["files:downloading", "obs:downloading", "anki:queued"]);
  });

  it("cancel removes an item and pumps the next one", async () => {
    const downloads = setup();
    await downloads.enqueue([request("files"), request("obs"), request("anki"), request("joplin")]);

    await downloads.cancel("files");
    expect(await states()).toEqual(["obs:downloading", "anki:downloading", "joplin:queued"]);
    await downloads.cancel("joplin");
    expect(await states()).toEqual(["obs:downloading", "anki:downloading"]);
    expect(phases("files").at(-1)).toBe("cancelled");
    expect(phases("joplin")).toEqual(["queued", "cancelled"]);

    await ticks(30);
    expect(services.world.library.installed.some((a) => a.appId === "files")).toBe(false);
  });

  it("cancelAll clears the queue and stops every timer", async () => {
    const downloads = setup();
    await downloads.enqueue([request("files"), request("obs"), request("anki")]);
    await downloads.cancelAll();

    expect(await states()).toEqual([]);
    expect(phases().filter((k) => k === "cancelled")).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("offline: nothing advances or starts; back online resumes and pumps", async () => {
    const downloads = setup();
    await downloads.setConcurrency(1);
    await downloads.enqueue([request("files")]);
    await ticks(2);
    await downloads.setOnline(false);
    await downloads.enqueue([request("obs")]);
    await downloads.cancel("files");

    await ticks(20);
    expect(progressOf("files")).toEqual([10, 20]);
    expect(await states()).toEqual(["obs:queued"]);
    expect((await downloads.getSnapshot()).online).toBe(false);

    await downloads.setOnline(true);
    expect(await states()).toEqual(["obs:downloading"]);
    await ticks(1);
    expect(progressOf("obs")).toEqual([10]);
  });

  it("offline freezes running downloads without changing their state", async () => {
    const downloads = setup();
    await downloads.enqueue([request("files")]);
    await ticks(1);
    await downloads.setOnline(false);
    await ticks(10);
    expect(progressOf("files")).toEqual([10]);
    expect(await states()).toEqual(["files:downloading"]);

    await downloads.setOnline(true);
    await ticks(1);
    expect(progressOf("files")).toEqual([10, 20]);
  });

  it("ignores requests for ids already queued or running", async () => {
    const downloads = setup();
    await downloads.setConcurrency(1);
    await downloads.enqueue([request("files"), request("obs")]);
    await downloads.enqueue([request("files"), request("obs"), request("anki"), request("anki")]);

    expect(await states()).toEqual(["files:downloading", "obs:queued", "anki:queued"]);
    expect(phases("anki")).toEqual(["queued"]);
  });

  it("rejects an invalid concurrency", async () => {
    const downloads = setup();
    await expect(downloads.setConcurrency(0)).rejects.toMatchObject({ kind: "invalid" });
  });

  it("stops notifying after unsubscribe", async () => {
    const downloads = setup();
    const seen: DownloadEvent[] = [];
    const unsubscribe = downloads.subscribe((e) => seen.push(e));
    await downloads.enqueue([request("files")]);
    unsubscribe();
    await ticks(3);
    expect(seen.map((e) => e.type)).toEqual(["state", "state"]);
  });
});
