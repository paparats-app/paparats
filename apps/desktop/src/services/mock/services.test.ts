import { createMockServices } from "./index";
import type { MockServices } from "./index";
import { createMemoryStorage } from "./runtime";
import { SELF_UPDATE_CHECK_MS, externalUrl } from "../common";

let services: MockServices;

beforeEach(() => {
  services = createMockServices({ latencyMs: 0, storage: createMemoryStorage() });
});

afterEach(() => {
  services.dispose();
  vi.useRealTimers();
});

describe("mock catalog and world", () => {
  it("serves the fixtures", async () => {
    const catalog = await services.catalog.getCatalog();
    expect(catalog.apps).toHaveLength(32);
    expect(catalog.apps[0]?.id).toBe("obsidian");
    const platform = await services.catalog.getPlatform();
    expect(platform.plans.map((p) => p.id)).toEqual(["free", "monthly", "yearly"]);
  });

  it("returns copies: callers cannot mutate the world", async () => {
    const library = await services.install.getLibrary();
    library.favorites.push("hacked");
    expect((await services.install.getLibrary()).favorites).not.toContain("hacked");
  });

  it("isolates worlds between instances", async () => {
    const other = createMockServices({ latencyMs: 0, storage: createMemoryStorage() });
    await services.install.setFavorite("krita", true);
    expect((await other.install.getLibrary()).favorites).not.toContain("krita");
  });

  it("answers after the simulated latency", async () => {
    vi.useFakeTimers();
    const slow = createMockServices({ latencyMs: 40, storage: createMemoryStorage() });
    const done = vi.fn();
    void slow.catalog.getPlatform().then(done);
    await vi.advanceTimersByTimeAsync(39);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });
});

describe("mock install", () => {
  it("setFavorite is idempotent both ways", async () => {
    const { install } = services;
    await install.setFavorite("krita", true);
    const twice = await install.setFavorite("krita", true);
    expect(twice.favorites.filter((id) => id === "krita")).toHaveLength(1);
    const removed = await install.setFavorite("obsidian", false);
    expect(removed.favorites).toEqual(["everything", "vlc", "krita"]);
    expect((await install.setFavorite("obsidian", false)).favorites).not.toContain("obsidian");
  });

  it("uninstall removes the app from the inventory and keeps favorites", async () => {
    const library = await services.install.uninstall("vlc");
    expect(library.installed.some((a) => a.appId === "vlc")).toBe(false);
    expect(library.favorites).toContain("vlc");
  });

  it("open and openInstallFolder resolve", async () => {
    await expect(services.install.open("vlc")).resolves.toBeUndefined();
    await expect(services.install.openInstallFolder("vlc")).resolves.toBeUndefined();
  });
});

describe("mock system", () => {
  it("today is the fixture date unless overridden", () => {
    expect(services.system.today()).toBe("2026-09-15");
    const other = createMockServices({ today: "2027-01-02", storage: createMemoryStorage() });
    expect(other.system.today()).toBe("2027-01-02");
  });

  it("checkForAppUpdate answers upToDate after 1200 ms", async () => {
    vi.useFakeTimers();
    const result = vi.fn();
    void services.system.checkForAppUpdate().then(result);
    await vi.advanceTimersByTimeAsync(SELF_UPDATE_CHECK_MS - 1);
    expect(result).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toHaveBeenCalledWith({ kind: "upToDate" });
  });

  it("follows browser connectivity events", () => {
    expect(services.system.isOnline()).toBe(navigator.onLine);
    const listener = vi.fn();
    const unsubscribe = services.system.onConnectivityChange(listener);
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    unsubscribe();
    window.dispatchEvent(new Event("offline"));
    expect(listener.mock.calls).toEqual([[false], [true]]);
  });

  it("copies through navigator.clipboard when it exists", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      await services.system.copyToClipboard("nilesoft.org/paparats");
      expect(writeText).toHaveBeenCalledWith("nilesoft.org/paparats");
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("openExternal accepts https / mailto and bare addresses only", async () => {
    await expect(services.system.openExternal("nilesoft.org/support")).resolves.toBeUndefined();
    await expect(services.system.openExternal("file:///C:/Windows")).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(externalUrl("nilesoft.org/support")).toBe("https://nilesoft.org/support");
    expect(externalUrl("mailto:help@paparats.app")).toBe("mailto:help@paparats.app");
    expect(() => externalUrl("http://example.org")).toThrow();
    expect(() => externalUrl("javascript:alert(1)")).toThrow();
  });

  it("setAutostart resolves", async () => {
    await expect(services.system.setAutostart(true)).resolves.toBeUndefined();
  });
});
