import type { App, CategoryId, DownloadItem, InstalledApp, Locale } from "@/services/types";
import {
  browseFilter,
  browseFiltersActive,
  collectionApps,
  defaultBrowseFilters,
  indexInstalled,
  installedApps,
  installState,
  isBusy,
  libraryList,
  pendingUpdates,
  pickByIds,
  recordInstalled,
  searchApps,
  sortApps,
  sortLibrary,
  totalSizeMb,
  totalUpdateMb,
  updateSizeMb,
  type AppInstallState,
  type LibraryListOptions,
} from "./apps";
import { sourceOf, visibleApps } from "./channels";
import { appById, catalog, channelById, channelCtx, library, sub, TODAY } from "./testFixtures";

const installed = indexInstalled(library.installed);
const ctx = channelCtx();
const visible = visibleApps(catalog.apps, ctx, installed);
const ids = (apps: readonly App[]) => apps.map((a) => a.id);

function item(appId: string, patch: Partial<DownloadItem> = {}): DownloadItem {
  return {
    appId,
    version: "1.0",
    kind: "install",
    state: "downloading",
    progress: 40,
    sizeMb: 10,
    ...patch,
  };
}

describe("installState", () => {
  const vscode = appById("vscode");
  const flow = appById("flow");

  it("derives none / installed / update from the inventory", () => {
    expect(installState(appById("files"))).toBe("none");
    expect(installState(flow, installed.get("flow"))).toBe("installed");
    expect(installState(vscode, installed.get("vscode"))).toBe("update");
  });

  it("reads a newer or differently spelled real install as installed", () => {
    // The real inventory (PAPARATS_REAL=inventory) reports what Windows has.
    const newer = { appId: "vscode", version: "1.121.0", lastUsed: TODAY };
    expect(installState(vscode, newer)).toBe("installed");
    const spelled = { appId: "vscode", version: "1.93.0.0", lastUsed: TODAY };
    expect(installState(vscode, spelled)).toBe("installed");
  });

  it("lets a queue entry win over the inventory", () => {
    const inst = installed.get("vscode");
    expect(installState(vscode, inst, item("vscode", { state: "queued", progress: 0 }))).toBe(
      "queued",
    );
    expect(installState(vscode, inst, item("vscode"))).toBe("downloading");
    expect(installState(vscode, inst, item("vscode", { state: "paused" }))).toBe("paused");
    expect(installState(vscode, inst, item("vscode", { state: "installing", progress: 100 }))).toBe(
      "installing",
    );
    expect(installState(vscode, inst, item("vscode", { progress: 100 }))).toBe("installing");
  });

  it("records an install in a library snapshot", () => {
    const updated = recordInstalled(library, {
      appId: "vscode",
      version: "1.93.0",
      lastUsed: TODAY,
    });
    expect(updated.installed).toHaveLength(library.installed.length);
    expect(updated.installed[0]).toEqual({ appId: "vscode", version: "1.93.0", lastUsed: TODAY });
    expect(library.installed[0]?.version).toBe("1.92.2");
    const added = recordInstalled(library, { appId: "files", version: "3.9.4", lastUsed: TODAY });
    expect(added.installed.at(-1)?.appId).toBe("files");
    expect(added.favorites).toBe(library.favorites);
  });

  it("treats queued, downloading, paused and installing as busy", () => {
    const busy: AppInstallState[] = ["queued", "downloading", "paused", "installing"];
    const idle: AppInstallState[] = ["none", "installed", "update"];
    expect(busy.every(isBusy)).toBe(true);
    expect(idle.some(isBusy)).toBe(false);
  });
});

