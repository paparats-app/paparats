import { createTestServices } from "@/hooks/testing";
import { ServiceError, setServices, type DownloadEvent, type DownloadService } from "@/services";
import type { DownloadItem, DownloadPhase, DownloadRequest } from "@/services/types";
import { allPaused, batchProgress, useDownloadsStore } from "./useDownloadsStore";

const store = () => useDownloadsStore.getState();

const req = (appId: string, kind: DownloadRequest["kind"] = "update"): DownloadRequest => ({
  appId,
  version: "2.0",
  kind,
  sizeMb: 10,
});
const state = (appId: string, phase: DownloadPhase): DownloadEvent => ({
  type: "state",
  payload: { appId, phase },
});
const progress = (appId: string, value: number): DownloadEvent => ({
  type: "progress",
  payload: { appId, progress: value, receivedMb: value / 10, sizeMb: 10 },
});
const item = (appId: string, patch: Partial<DownloadItem> = {}): DownloadItem => ({
  ...req(appId),
  state: "downloading",
  progress: 50,
  ...patch,
});

/** A download service that records calls and never emits (the test feeds events itself). */
function recordingDownloads(overrides: Partial<DownloadService> = {}): DownloadService {
  const ok = () => Promise.resolve();
  return {
    getSnapshot: () => Promise.resolve({ items: [], concurrency: 2, online: true }),
    subscribe: () => () => undefined,
    enqueue: vi.fn(ok),
    pause: vi.fn(ok),
    resume: vi.fn(ok),
    cancel: vi.fn(ok),
    pauseAll: vi.fn(ok),
    resumeAll: vi.fn(ok),
    cancelAll: vi.fn(ok),
    setConcurrency: vi.fn(ok),
    setOnline: vi.fn(ok),
    ...overrides,
  };
}

function useDownloads(downloads: DownloadService) {
  setServices({ ...createTestServices(), downloads });
  return downloads;
}

beforeEach(() => {
  useDownloadsStore.setState(useDownloadsStore.getInitialState(), true);
});

describe("enqueue", () => {
  it("shows new requests as queued before the service answers", async () => {
    let answer: () => void = () => undefined;
    const downloads = useDownloads(
      recordingDownloads({ enqueue: () => new Promise<void>((r) => (answer = r)) }),
    );
    const done = store().enqueue([req("vscode"), req("obsidian"), req("vscode")]);
    expect(store().order).toEqual(["vscode", "obsidian"]);
    expect(store().items.vscode).toMatchObject({
      state: "queued",
      progress: 0,
      kind: "update",
      version: "2.0",
    });
    answer();
    await done;
    expect(downloads).toBeDefined();
  });

  it("leaves items already in the queue alone", async () => {
    const downloads = useDownloads(recordingDownloads());
    store().applySnapshot({
      items: [item("vscode", { progress: 70 })],
      concurrency: 2,
      online: true,
    });
    await store().enqueue([req("vscode")]);
    expect(store().items.vscode?.progress).toBe(70);
    expect(downloads.enqueue).toHaveBeenCalledWith([req("vscode")]);
  });

  it("drops the optimistic items and resyncs when the service refuses", async () => {
    const getSnapshot = vi.fn(() =>
      Promise.resolve({ items: [item("krita")], concurrency: 2, online: true }),
    );
    useDownloads(
      recordingDownloads({
        enqueue: () => Promise.reject(new ServiceError("internal", "nope")),
        getSnapshot,
      }),
    );
    await store().startBatch([req("vscode")]);
    expect(getSnapshot).toHaveBeenCalled();
    expect(store().order).toEqual(["krita"]);
    expect(store().batch).toBeNull();
  });
});

describe("events", () => {
  beforeEach(() => {
    useDownloads(recordingDownloads());
  });

  it("tracks progress and lifecycle states", async () => {
    await store().enqueue([req("vscode")]);
    expect(store().applyEvent(state("vscode", { kind: "downloading" }))).toEqual({
      installed: null,
      batchFinished: false,
      unknown: false,
    });
    store().applyEvent(progress("vscode", 42.5));
    expect(store().items.vscode).toMatchObject({ state: "downloading", progress: 42.5 });
    store().applyEvent(state("vscode", { kind: "paused" }));
    expect(store().items.vscode?.state).toBe("paused");
    store().applyEvent(state("vscode", { kind: "installing" }));
    expect(store().items.vscode).toMatchObject({ state: "installing", progress: 100 });
  });

  it("flags events about unknown items", () => {
    expect(store().applyEvent(progress("ghost", 10)).unknown).toBe(true);
    expect(store().applyEvent(state("ghost", { kind: "downloading" })).unknown).toBe(true);
  });

  it("removes landed items and marks installed updates as just updated", async () => {
    await store().enqueue([req("vscode"), req("files", "install")]);
    const outcome = store().applyEvent(
      state("vscode", { kind: "installed", version: "2.0", update: true }),
    );
    expect(outcome.installed).toEqual({ appId: "vscode", version: "2.0", update: true });
    expect(store().items.vscode).toBeUndefined();
    expect(store().order).toEqual(["files"]);
    expect(store().justUpdated).toEqual({ vscode: true });

    store().applyEvent(state("files", { kind: "installed", version: "2.0", update: false }));
    expect(store().justUpdated).toEqual({ vscode: true });
  });

  it("removes cancelled and failed items without markers", async () => {
    await store().enqueue([req("vscode"), req("krita")]);
    expect(store().applyEvent(state("vscode", { kind: "cancelled" })).installed).toBeNull();
    store().applyEvent(state("krita", { kind: "failed", message: "hash mismatch" }));
    expect(store().order).toEqual([]);
    expect(store().justUpdated).toEqual({});
  });
});

