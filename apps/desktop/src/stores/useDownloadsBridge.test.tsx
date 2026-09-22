import { act } from "@testing-library/react";
import { flush, renderWithServices, resetStores } from "@/hooks/testing";
import { queryKeys } from "@/queries";
import type { DownloadRequest } from "@/services/types";
import { useDownloadsBridge } from "./useDownloadsBridge";
import { useDownloadsStore } from "./useDownloadsStore";
import { useSettingsStore } from "./useSettingsStore";
import { useUiStore } from "./useUiStore";

const TICK = 110;
/** +10 % per tick → 10 ticks to 100 %, then 8 ticks installing. */
const INSTALL_MS = 18 * TICK;

const store = () => useDownloadsStore.getState();
const update = (appId: string, version: string, sizeMb: number): DownloadRequest => ({
  appId,
  version,
  sizeMb,
  kind: "update",
});

beforeEach(() => {
  vi.useFakeTimers();
  resetStores();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("runs Update all to the end: progress, just-updated markers, library refresh, one toast", async () => {
  const { services, queryClient, unmount } = renderWithServices(() => useDownloadsBridge());
  await flush();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  await act(() =>
    store().startBatch([
      update("vscode", "1.93.0", 87),
      update("obsidian", "1.8.10", 12),
      update("sharex", "17.1.0", 8),
    ]),
  );
  expect(store().items.vscode?.state).toBe("downloading");
  expect(store().items.obsidian?.state).toBe("downloading");
  expect(store().items.sharex?.state).toBe("queued");

  await flush(4 * TICK);
  expect(store().items.vscode?.progress).toBeCloseTo(40);

  await flush(INSTALL_MS - 4 * TICK);
  expect(store().items.vscode).toBeUndefined();
  expect(store().justUpdated).toEqual({ vscode: true, obsidian: true });
  expect(store().items.sharex?.state).toBe("downloading");
  expect(store().batch).not.toBeNull();
  expect(useUiStore.getState().toast).toBeNull();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.library });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.account });

  await flush(INSTALL_MS);
  expect(store().order).toEqual([]);
  expect(store().batch).toBeNull();
  expect(store().justUpdated).toEqual({ vscode: true, obsidian: true, sharex: true });
  expect(useUiStore.getState().toast?.message).toBe("All updates installed");
  const library = await services.install.getLibrary();
  expect(library.installed.find((i) => i.appId === "vscode")?.version).toBe("1.93.0");

  unmount();
  services.dispose();
});

it("does not toast for a single update outside a batch", async () => {
  const { services, unmount } = renderWithServices(() => useDownloadsBridge());
  await flush();
  await act(() => store().enqueue([update("vlc", "3.0.21", 40)]));
  await flush(INSTALL_MS);
  expect(store().justUpdated).toEqual({ vlc: true });
  expect(useUiStore.getState().toast).toBeNull();
  unmount();
  services.dispose();
});

it("picks up downloads started elsewhere through a snapshot", async () => {
  const { services, unmount } = renderWithServices(() => useDownloadsBridge());
  await flush();
  await act(() =>
    services.downloads.enqueue([{ appId: "files", version: "3.9.4", sizeMb: 88, kind: "install" }]),
  );
  await flush();
  expect(store().items.files).toMatchObject({ kind: "install", sizeMb: 88 });
  unmount();
  services.dispose();
});

it("keeps the service's concurrency and online state in sync", async () => {
  const { services, rerender, unmount } = renderWithServices(() => useDownloadsBridge());
  const setConcurrency = vi.spyOn(services.downloads, "setConcurrency");
  const setOnline = vi.spyOn(services.downloads, "setOnline");
  await flush();

  act(() => {
    useSettingsStore.setState((s) => ({
      hydrated: true,
      settings: { ...s.settings, parallel: 4 },
    }));
  });
  rerender();
  await flush();
  expect(setConcurrency).toHaveBeenLastCalledWith(4);

  act(() => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, simulateOffline: true } }));
  });
  await flush();
  expect(setOnline).toHaveBeenLastCalledWith(false);

  act(() => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, simulateOffline: false } }));
  });
  await flush();
  expect(setOnline).toHaveBeenLastCalledWith(true);
  unmount();
  services.dispose();
});

it("does not push the default concurrency before settings are loaded", async () => {
  const { services, unmount } = renderWithServices(() => useDownloadsBridge());
  const setConcurrency = vi.spyOn(services.downloads, "setConcurrency");
  await flush();
  expect(setConcurrency).not.toHaveBeenCalled();
  unmount();
  services.dispose();
});