describe("updates", () => {
  it("uses the manifest size for installed apps and the full size otherwise", () => {
    expect(updateSizeMb(appById("vscode"), catalog.updates, true)).toBe(87);
    expect(updateSizeMb(appById("vscode"), catalog.updates, false)).toBe(95);
    expect(updateSizeMb(appById("flow"), catalog.updates, true)).toBe(92);
  });

  it("lists installed apps whose catalog version is newer, in catalog order", () => {
    const pending = pendingUpdates(catalog.apps, installed, ctx, TODAY);
    expect(ids(pending)).toEqual(["obsidian", "sharex", "vlc", "notepadpp", "vscode", "shell"]);
    expect(totalUpdateMb(pending, catalog.updates)).toBe(155);
    const newerVscode = indexInstalled([
      ...library.installed.filter((i) => i.appId !== "vscode"),
      { appId: "vscode", version: "1.121.0", lastUsed: TODAY },
    ]);
    expect(ids(pendingUpdates(catalog.apps, newerVscode, ctx, TODAY))).not.toContain("vscode");
  });

  it("skips apps whose source channel is paused or unreachable", () => {
    const withOldCzkawka = indexInstalled([
      ...library.installed.filter((i) => i.appId !== "czkawka"),
      { appId: "czkawka", version: "8.0.0", lastUsed: TODAY },
    ]);
    expect(ids(pendingUpdates(catalog.apps, withOldCzkawka, ctx, TODAY))).not.toContain("czkawka");
    const fossBack = {
      ...ctx,
      byId: { ...ctx.byId, fossfriends: { ...channelById("fossfriends"), outage: null } },
    };
    expect(ids(pendingUpdates(catalog.apps, withOldCzkawka, fossBack, TODAY))).toContain("czkawka");

    const pausedKvetka = channelCtx([sub("paparats"), sub("kvetka", { paused: true })]);
    expect(ids(pendingUpdates(catalog.apps, installed, pausedKvetka, TODAY))).not.toContain(
      "shell",
    );
  });
});

describe("searchApps", () => {
  const categoryLabels: Record<Locale, Partial<Record<CategoryId, string>>> = {
    en: { utilities: "Utilities", system: "System" },
    be: { utilities: "Утыліты", system: "Сістэма" },
    ru: { utilities: "Утилиты", system: "Система" },
  };
  const search = (query: string, locale: Locale = "en") =>
    ids(
      searchApps(visible, query, {
        locale,
        categoryLabel: (id) => categoryLabels[locale][id] ?? "",
        channelName: (id) => channelById(id).name,
        sourceOf: (app) => sourceOf(app, ctx),
      }),
    );

  it("matches name and publisher case-insensitively", () => {
    expect(search("OBSIDIAN")).toEqual(["obsidian"]);
    expect(search("voidtools")).toEqual(["everything"]);
  });

  it("matches the source channel name", () => {
    expect(search("foss friends")).toEqual(["czkawka", "imageglass", "rufus"]);
  });

  it("matches localized taglines and category labels (ru / be)", () => {
    expect(search("контекстное", "ru")).toEqual(["shell"]);
    expect(search("дублікаты", "be")).toEqual(["czkawka"]);
    expect(search("УТЫЛІТ", "be")).toEqual(ids(visible.filter((a) => a.category === "utilities")));
    expect(search("контекстное", "en")).toEqual([]);
  });

  it("matches nothing for a blank query", () => {
    expect(search("   ")).toEqual([]);
  });
});

describe("pickByIds", () => {
  it("keeps the order of the ids and skips apps that are not in the list", () => {
    const apps = ["everything", "vscode", "sevenzip"].map(appById);
    expect(ids(pickByIds(apps, ["sevenzip", "hidden", "everything"]))).toEqual([
      "sevenzip",
      "everything",
    ]);
    expect(pickByIds(apps, [])).toEqual([]);
  });
});

