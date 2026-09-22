import { DEFAULT_SETTINGS } from "@/domain/settings";
import { createTestServices } from "@/hooks/testing";
import { ServiceError, setServices, type SettingsService } from "@/services";
import type { Settings } from "@/services/types";
import { useSettingsStore } from "./useSettingsStore";

const store = () => useSettingsStore.getState();

/** A settings service whose calls resolve/reject only when the test says so. */
function controllableSettings() {
  const pending: {
    patch: Partial<Settings>;
    resolve: (s: Settings) => void;
    reject: (e: unknown) => void;
  }[] = [];
  let stored: Settings = { ...DEFAULT_SETTINGS };
  const service: SettingsService = {
    getSettings: () => Promise.resolve(stored),
    updateSettings: (patch) =>
      new Promise<Settings>((resolve, reject) => {
        pending.push({
          patch,
          resolve: (s) => {
            stored = s;
            resolve(s);
          },
          reject,
        });
      }),
    clearSearchHistory: () => Promise.resolve(),
  };
  return { service, pending, stored: () => stored };
}

function useSettingsService(settings: SettingsService) {
  setServices({ ...createTestServices(), settings });
}

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

it("starts with the defaults, not hydrated", () => {
  expect(store().settings).toEqual(DEFAULT_SETTINGS);
  expect(store().hydrated).toBe(false);
});

it("hydrates from the settings service", async () => {
  const services = createTestServices();
  await services.settings.updateSettings({ theme: "light", parallel: 4 });
  setServices(services);
  await store().hydrate();
  expect(store().hydrated).toBe(true);
  expect(store().settings).toMatchObject({ theme: "light", parallel: 4, locale: "en" });
});

it("keeps the defaults when loading fails", async () => {
  useSettingsService({
    ...controllableSettings().service,
    getSettings: () => Promise.reject(new ServiceError("internal", "disk")),
  });
  await store().hydrate();
  expect(store()).toMatchObject({ hydrated: true, settings: DEFAULT_SETTINGS });
});

it("applies an update at once and persists it", async () => {
  const c = controllableSettings();
  useSettingsService(c.service);
  const done = store().update({ animations: false });
  expect(store().settings.animations).toBe(false);
  expect(c.pending).toHaveLength(1);
  c.pending[0]?.resolve({ ...c.stored(), animations: false });
  await expect(done).resolves.toBe(true);
  expect(store().settings.animations).toBe(false);
});

it("rolls back the patched keys when persisting fails", async () => {
  const c = controllableSettings();
  useSettingsService(c.service);
  const done = store().update({ theme: "light", animations: false });
  expect(store().settings.theme).toBe("light");
  c.pending[0]?.reject(new ServiceError("internal", "disk full"));
  await expect(done).resolves.toBe(false);
  expect(store().settings).toEqual(DEFAULT_SETTINGS);
});

it("does not undo a newer change when an older update fails", async () => {
  const c = controllableSettings();
  useSettingsService(c.service);
  const first = store().update({ parallel: 4 });
  const second = store().update({ parallel: 1, tray: false });
  c.pending[0]?.reject(new ServiceError("internal", "boom"));
  await first;
  expect(store().settings).toMatchObject({ parallel: 1, tray: false });
  c.pending[1]?.resolve({ ...DEFAULT_SETTINGS, parallel: 1, tray: false });
  await second;
  expect(store().settings).toMatchObject({ parallel: 1, tray: false });
});

it("ignores an older response that arrives after a newer update", async () => {
  const c = controllableSettings();
  useSettingsService(c.service);
  const first = store().update({ theme: "light" });
  const second = store().update({ theme: "system" });
  c.pending[0]?.resolve({ ...DEFAULT_SETTINGS, theme: "light" });
  await first;
  expect(store().settings.theme).toBe("system");
  c.pending[1]?.resolve({ ...DEFAULT_SETTINGS, theme: "system" });
  await second;
  expect(store().settings.theme).toBe("system");
});

it("works end to end with the mock settings service", async () => {
  const services = createTestServices();
  setServices(services);
  await store().update({ simulateOffline: true });
  expect(await services.settings.getSettings()).toMatchObject({ simulateOffline: true });
});
