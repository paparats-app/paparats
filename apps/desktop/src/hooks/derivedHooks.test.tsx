// Derived hooks over the mock services (fixtures world, today = 2026-09-15).
import { act } from "@testing-library/react";
import type { SystemService } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { appById } from "@/domain/testFixtures";
import { createTestServices, flush, renderWithServices, resetStores } from "./testing";
import { useAppIndex } from "./useAppIndex";
import { useChannelContext } from "./useChannelContext";
import { useInstallState } from "./useInstallState";
import { useOffline } from "./useOffline";
import { usePro } from "./usePro";
import { useToday } from "./useToday";
import { useUpdates } from "./useUpdates";
import { useViewAs } from "./useViewAs";
import { useVisibleApps } from "./useVisibleApps";

beforeEach(() => {
  vi.useFakeTimers();
  resetStores();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const setSettings = (patch: Partial<ReturnType<typeof useSettingsStore.getState>["settings"]>) =>
  act(() => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, ...patch } }));
  });

it("useToday reads SystemService", () => {
  expect(renderWithServices(() => useToday()).result.current).toBe("2026-09-15");
});

describe("useChannelContext", () => {
  it("is empty until channels and subscriptions load", async () => {
    const { result } = renderWithServices(() => useChannelContext());
    expect(result.current).toMatchObject({ ready: false, channels: [], subscriptions: [] });
    expect(result.current.sourceOf(appById("shell"))).toBe("nilesoft");
    await flush();
    expect(result.current.ready).toBe(true);
  });

  it("binds the source rule, outages and the stale rule", async () => {
    const { result } = renderWithServices(() => useChannelContext());
    await flush();
    const ctx = result.current;
    expect(ctx.sourceOf(appById("shell"))).toBe("nilesoft");
    expect(ctx.sourceOf(appById("czkawka"))).toBe("fossfriends");
    expect(ctx.alternativesOf(appById("winaerotweaker"))).toEqual([]);
    expect(ctx.isActive("nilesoft")).toBe(true);
    expect(ctx.isFollowed("winaero")).toBe(false);
    expect(ctx.downDays("fossfriends")).toBe(16);
    expect(ctx.isStale("fossfriends")).toBe(true);
    expect(ctx.isStale("nilesoft")).toBe(false);
    expect(ctx.byId.mpvbuilds?.trust).toBe("community");
  });
});

it("useVisibleApps hides apps of channels the user does not follow", async () => {
  const { result } = renderWithServices(() => useVisibleApps());
  expect(result.current).toEqual([]);
  await flush();
  const ids = result.current.map((a) => a.id);
  expect(ids).toHaveLength(30);
  expect(ids).toContain("shell");
  expect(ids).not.toContain("mpv");
  expect(ids).not.toContain("slounik");
});

it("useAppIndex looks up the whole catalog", async () => {
  const { result } = renderWithServices(() => useAppIndex());
  await flush();
  expect(result.current.get("mpv")?.name).toBe("mpv");
  expect(result.current.byId.obsidian?.name).toBe("Obsidian");
  expect(result.current.get(null)).toBeUndefined();
  expect(result.current.get("constructor")).toBeUndefined();
});

describe("useInstallState", () => {
  it("combines the inventory and the download queue", async () => {
    const { result } = renderWithServices(() => ({
      vscode: useInstallState("vscode"),
      flow: useInstallState("flow"),
      files: useInstallState("files"),
    }));
    await flush();
    expect(result.current.vscode).toEqual({
      state: "update",
      progress: 0,
      installedVersion: "1.92.2",
    });
    expect(result.current.flow.state).toBe("installed");
    expect(result.current.files).toEqual({ state: "none", progress: 0, installedVersion: null });

    act(() => {
      useDownloadsStore.getState().applySnapshot({
        items: [
          {
            appId: "vscode",
            version: "1.93.0",
            kind: "update",
            state: "paused",
            progress: 43.2,
            sizeMb: 87,
          },
        ],
        concurrency: 2,
        online: true,
      });
    });
    expect(result.current.vscode).toEqual({
      state: "paused",
      progress: 43.2,
      installedVersion: "1.92.2",
    });
  });
});

it("useUpdates lists pending updates with their total download size", async () => {
  const { result } = renderWithServices(() => useUpdates());
  expect(result.current.count).toBe(0);
  await flush();
  expect(result.current.apps.map((a) => a.id)).toEqual([
    "obsidian",
    "sharex",
    "vlc",
    "notepadpp",
    "vscode",
    "shell",
  ]);
  expect(result.current.count).toBe(6);
  expect(result.current.totalMb).toBe(155);
});

describe("usePro", () => {
  it("is free on the fixture account", async () => {
    const { result } = renderWithServices(() => usePro());
    await flush();
    expect(result.current).toEqual({
      isPro: false,
      isGift: false,
      planId: "free",
      renewsOn: null,
      giftUntil: null,
    });
  });

  it("reflects a paid plan", async () => {
    const services = createTestServices();
    await services.account.purchase("yearly");
    const { result } = renderWithServices(() => usePro(), services);
    await flush();
    expect(result.current).toMatchObject({
      isPro: true,
      isGift: false,
      planId: "yearly",
      renewsOn: "2027-09-15",
    });
  });

  it("counts the idea gift only while it runs", async () => {
    const services = createTestServices();
    await services.account.claimIdeaBonus();
    const { result } = renderWithServices(() => usePro(), services);
    await flush();
    expect(result.current).toMatchObject({ isPro: true, isGift: true, giftUntil: "2026-12-15" });

    const later = createTestServices({ today: "2027-01-01" });
    await later.account.claimIdeaBonus();
    const expired = renderWithServices(() => usePro(), later);
    await flush();
    expect(expired.result.current).toMatchObject({ isPro: false, isGift: false });
  });
});

describe("useOffline", () => {
  it("follows the Simulate offline setting", () => {
    const { result } = renderWithServices(() => useOffline());
    expect(result.current).toBe(false);
    setSettings({ simulateOffline: true });
    expect(result.current).toBe(true);
  });

  it("follows real connectivity", () => {
    const base = createTestServices();
    let online = true;
    let notify: (online: boolean) => void = () => undefined;
    const system: SystemService = {
      ...base.system,
      isOnline: () => online,
      onConnectivityChange: (listener) => {
        notify = listener;
        return () => undefined;
      },
    };
    const { result } = renderWithServices(() => useOffline(), { ...base, system });
    expect(result.current).toBe(false);
    act(() => {
      online = false;
      notify(false);
    });
    expect(result.current).toBe(true);
  });
});

it("useViewAs needs Developer mode and the toggle", () => {
  const { result } = renderWithServices(() => useViewAs());
  expect(result.current).toBe("user");
  setSettings({ viewAsDeveloper: true });
  expect(result.current).toBe("user");
  setSettings({ dev: true });
  expect(result.current).toBe("developer");
});
