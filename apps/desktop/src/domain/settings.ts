// Settings schema: defaults (mirror `paparats_core::Settings::default`), the section list and the
// rows of each row-card section. Copy lives in i18n: `settings.rows.<id>.title/.hint/.action`
// and `settings.options.<id>.<option>`.
import type { Settings } from "@/services/types";

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: "dark",
  locale: "en",
  startup: true,
  tray: true,
  recommend: true,
  animations: true,
  auto: true,
  schedule: "hourly",
  metered: false,
  notifyReady: true,
  location: "C:\\Program Files\\Paparats",
  parallel: 2,
  keep: false,
  perUser: true,
  shortcuts: false,
  openAfter: true,
  nUpdates: true,
  nNew: false,
  nSound: false,
  crash: false,
  dev: false,
  portable: false,
  viewAsDeveloper: false,
  simulateOffline: false,
};

export type SettingsSectionId =
  | "general"
  | "updates"
  | "downloads"
  | "apps"
  | "sources"
  | "notifications"
  | "privacy"
  | "account"
  | "advanced"
  | "about";

/** Sections rendered as a row card (Sources and About have their own panels). */
export type SettingsRowSectionId = Exclude<SettingsSectionId, "sources" | "about">;

export interface SettingsSection {
  id: SettingsSectionId;
  /** Lucide icon name (kebab-case). */
  icon: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: "general", icon: "settings" },
  { id: "updates", icon: "download" },
  { id: "downloads", icon: "folder" },
  { id: "apps", icon: "layout-grid" },
  { id: "sources", icon: "rss" },
  { id: "notifications", icon: "bell" },
  { id: "privacy", icon: "shield" },
  { id: "account", icon: "user" },
  { id: "advanced", icon: "sliders-horizontal" },
  { id: "about", icon: "info" },
];

export type SettingsRowType =
  "theme" | "language" | "toggle" | "select" | "path" | "action" | "link" | "note";

export type SettingsAction =
  "clearHistory" | "signOut" | "configureProxy" | "changeLocation" | "replayFirstLaunch";

/** Screens a link row opens; `dev` is the component gallery (developer mode only). */
export type SettingsLink = "profile" | "subscription" | "dev";

export interface SettingsRow {
  id: string;
  type: SettingsRowType;
  /** The setting a theme/language/toggle/select/path row edits. */
  setting?: keyof Settings;
  /** Select options as strings (`parallel` stores the number); labels: `settings.options.<id>.<option>`. */
  options?: string[];
  action?: SettingsAction;
  link?: SettingsLink;
  /** Shown only while Developer mode is on. */
  devOnly?: boolean;
  /**
   * Stored but nothing acts on it yet (D64): hidden unless Developer mode shows the design's
   * full set of rows (D68).
   */
  stub?: boolean;
}

export const SETTINGS_ROWS: Readonly<Record<SettingsRowSectionId, readonly SettingsRow[]>> = {
  general: [
    { id: "theme", type: "theme", setting: "theme", options: ["light", "dark", "system"] },
    { id: "language", type: "language", setting: "locale", options: ["en", "be", "ru"] },
    { id: "startup", type: "toggle", setting: "startup" },
    { id: "tray", type: "toggle", setting: "tray" },
    { id: "recommend", type: "toggle", setting: "recommend", stub: true },
    { id: "animations", type: "toggle", setting: "animations" },
  ],
  updates: [
    { id: "auto", type: "toggle", setting: "auto", stub: true },
    { id: "schedule", type: "select", setting: "schedule", options: ["hourly", "daily", "weekly"] },
    { id: "metered", type: "toggle", setting: "metered", stub: true },
    { id: "notifyReady", type: "toggle", setting: "notifyReady", stub: true },
  ],
  downloads: [
    { id: "location", type: "path", setting: "location", action: "changeLocation", stub: true },
    { id: "parallel", type: "select", setting: "parallel", options: ["1", "2", "4"] },
    { id: "keep", type: "toggle", setting: "keep", stub: true },
  ],
  apps: [
    { id: "perUser", type: "toggle", setting: "perUser", stub: true },
    { id: "shortcuts", type: "toggle", setting: "shortcuts", stub: true },
    { id: "openAfter", type: "toggle", setting: "openAfter", stub: true },
  ],
  notifications: [
    { id: "nUpdates", type: "toggle", setting: "nUpdates", stub: true },
    { id: "nNew", type: "toggle", setting: "nNew", stub: true },
    { id: "nSound", type: "toggle", setting: "nSound", stub: true },
  ],
  privacy: [
    { id: "telemetryNote", type: "note" },
    { id: "crash", type: "toggle", setting: "crash", stub: true },
    { id: "history", type: "action", action: "clearHistory" },
  ],
  account: [
    { id: "profileLink", type: "link", link: "profile" },
    { id: "subLink", type: "link", link: "subscription" },
    { id: "signOut", type: "action", action: "signOut" },
  ],
  advanced: [
    { id: "dev", type: "toggle", setting: "dev" },
    { id: "proxy", type: "action", action: "configureProxy", stub: true },
    { id: "portable", type: "toggle", setting: "portable", stub: true },
    { id: "viewAsDeveloper", type: "toggle", setting: "viewAsDeveloper", devOnly: true },
    { id: "simulateOffline", type: "toggle", setting: "simulateOffline", devOnly: true },
    { id: "replayFirstLaunch", type: "action", action: "replayFirstLaunch", devOnly: true },
    { id: "gallery", type: "link", link: "dev", devOnly: true },
  ],
};

export function isRowSection(id: SettingsSectionId): id is SettingsRowSectionId {
  return id !== "sources" && id !== "about";
}

/** The rows to render: developer tools and not-yet-working rows only while Developer mode is on. */
export function visibleSettingsRows(
  section: SettingsRowSectionId,
  settings: Pick<Settings, "dev">,
): SettingsRow[] {
  return SETTINGS_ROWS[section].filter((row) => !(row.devOnly || row.stub) || settings.dev);
}

/** Which sections the catalog's features leave on (D68). */
export interface SectionFeatures {
  account: boolean;
  channels: boolean;
}

/**
 * The sections to list: Account only with accounts, Sources only with channels, and a row
 * section only while it has a row to show.
 */
export function visibleSettingsSections(
  settings: Pick<Settings, "dev">,
  features: SectionFeatures,
): SettingsSection[] {
  return SETTINGS_SECTIONS.filter(({ id }) => {
    if (id === "account") return features.account;
    if (id === "sources") return features.channels;
    return !isRowSection(id) || visibleSettingsRows(id, settings).length > 0;
  });
}