describe("batch (Update all)", () => {
  beforeEach(() => {
    useDownloads(recordingDownloads());
  });

  it("finishes when its last item lands", async () => {
    await store().startBatch([req("vscode"), req("obsidian")]);
    await store().enqueue([req("files", "install")]);
    expect(store().batch).toEqual({ ids: ["vscode", "obsidian"] });

    let outcome = store().applyEvent(
      state("vscode", { kind: "installed", version: "2.0", update: true }),
    );
    expect(outcome.batchFinished).toBe(false);
    outcome = store().applyEvent(
      state("files", { kind: "installed", version: "2.0", update: false }),
    );
    expect(outcome.batchFinished).toBe(false);
    outcome = store().applyEvent(
      state("obsidian", { kind: "installed", version: "2.0", update: true }),
    );
    expect(outcome.batchFinished).toBe(true);
    expect(store().batch).toBeNull();
  });

  it("ends without the toast when the last item is cancelled", async () => {
    await store().startBatch([req("vscode"), req("obsidian")]);
    store().applyEvent(state("vscode", { kind: "installed", version: "2.0", update: true }));
    const outcome = store().applyEvent(state("obsidian", { kind: "cancelled" }));
    expect(outcome.batchFinished).toBe(false);
    expect(store().batch).toBeNull();
  });

  it("reports progress: landed items count as 100 %", async () => {
    await store().startBatch([req("a"), req("b"), req("c"), req("d")]);
    store().applyEvent(state("a", { kind: "installed", version: "2.0", update: true }));
    store().applyEvent(state("b", { kind: "downloading" }));
    store().applyEvent(progress("b", 50));
    expect(batchProgress(store().batch, store().items)).toEqual({
      active: true,
      done: 1,
      total: 4,
      percent: 38,
    });
    expect(batchProgress(null, store().items)).toBeNull();
  });

  it("is dropped by Cancel all", async () => {
    const downloads = useDownloads(recordingDownloads());
    await store().startBatch([req("vscode")]);
    await store().cancelAll();
    expect(store().batch).toBeNull();
    expect(downloads.cancelAll).toHaveBeenCalled();
  });

  it("is dropped by a snapshot without any of its items", async () => {
    await store().startBatch([req("vscode")]);
    store().applySnapshot({ items: [item("krita")], concurrency: 2, online: true });
    expect(store().batch).toBeNull();
    expect(store().order).toEqual(["krita"]);
  });
});

describe("actions and markers", () => {
  it("delegates pause/resume/cancel to the service and resyncs on failure", async () => {
    const getSnapshot = vi.fn(() => Promise.resolve({ items: [], concurrency: 2, online: true }));
    const downloads = useDownloads(
      recordingDownloads({ getSnapshot, resume: () => Promise.reject(new Error("x")) }),
    );
    await store().pause("vscode");
    await store().cancel("vscode");
    await store().pauseAll();
    await store().resumeAll();
    expect(downloads.pause).toHaveBeenCalledWith("vscode");
    expect(downloads.cancel).toHaveBeenCalledWith("vscode");
    expect(downloads.pauseAll).toHaveBeenCalled();
    expect(downloads.resumeAll).toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    await store().resume("vscode");
    expect(getSnapshot).toHaveBeenCalledTimes(1);
  });

  it("clears one or all just-updated markers", () => {
    useDownloadsStore.setState({ justUpdated: { vscode: true, obsidian: true } });
    store().clearJustUpdated("vscode");
    expect(store().justUpdated).toEqual({ obsidian: true });
    store().clearJustUpdated();
    expect(store().justUpdated).toEqual({});
  });

  it("knows when every started download is paused", () => {
    expect(allPaused({})).toBe(false);
    expect(
      allPaused({ a: item("a", { state: "paused" }), b: item("b", { state: "queued" }) }),
    ).toBe(true);
    expect(
      allPaused({ a: item("a", { state: "paused" }), b: item("b", { state: "installing" }) }),
    ).toBe(false);
  });
});
