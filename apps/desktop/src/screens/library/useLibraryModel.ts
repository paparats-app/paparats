// What the Library shows: the installed apps, the list for the current tab / quick filter /
// collection, the counts on the tabs, stats and quick filters — the prototype's `// library`
// block in `renderVals` (lines 1955–1972).
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  collectionApps,
  installState,
  installedApps,
  isBusy,
  libraryList,
  sortLibrary,
  totalSizeMb,
  type AppInstallState,
  type LibraryFilter,
} from "@/domain/apps";
import {
  useChannelContext,
  useInstalledIndex,
  useLocale,
  useToday,
  useUpdates,
  useVisibleApps,
} from "@/hooks";
import { useCatalog, useLibrary } from "@/queries";
import type { App, AppId, LibraryCollection } from "@/services/types";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useLibraryStore } from "@/stores/useLibraryStore";

/** Which empty state the list shows (the prototype's `libEmpty`). */
export type LibraryEmptyKind = "library" | "favorites" | "downloads" | "updates" | "collection";

export interface LibraryModel {
  /** Catalog, library and channels have loaded. */
  ready: boolean;
  /** Installed (visible) apps, catalog order. */
  installed: App[];
  favorites: ReadonlySet<AppId>;
  collections: readonly LibraryCollection[];
  /** The open collection on the Collections tab. */
  openCollection: LibraryCollection | null;
  /** The Collections tab without an open collection shows the cards instead of a list. */
  showCollectionCards: boolean;
  /** The sorted list for the tab, quick filter or open collection. */
  list: App[];
  /** The empty state: `list` is empty, or the Collections tab has no collection to show. */
  empty: LibraryEmptyKind | null;
  counts: {
    installed: number;
    favorites: number;
    /** Collections tab pill: collections with their own app list ("All apps" is not one). */
    collectionsTab: number;
    /** Stats: every collection. */
    collections: number;
    /** Quick filters. */
    filters: Record<LibraryFilter, number>;
  };
  /** Full install size of the installed apps, MB. */
  totalMb: number;
  /** Installed apps in a collection. */
  collectionCount(collection: LibraryCollection): number;
}

const NO_COLLECTIONS: LibraryCollection[] = [];
const NO_FAVORITES: AppId[] = [];

function emptyKind(tab: string, filter: LibraryFilter): LibraryEmptyKind {
  if (tab === "favorites" || (tab === "installed" && filter === "favorites")) return "favorites";
  if (tab === "installed" && filter === "downloads") return "downloads";
  if (tab === "installed" && filter === "updates") return "updates";
  if (tab === "collections") return "collection";
  return "library";
}

export function useLibraryModel(): LibraryModel {
  const catalog = useCatalog().data;
  const library = useLibrary().data;
  const { ready: channelsReady } = useChannelContext();
  const apps = useVisibleApps();
  const installedIndex = useInstalledIndex();
  // Shallow: a snapshot that brings the same items (e.g. the empty queue at startup) is no change.
  const downloads = useDownloadsStore(useShallow((s) => s.items));
  const updates = useUpdates();
  const today = useToday();
  const locale = useLocale();
  const tab = useLibraryStore((s) => s.tab);
  const filter = useLibraryStore((s) => s.filter);
  const sort = useLibraryStore((s) => s.sort);
  const collectionId = useLibraryStore((s) => s.collection);

  return useMemo(() => {
    const favoriteIds = library?.favorites ?? NO_FAVORITES;
    const favorites = new Set(favoriteIds);
    const collections = library?.collections ?? NO_COLLECTIONS;
    const stateOf = (app: App): AppInstallState =>
      installState(app, installedIndex.get(app.id), downloads[app.id]);

    const installed = installedApps(apps, installedIndex);
    const favoriteCount = installed.filter((app) => favorites.has(app.id)).length;
    const openCollection =
      tab === "collections" && collectionId !== null
        ? (collections.find((c) => c.id === collectionId) ?? null)
        : null;
    const showCollectionCards = tab === "collections" && openCollection === null;

    const unsorted = libraryList(apps, {
      tab,
      filter,
      collection: openCollection,
      favorites: favoriteIds,
      installed: installedIndex,
      stateOf,
    });
    const list = sortLibrary(unsorted, sort, installedIndex, today, locale);

    const collectionCount = (collection: LibraryCollection) =>
      collectionApps(installed, collection).length;

    return {
      ready: Boolean(catalog && library && channelsReady),
      installed,
      favorites,
      collections,
      openCollection,
      showCollectionCards,
      list,
      // The collection cards replace the list; with no collection at all, "Nothing found".
      empty: showCollectionCards
        ? collections.length === 0
          ? "collection"
          : null
        : list.length === 0
          ? emptyKind(tab, filter)
          : null,
      counts: {
        installed: installed.length,
        favorites: favoriteCount,
        collectionsTab: collections.filter((c) => c.apps !== null).length,
        collections: collections.length,
        filters: {
          all: installed.length,
          updates: updates.count,
          downloads: apps.filter((app) => isBusy(stateOf(app))).length,
          favorites: favoriteCount,
        },
      },
      totalMb: totalSizeMb(installed),
      collectionCount,
    };
  }, [
    catalog,
    library,
    channelsReady,
    apps,
    installedIndex,
    downloads,
    updates.count,
    today,
    locale,
    tab,
    filter,
    sort,
    collectionId,
  ]);
}
