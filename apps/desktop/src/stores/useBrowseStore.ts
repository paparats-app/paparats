// Browse filters, the filter-panel search and the featured-app carousel.
import { create } from "zustand";
import { defaultBrowseFilters, type BrowseFilters, type BrowseSort } from "@/domain/apps";
import type { CategoryId, ChannelId } from "@/services/types";

export type { BrowseFilters, BrowseSort } from "@/domain/apps";

export interface BrowseState extends BrowseFilters {
  /** "Search filters…" — narrows the category list. */
  filterQuery: string;
  heroIndex: number;
  /** Navigation into Browse: every filter back to its default, then `preset`. */
  apply(preset?: Partial<BrowseFilters>): void;
  /** "Clear all": every filter back to its default (the curated view). */
  clearAll(): void;
  // Changing a filter closes an open collection (the prototype's behaviour).
  toggleCategory(id: CategoryId): void;
  togglePro(): void;
  togglePortable(): void;
  setSort(sort: BrowseSort): void;
  toggleSource(id: ChannelId): void;
  /** Unsubscribing or pausing a channel also drops it from the source filter. */
  dropSource(id: ChannelId): void;
  setFilterQuery(query: string): void;
  setHeroIndex(index: number): void;
}

const toggle = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

export const useBrowseStore = create<BrowseState>()((set) => ({
  ...defaultBrowseFilters(),
  filterQuery: "",
  heroIndex: 0,

  apply(preset = {}) {
    set({ ...defaultBrowseFilters(), ...preset });
  },
  clearAll() {
    set(defaultBrowseFilters());
  },
  toggleCategory(id) {
    set((s) => ({ categories: toggle(s.categories, id), collection: null }));
  },
  togglePro() {
    set((s) => ({ pro: !s.pro, collection: null }));
  },
  togglePortable() {
    set((s) => ({ portable: !s.portable, collection: null }));
  },
  setSort(sort) {
    set({ sort, collection: null });
  },
  toggleSource(id) {
    set((s) => ({ sources: toggle(s.sources, id), collection: null }));
  },
  dropSource(id) {
    set((s) => ({ sources: s.sources.filter((x) => x !== id) }));
  },
  setFilterQuery(filterQuery) {
    set({ filterQuery });
  },
  setHeroIndex(heroIndex) {
    set({ heroIndex });
  },
}));

/**
 * The six filter fields of the store state (for `browseFilter()`). Returns a new object: select it
 * with `useBrowseStore(useShallow(selectBrowseFilters))`.
 */
export function selectBrowseFilters(s: BrowseState): BrowseFilters {
  return {
    categories: s.categories,
    pro: s.pro,
    portable: s.portable,
    sort: s.sort,
    collection: s.collection,
    sources: s.sources,
  };
}
