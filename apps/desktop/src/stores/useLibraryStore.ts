// Library view state: tab, quick filter, open collection, sort, list/grid, open overflow menu.
import { create } from "zustand";
import type { LibraryFilter, LibrarySort, LibraryTab, LibraryView } from "@/domain/apps";
import type { AppId } from "@/services/types";

export type { LibraryFilter, LibrarySort, LibraryTab, LibraryView } from "@/domain/apps";

export interface LibraryState {
  tab: LibraryTab;
  sort: LibrarySort;
  view: LibraryView;
  /** Open user collection (Collections tab). */
  collection: string | null;
  filter: LibraryFilter;
  /** App whose ⋯ menu is open. */
  menuFor: AppId | null;
  /** Switching tabs closes the collection and resets the quick filter. */
  setTab(tab: LibraryTab): void;
  /** Quick filters live on the Installed tab. */
  setFilter(filter: LibraryFilter): void;
  openCollection(id: string): void;
  closeCollection(): void;
  setSort(sort: LibrarySort): void;
  setView(view: LibraryView): void;
  toggleMenu(appId: AppId): void;
  closeMenu(): void;
}

export const useLibraryStore = create<LibraryState>()((set) => ({
  tab: "installed",
  sort: "recent",
  view: "list",
  collection: null,
  filter: "all",
  menuFor: null,

  setTab(tab) {
    set({ tab, collection: null, filter: "all", menuFor: null });
  },
  setFilter(filter) {
    set({ tab: "installed", filter, collection: null, menuFor: null });
  },
  openCollection(collection) {
    set({ tab: "collections", collection, menuFor: null });
  },
  closeCollection() {
    set({ collection: null });
  },
  setSort(sort) {
    set({ sort });
  },
  setView(view) {
    set({ view });
  },
  toggleMenu(appId) {
    set((s) => ({ menuFor: s.menuFor === appId ? null : appId }));
  },
  closeMenu() {
    set({ menuFor: null });
  },
}));