describe("Browse", () => {
  it("starts unfiltered", () => {
    const filters = defaultBrowseFilters();
    expect(browseFiltersActive(filters)).toBe(false);
    expect(browseFiltersActive({ ...filters, sort: "name" })).toBe(true);
    expect(browseFiltersActive({ ...filters, sources: ["kvetka"] })).toBe(true);
    expect(defaultBrowseFilters().categories).not.toBe(filters.categories);
  });

  it("filters by category, Pro, portable and source", () => {
    const f = defaultBrowseFilters();
    expect(ids(browseFilter(visible, { ...f, categories: ["design"] }, ctx))).toEqual([
      "krita",
      "inkscape",
    ]);
    expect(ids(browseFilter(visible, { ...f, pro: true }, ctx))).toEqual([
      "obsidian",
      "sharex",
      "flow",
      "krita",
      "rustdesk",
    ]);
    expect(
      ids(browseFilter(visible, { ...f, categories: ["system"], portable: true }, ctx)),
    ).toEqual(["shell", "rufus", "vitrazhtweaker"]);
    expect(ids(browseFilter(visible, { ...f, sources: ["kvetka", "fossfriends"] }, ctx))).toEqual([
      "shell",
      "czkawka",
      "imageglass",
      "rufus",
    ]);
  });

  it("lists an open collection in collection order, visible apps only", () => {
    const f = { ...defaultBrowseFilters(), collection: "creators" };
    expect(ids(browseFilter(visible, f, ctx, catalog.collections))).toEqual([
      "krita",
      "inkscape",
      "obs",
      "audacity",
      "sharex",
    ]);
    const unknown = {
      ...defaultBrowseFilters(),
      collection: "nope",
      categories: ["games" as const],
    };
    expect(ids(browseFilter(visible, unknown, ctx, catalog.collections))).toEqual([
      "mindustry",
      "supertuxkart",
    ]);
  });

  it("sorts featured / newest / A–Z / size", () => {
    const apps = ["everything", "vscode", "sevenzip", "shell"].map(appById);
    expect(ids(sortApps(apps, "featured"))).toEqual(["everything", "vscode", "sevenzip", "shell"]);
    expect(ids(sortApps(apps, "newest"))).toEqual(["shell", "vscode", "sevenzip", "everything"]);
    expect(ids(sortApps(apps, "name"))).toEqual(["sevenzip", "everything", "shell", "vscode"]);
    expect(ids(sortApps(apps, "size"))).toEqual(["vscode", "shell", "everything", "sevenzip"]);
    expect(ids(apps)).toEqual(["everything", "vscode", "sevenzip", "shell"]);
  });
});

describe("Library", () => {
  const mine = installedApps(visible, installed);
  const downloads: Record<string, DownloadItem> = {
    files: item("files", { state: "queued", progress: 0 }),
    vscode: item("vscode", { kind: "update" }),
  };
  const options = (patch: Partial<LibraryListOptions>): LibraryListOptions => ({
    tab: "installed",
    filter: "all",
    collection: null,
    favorites: library.favorites,
    installed,
    stateOf: (app) => installState(app, installed.get(app.id), downloads[app.id]),
    ...patch,
  });

  it("lists installed apps on the Installed tab", () => {
    expect(mine).toHaveLength(14);
    expect(ids(libraryList(visible, options({})))).toEqual(ids(mine));
  });

  it("applies the quick filters", () => {
    expect(ids(libraryList(visible, options({ filter: "favorites" })))).toEqual([
      "obsidian",
      "vlc",
      "everything",
    ]);
    expect(ids(libraryList(visible, options({ filter: "updates" })))).toEqual([
      "obsidian",
      "sharex",
      "vlc",
      "notepadpp",
      "shell",
    ]);
    expect(ids(libraryList(visible, options({ filter: "downloads" })))).toEqual([
      "vscode",
      "files",
    ]);
  });

  it("shows favorites and collections", () => {
    expect(ids(libraryList(visible, options({ tab: "favorites", filter: "updates" })))).toEqual([
      "obsidian",
      "vlc",
      "everything",
    ]);
    expect(libraryList(visible, options({ tab: "collections" }))).toEqual([]);
    const creative = library.collections.find((c) => c.id === "creative");
    const all = library.collections.find((c) => c.id === "all");
    if (!creative || !all) throw new Error("fixture collections missing");
    expect(
      ids(libraryList(visible, options({ tab: "collections", collection: creative }))),
    ).toEqual(["sharex", "vlc", "krita"]);
    expect(collectionApps(mine, all)).toHaveLength(14);
  });

  it("sorts by last use, name or size", () => {
    const apps = ["krita", "vscode", "files", "everything"].map(appById);
    expect(ids(sortLibrary(apps, "recent", installed, TODAY))).toEqual([
      "vscode",
      "files",
      "everything",
      "krita",
    ]);
    expect(ids(sortLibrary(apps, "name", installed, TODAY))).toEqual([
      "everything",
      "files",
      "krita",
      "vscode",
    ]);
    expect(ids(sortLibrary(apps, "size", installed, TODAY))).toEqual([
      "krita",
      "vscode",
      "files",
      "everything",
    ]);
  });

  it("sums sizes", () => {
    const apps = ["sevenzip", "everything", "shell"].map(appById);
    expect(totalSizeMb(apps)).toBe(6.6);
    const noLastUsed: InstalledApp[] = [];
    expect(installedApps(apps, indexInstalled(noLastUsed))).toEqual([]);
  });
});
