import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestServices, resetStores } from "@/hooks/testing";
import { setServices, type MockServices } from "@/services";
import {
  FIRST_RUN_KEY,
  hasSeenFirstLaunch,
  sceneMotionAllowed,
  useFirstLaunchStore,
} from "./useFirstLaunchStore";
import { useHomeStore } from "./useHomeStore";
import { useSettingsStore } from "./useSettingsStore";

const store = () => useFirstLaunchStore.getState();
let services: MockServices;

beforeEach(async () => {
  localStorage.clear();
  services = createTestServices();
  setServices(services);
  await useSettingsStore.getState().hydrate();
});

afterEach(() => {
  services.dispose();
  localStorage.clear();
  resetStores();
  vi.useRealTimers();
});

describe("useFirstLaunchStore", () => {
  it("starts with no scene", () => {
    expect(store().phase).toBeNull();
    expect(store().run).toBe(0);
    expect(store().replayRequested).toBe(0);
  });

  it("launch() plays the scene on a first run", () => {
    store().launch();
    expect(store().phase).toBe("seed");
    expect(store().run).toBe(1);
    expect(store().motion).toBe(true);
  });

  it("launch() skips the scene once the record says it was seen", () => {
    localStorage.setItem(
      FIRST_RUN_KEY,
      JSON.stringify({ seen: true, locale: "ru", theme: "light", at: "2026-09-15T10:00:00Z" }),
    );
    expect(hasSeenFirstLaunch()).toBe(true);
    store().launch();
    expect(store().phase).toBeNull();
  });

  it("an unreadable or unfinished record plays the scene", () => {
    localStorage.setItem(FIRST_RUN_KEY, "{not json");
    expect(hasSeenFirstLaunch()).toBe(false);
    localStorage.setItem(FIRST_RUN_KEY, JSON.stringify({ seen: false }));
    expect(hasSeenFirstLaunch()).toBe(false);
    store().launch();
    expect(store().phase).toBe("seed");
  });

  it("without motion (Subtle animations off) it starts at the language step", async () => {
    await useSettingsStore.getState().update({ animations: false });
    expect(sceneMotionAllowed()).toBe(false);
    store().start();
    expect(store().phase).toBe("lang");
    expect(store().motion).toBe(false);
  });

  it("advance() only moves forward, only in its run and never past lang", () => {
    store().start();
    const { run } = store();
    store().advance(run + 1, "part");
    expect(store().phase).toBe("seed");
    store().advance(run, "part");
    expect(store().phase).toBe("part");
    store().advance(run, "fern");
    expect(store().phase).toBe("part");
    store().advance(run, "theme");
    expect(store().phase).toBe("part");
    store().advance(run, "lang");
    expect(store().phase).toBe("lang");
    store().next();
    store().advance(run, "lang");
    expect(store().phase).toBe("theme");
  });

  it("skip() jumps to lang during phases 0–4 and does nothing after", () => {
    store().start();
    store().advance(store().run, "bloom");
    store().skip();
    expect(store().phase).toBe("lang");
    store().next();
    store().skip();
    expect(store().phase).toBe("theme");
  });

  it("next() / back() walk lang → theme → signin and back", () => {
    store().start();
    store().next();
    expect(store().phase).toBe("seed");
    store().skip();
    store().back();
    expect(store().phase).toBe("lang");
    store().next();
    store().next();
    expect(store().phase).toBe("signin");
    store().next();
    expect(store().phase).toBe("signin");
    store().back();
    store().back();
    expect(store().phase).toBe("lang");
  });

  it("finish() writes the record, switches to done and lights the Home hero", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    await useSettingsStore.getState().update({ locale: "be", theme: "light" });
    store().start();
    expect(store().finish()).toBe(false);
    store().skip();
    expect(store().finish()).toBe(true);
    expect(store().phase).toBe("done");
    expect(useHomeStore.getState().heroGlow).toBe(true);
    expect(JSON.parse(localStorage.getItem(FIRST_RUN_KEY) ?? "null")).toEqual({
      seen: true,
      locale: "be",
      theme: "light",
      at: "2026-09-15T12:00:00.000Z",
    });
    expect(hasSeenFirstLaunch()).toBe(true);
  });

  it("close() ends the exit of its own run only", () => {
    store().start();
    store().skip();
    store().finish();
    const { run } = store();
    store().close(run - 1);
    expect(store().phase).toBe("done");
    store().close(run);
    expect(store().phase).toBeNull();
  });

  it("replay() counts the request and plays again from the start, hero glow off", () => {
    store().start();
    store().skip();
    store().finish();
    expect(useHomeStore.getState().heroGlow).toBe(true);
    store().replay();
    expect(store().replayRequested).toBe(1);
    expect(store().phase).toBe("seed");
    expect(store().run).toBe(2);
    expect(useHomeStore.getState().heroGlow).toBe(false);
  });

  it("still works when storage throws", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      expect(hasSeenFirstLaunch()).toBe(false);
      store().launch();
      store().skip();
      expect(store().finish()).toBe(true);
      expect(store().phase).toBe("done");
    } finally {
      setItem.mockRestore();
      getItem.mockRestore();
    }
  });
  it("openSignIn() shows the Account step alone and finishes without a record or hero glow", () => {
    store().openSignIn();
    expect(store()).toMatchObject({ phase: "signin", mode: "signIn", motion: false, run: 1 });
    // No Back to the other steps, and no second run while one shows.
    store().back();
    expect(store().phase).toBe("signin");
    store().openSignIn();
    expect(store().run).toBe(1);

    expect(store().finish()).toBe(true);
    expect(store().phase).toBe("done");
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBeNull();
    expect(useHomeStore.getState().heroGlow).toBe(false);
    store().close(1);
    expect(store().phase).toBeNull();

    // A replay afterwards is the whole first launch again.
    store().replay();
    expect(store()).toMatchObject({ phase: "seed", mode: "intro" });
  });
});
