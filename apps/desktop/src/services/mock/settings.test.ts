import { DEFAULT_SETTINGS } from "@/domain/settings";
import { createMockContext, createMemoryStorage } from "./runtime";
import { SETTINGS_STORAGE_KEY, createMockSettingsService } from "./settings";

const service = (storage: Storage | undefined) =>
  createMockSettingsService(createMockContext({ latencyMs: 0, storage }));

describe("mock settings", () => {
  it("returns the defaults when nothing is stored", async () => {
    expect(await service(createMemoryStorage()).getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("persists updates as JSON and reads them back in a new instance", async () => {
    const storage = createMemoryStorage();
    const next = await service(storage).updateSettings({ theme: "light", parallel: 4 });
    expect(next).toEqual({ ...DEFAULT_SETTINGS, theme: "light", parallel: 4 });
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? "null")).toEqual(next);

    const again = await service(storage).getSettings();
    expect(again).toMatchObject({ theme: "light", parallel: 4, locale: "en" });
  });

  it("merges patches over what is stored", async () => {
    const storage = createMemoryStorage();
    const settings = service(storage);
    await settings.updateSettings({ dev: true });
    expect(await settings.updateSettings({ locale: "be" })).toMatchObject({
      dev: true,
      locale: "be",
    });
  });

  it("ignores corrupt JSON, unknown keys and values of the wrong type", async () => {
    const storage = createMemoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(await service(storage).getSettings()).toEqual(DEFAULT_SETTINGS);

    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ parallel: "4", tray: false, extra: 1, locale: "ru" }),
    );
    const read = await service(storage).getSettings();
    expect(read).toEqual({ ...DEFAULT_SETTINGS, tray: false, locale: "ru" });
    expect(read).not.toHaveProperty("extra");
  });

  it("keeps settings in memory when there is no storage", async () => {
    const settings = createMockSettingsService({
      ...createMockContext({ latencyMs: 0 }),
      storage: null,
    });
    await settings.updateSettings({ nSound: true });
    expect((await settings.getSettings()).nSound).toBe(true);
    await expect(settings.clearSearchHistory()).resolves.toBeUndefined();
  });

  it("reports a storage failure as an internal error", async () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    await expect(service(storage).updateSettings({ dev: true })).rejects.toMatchObject({
      kind: "internal",
    });
  });
});
