// The card/button action (prototype `card()`), driven against the mock services and the real
// download queue: +10 % per 110 ms tick, 8 ticks installing.
import { act } from "@testing-library/react";
import { appById } from "@/domain/testFixtures";
import type { MockServices } from "@/services";
import { useDialogStore } from "@/stores/useDialogStore";
import { useDownloadsBridge } from "@/stores/useDownloadsBridge";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, flush, renderWithServices, resetStores } from "./testing";
import { useAppAction } from "./useAppAction";

const TICK = 110;

let services: MockServices;

beforeEach(() => {
  vi.useFakeTimers();
  resetStores();
  services = createTestServices();
});
afterEach(() => {
  services.dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function renderAction(appId: string) {
  const rendered = renderWithServices(() => {
    useDownloadsBridge();
    return useAppAction(appById(appId));
  }, services);
  await flush();
  return rendered;
}

const toast = () => useUiStore.getState().toast?.message;

it("installs a new app: Get → NN% · Pause → Resume → Installing… → Open", async () => {
  const { result } = await renderAction("files");
  expect(result.current).toMatchObject({
    label: "Get",
    tone: "neutral",
    disabled: false,
    state: "none",
  });

  act(() => result.current.run());
  await flush(4 * TICK);
  expect(result.current).toMatchObject({
    label: "40% · Pause",
    tone: "progress",
    state: "downloading",
  });

  act(() => result.current.run());
  await flush();
  expect(result.current).toMatchObject({ label: "Resume", tone: "progress", state: "paused" });
  await flush(5 * TICK);
  expect(result.current.progress).toBeCloseTo(40);

  act(() => result.current.run());
  await flush(6 * TICK);
  expect(result.current).toMatchObject({
    label: "Installing…",
    disabled: true,
    state: "installing",
  });

  await flush(8 * TICK);
  expect(result.current).toMatchObject({ label: "Open", tone: "neutral", state: "installed" });
});

it("never flashes Update/Get between the install landing and the library refresh", async () => {
  const labels: string[] = [];
  const { result } = renderWithServices(() => {
    useDownloadsBridge();
    const action = useAppAction(appById("vscode"));
    labels.push(action.label);
    return action;
  }, services);
  await flush();
  expect(result.current.label).toBe("Update");
  act(() => result.current.run());
  const started = labels.length;
  await flush(18 * TICK);
  expect(result.current).toMatchObject({ label: "Open", state: "installed" });
  const after = labels.slice(started);
  expect(after).not.toContain("Update");
  expect(after).not.toContain("Get");
  expect(useDownloadsStore.getState().justUpdated).toEqual({ vscode: true });
});

it("waits in the queue while the parallel slots are busy", async () => {
  const { result } = await renderAction("files");
  await act(() =>
    useDownloadsStore.getState().enqueue([
      { appId: "krita", version: "5.2.9", kind: "install", sizeMb: 143 },
      { appId: "obs", version: "31.1.2", kind: "install", sizeMb: 135 },
    ]),
  );
  act(() => result.current.run());
  await flush();
  expect(result.current).toMatchObject({
    label: "Queued",
    tone: "quiet",
    disabled: true,
    state: "queued",
  });

  act(() => result.current.cancel());
  await flush();
  expect(result.current).toMatchObject({ label: "Get", state: "none" });
});

it("updates with the manifest's download size", async () => {
  const enqueue = vi.spyOn(services.downloads, "enqueue");
  const { result } = await renderAction("obsidian");
  expect(result.current).toMatchObject({ label: "Update", tone: "primary", state: "update" });
  act(() => result.current.run());
  await flush();
  expect(enqueue).toHaveBeenCalledWith([
    { appId: "obsidian", version: "1.8.10", kind: "update", sizeMb: 12 },
  ]);
  expect(result.current.state).toBe("downloading");
});

it("opens an installed app with a toast", async () => {
  const open = vi.spyOn(services.install, "open");
  const { result } = await renderAction("flow");
  expect(result.current).toMatchObject({ label: "Open", state: "installed" });
  act(() => result.current.run());
  expect(toast()).toBe("Opening Flow Launcher…");
  expect(open).toHaveBeenCalledWith("flow");
});

it("asks to trust a community channel before subscribing", async () => {
  const { result } = await renderAction("mpv");
  expect(result.current).toMatchObject({ label: "Subscribe", tone: "neutral", state: "none" });
  act(() => result.current.run());
  expect(useDialogStore.getState().dialog).toEqual({
    kind: "trustConfirm",
    channelId: "mpvbuilds",
  });
});

it("subscribes to a verified channel directly, then offers Get", async () => {
  await services.channels.unsubscribe("fossfriends");
  const { result } = await renderAction("imageglass");
  expect(result.current.label).toBe("Subscribe");
  act(() => result.current.run());
  await flush();
  expect(toast()).toBe("Subscribed to FOSS Friends");
  expect(result.current.label).toBe("Get");
  expect((await services.channels.getSubscriptions()).map((s) => s.channelId)).toContain(
    "fossfriends",
  );
});

it("goes inert while offline, except for installed apps", async () => {
  act(() => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, simulateOffline: true } }));
  });
  const enqueue = vi.spyOn(services.downloads, "enqueue");
  const files = await renderAction("files");
  expect(files.result.current).toMatchObject({ label: "Offline", tone: "muted", disabled: false });
  act(() => files.result.current.run());
  expect(toast()).toBe("You’re offline");
  expect(enqueue).not.toHaveBeenCalled();

  const vscode = await renderAction("vscode");
  expect(vscode.result.current).toMatchObject({ label: "Offline", tone: "muted", state: "update" });

  const flow = await renderAction("flow");
  expect(flow.result.current.label).toBe("Open");

  const mpv = await renderAction("mpv");
  expect(mpv.result.current).toMatchObject({ label: "Subscribe", tone: "muted" });
});

it("formats the progress percentage for the UI language", async () => {
  const { i18n } = await import("@/i18n");
  const { result } = await renderAction("files");
  act(() => result.current.run());
  await flush(5 * TICK);
  await act(() => i18n.changeLanguage("ru"));
  expect(result.current.label).toBe("50 % · Пауза");
  await act(() => i18n.changeLanguage("en"));
});
