// Apps: install state, pending updates, search, Browse filters/sorting, Library lists.
import type {
  App,
  AppId,
  CategoryId,
  ChannelId,
  Collection,
  DownloadItem,
  InstalledApp,
  IsoDate,
  Library,
  LibraryCollection,
  Locale,
  UpdateManifest,
} from "@/services/types";
import { downDays, isActive, sourceOf, type ChannelContextData } from "./channels";
import { pickLocalized } from "./text";

// ---------------------------------------------------------------------------------------------
// Install state
// ---------------------------------------------------------------------------------------------

export type AppInstallState =
  "none" | "installed" | "update" | "queued" | "downloading" | "paused" | "installing";

/** Installed apps by id (from `Library.installed`). */
export type InstalledIndex = ReadonlyMap<AppId, InstalledApp>;

export function indexInstalled(installed: readonly InstalledApp[]): Map<AppId, InstalledApp> {
  return new Map(installed.map((i) => [i.appId, i]));
}

/** State of a queue entry; a download at 100 % is already installing. */
export function downloadState(download: DownloadItem): AppInstallState {
  switch (download.state) {
    case "queued":
      return "queued";
    case "paused":
      return "paused";
    case "installing":
      return "installing";
    case "downloading":
      return download.progress >= 100 ? "installing" : "downloading";
  }
}

/**
 * The prototype's `stateOf`: a queue entry wins, otherwise the inventory decides between
 * none / installed / update.
 */
export function installState(
  app: App,
  installed?: InstalledApp,
  download?: DownloadItem,
): AppInstallState {
  if (download) return downloadState(download);
  if (!installed) return "none";
  return installed.version === app.version ? "installed" : "update";
}

/** `library` with `entry` recorded in the inventory (replacing an older version of the app). */
export function recordInstalled(library: Library, entry: InstalledApp): Library {
  const at = library.installed.findIndex((i) => i.appId === entry.appId);
  const installed =
    at < 0
      ? [...library.installed, entry]
      : library.installed.map((i, k) => (k === at ? entry : i));
  return { ...library, installed };
}

/** In the download queue (queued, downloading, paused or installing). */
export function isBusy(state: AppInstallState): boolean {
  return (
    state === "queued" || state === "downloading" || state === "paused" || state === "installing"
  );
}

// ---------------------------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------------------------

export function manifestOf(
  manifests: readonly UpdateManifest[],
  appId: AppId,
): UpdateManifest | undefined {
  return manifests.find((m) => m.appId === appId);
}

/** Bytes to transfer: the manifest's update size for an installed app, else the full size. */
export function updateSizeMb(
  app: App,
  manifests: readonly UpdateManifest[],
  isInstalled: boolean,
): number {
  const manifest = isInstalled ? manifestOf(manifests, app.id) : undefined;
  return manifest ? manifest.downloadMb : app.sizeMb;
}

/**
 * Installed at a version other than the catalog's, from a source channel that is switched on
 * and reachable.
 */
export function pendingUpdates(
  apps: readonly App[],
  installed: InstalledIndex,
  ctx: ChannelContextData,
  today: IsoDate,
): App[] {
  return apps.filter((app) => {
    const inst = installed.get(app.id);
    if (!inst || inst.version === app.version) return false;
    const source = sourceOf(app, ctx);
    return isActive(ctx.subscriptions, source) && downDays(ctx.byId[source], today) === 0;
  });
}

/** Total download size of `apps` as updates, rounded to 0.1 MB. */
export function totalUpdateMb(apps: readonly App[], manifests: readonly UpdateManifest[]): number {
  const total = apps.reduce((sum, app) => sum + updateSizeMb(app, manifests, true), 0);
  return Math.round(total * 10) / 10;
}

// ---------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------

export interface SearchOptions {
  locale: Locale;
  categoryLabel(id: CategoryId): string;
  channelName(id: ChannelId): string;
  /** The channel the app installs from (`useChannelContext().sourceOf`). */
  sourceOf(app: App): ChannelId;
}

/**
 * Case-insensitive substring match over name, publisher, tagline, category label and source
 * channel name (joined, like the prototype). A blank query matches nothing.
 */
export function searchApps(apps: readonly App[], query: string, options: SearchOptions): App[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return apps.filter((app) => {
    const haystack = [
      app.name,
      app.publisher,
      pickLocalized(app.tagline, options.locale),
      options.categoryLabel(app.category),
      options.channelName(options.sourceOf(app)),
    ].join(" ");
    return haystack.toLowerCase().includes(q);
  });
}

// ---------------------------------------------------------------------------------------------
// Browse
// ---------------------------------------------------------------------------------------------

export type BrowseSort = "featured" | "newest" | "name" | "size";

