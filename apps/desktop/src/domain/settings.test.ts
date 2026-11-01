import type { Settings } from "@/services/types";
import {
  DEFAULT_SETTINGS,
  isRowSection,
  SETTINGS_ROWS,
  SETTINGS_SECTIONS,
  visibleSettingsRows,
  visibleSettingsSections,
} from "./settings";

describe("settings schema", () => {
  it("lists the ten sections in the prototype order", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual([
      "general",
      "updates",
      "downloads",
      "apps",
      "sources",
      "notifications",
      "privacy",
      "account",
      "advanced",
      "about",
    ]);
    expect(SETTINGS_SECTIONS.find((s) => s.id === "advanced")?.icon).toBe("sliders-horizontal");
  });

  it("has the row ids of every row-card section", () => {
    const rowIds = Object.fromEntries(
      Object.entries(SETTINGS_ROWS).map(([section, rows]) => [section, rows.map((r) => r.id)]),
    );
    expect(rowIds).toEqual({
      general: ["theme", "language", "startup", "tray", "recommend", "animations"],
      updates: ["auto", "schedule", "metered", "notifyReady"],
      downloads: ["location", "parallel", "keep"],
      apps: ["perUser", "shortcuts", "openAfter"],
      notifications: ["nUpdates", "nNew", "nSound"],
      privacy: ["telemetryNote", "crash", "history"],
      account: ["profileLink", "subLink", "signOut"],
      advanced: [
        "dev",
        "proxy",
        "portable",
        "viewAsDeveloper",
        "simulateOffline",
        "replayFirstLaunch",
        "gallery",
      ],
    });
    expect(SETTINGS_SECTIONS.filter((s) => isRowSection(s.id)).map((s) => s.id)).toEqual(
      Object.keys(SETTINGS_ROWS),
    );
  });

  it("binds every editable row to a setting with a default", () => {
    const rows = Object.values(SETTINGS_ROWS).flat();
    for (const row of rows) {
      if (["theme", "language", "toggle", "select", "path"].includes(row.type)) {
        expect(row.setting, row.id).toBeDefined();
        expect(DEFAULT_SETTINGS[row.setting as keyof Settings], row.id).toBeDefined();
      }
      if (row.type === "select") expect(row.options?.length, row.id).toBeGreaterThan(0);
      if (row.type === "action") expect(row.action, row.id).toBeDefined();
      if (row.type === "link") expect(row.link, row.id).toBeDefined();
    }
    const parallel = rows.find((r) => r.id === "parallel");
    expect(parallel?.options).toContain(String(DEFAULT_SETTINGS.parallel));
  });

  it("mirrors the Rust defaults", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      theme: "dark",
      locale: "en",
      schedule: "hourly",
      parallel: 2,
      location: "C:\\Program Files\\Paparats",
      animations: true,
      shortcuts: false,
      dev: false,
      viewAsDeveloper: false,
      simulateOffline: false,
    });
  });

  it("shows developer tools and not-yet-working rows only in Developer mode", () => {
    expect(visibleSettingsRows("advanced", { dev: false }).map((r) => r.id)).toEqual(["dev"]);
    expect(visibleSettingsRows("advanced", { dev: true })).toHaveLength(7);
    expect(visibleSettingsRows("general", { dev: false }).map((r) => r.id)).toEqual([
      "theme",
      "language",
      "startup",
      "tray",
      "animations",
    ]);
    expect(visibleSettingsRows("general", { dev: true })).toHaveLength(6);
    expect(visibleSettingsRows("updates", { dev: false }).map((r) => r.id)).toEqual(["schedule"]);
    expect(visibleSettingsRows("apps", { dev: false })).toEqual([]);
  });

  it("lists the sections the features and Developer mode leave", () => {
    const ids = (dev: boolean, account: boolean, channels: boolean) =>
      visibleSettingsSections({ dev }, { account, channels }).map((s) => s.id);
    expect(ids(true, true, true)).toHaveLength(10);
    expect(ids(false, true, true)).toEqual([
      "general",
      "updates",
      "downloads",
      "sources",
      "privacy",
      "account",
      "advanced",
      "about",
    ]);
    // The real catalog: no accounts, no channels.
    expect(ids(false, false, false)).toEqual([
      "general",
      "updates",
      "downloads",
      "privacy",
      "advanced",
      "about",
    ]);
  });
});