export interface BrowseFilters {
  categories: CategoryId[];
  pro: boolean;
  portable: boolean;
  sort: BrowseSort;
  /** An editorial collection shown instead of the filter results. */
  collection: string | null;
  /** Source channels (only shown when more than one channel is active). */
  sources: ChannelId[];
}

/** A fresh copy of the default (unfiltered) Browse state. */
export function defaultBrowseFilters(): BrowseFilters {
  return {
    categories: [],
    pro: false,
    portable: false,
    sort: "featured",
    collection: null,
    sources: [],
  };
}

/** Any filter or a non-default sort switches Browse from the curated view to results. */
export function browseFiltersActive(filters: BrowseFilters): boolean {
  return (
    filters.categories.length > 0 ||
    filters.pro ||
    filters.portable ||
    filters.sources.length > 0 ||
    filters.sort !== "featured"
  );
}

/**
 * The Browse result list before sorting. An open collection lists its (visible) apps in
 * collection order; otherwise categories, Pro, portable and source filters apply.
 */
export function browseFilter(
  apps: readonly App[],
  filters: BrowseFilters,
  ctx: ChannelContextData,
  collections: readonly Collection[] = [],
): App[] {
  const collection = filters.collection
    ? collections.find((c) => c.id === filters.collection)
    : undefined;
  if (collection) {
    return collection.apps.flatMap((id) => apps.filter((app) => app.id === id));
  }
  return apps.filter(
    (app) =>
      (filters.categories.length === 0 || filters.categories.includes(app.category)) &&
      (!filters.pro || app.pro) &&
      (!filters.portable || app.portable) &&
      (filters.sources.length === 0 || filters.sources.includes(sourceOf(app, ctx))),
  );
}

/** Featured keeps catalog order; newest by release date; A–Z; largest first. */
export function sortApps(apps: readonly App[], sort: BrowseSort, locale?: Locale): App[] {
  const list = [...apps];
  switch (sort) {
    case "featured":
      return list;
    case "newest":
      return list.sort((a, b) => b.updated.localeCompare(a.updated));
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, locale));
    case "size":
      return list.sort((a, b) => b.sizeMb - a.sizeMb);
  }
}

// ---------------------------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------------------------

export type LibraryTab = "installed" | "favorites" | "collections";
export type LibraryFilter = "all" | "updates" | "downloads" | "favorites";
export type LibrarySort = "recent" | "name" | "size";
export type LibraryView = "list" | "grid";

export function installedApps(apps: readonly App[], installed: InstalledIndex): App[] {
  return apps.filter((app) => installed.has(app.id));
}

/** Installed apps in a user collection (`apps: null` = all installed apps). */
export function collectionApps(installed: readonly App[], collection: LibraryCollection): App[] {
  const ids = collection.apps;
  return ids ? installed.filter((app) => ids.includes(app.id)) : [...installed];
}

export interface LibraryListOptions {
  tab: LibraryTab;
  /** Quick filter; applies to the Installed tab only. */
  filter: LibraryFilter;
  /** The open collection on the Collections tab (none open = the collection cards, no list). */
  collection: LibraryCollection | null;
  favorites: readonly AppId[];
  installed: InstalledIndex;
  stateOf(app: App): AppInstallState;
}

/**
 * The Library list before sorting. `apps` are the visible apps: the Downloads quick filter lists
 * every app in the queue, installed or not.
 */
export function libraryList(apps: readonly App[], options: LibraryListOptions): App[] {
  const mine = installedApps(apps, options.installed);
  const isFavorite = (app: App) => options.favorites.includes(app.id);
  switch (options.tab) {
    case "favorites":
      return mine.filter(isFavorite);
    case "collections":
      return options.collection ? collectionApps(mine, options.collection) : [];
    case "installed":
      switch (options.filter) {
        case "all":
          return mine;
        case "updates":
          return mine.filter((app) => options.stateOf(app) === "update");
        case "favorites":
          return mine.filter(isFavorite);
        case "downloads":
          return apps.filter((app) => isBusy(options.stateOf(app)));
      }
  }
}

/** Recently used first (not installed = used today), A–Z, or largest first. */
export function sortLibrary(
  apps: readonly App[],
  sort: LibrarySort,
  installed: InstalledIndex,
  today: IsoDate,
  locale?: Locale,
): App[] {
  const lastUsed = (app: App) => installed.get(app.id)?.lastUsed ?? today;
  const list = [...apps];
  switch (sort) {
    case "recent":
      return list.sort((a, b) => lastUsed(b).localeCompare(lastUsed(a)));
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, locale));
    case "size":
      return list.sort((a, b) => b.sizeMb - a.sizeMb);
  }
}

/** Sum of full install sizes, in MB. */
export function totalSizeMb(apps: readonly App[]): number {
  return Math.round(apps.reduce((sum, app) => sum + app.sizeMb, 0) * 10) / 10;
}
