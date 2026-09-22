// Ideas board view state: tab, status chips, sort, app filter.
import { create } from "zustand";
import type { IdeaSort, IdeaTab } from "@/domain/ideas";
import type { AppId, IdeaStatus } from "@/services/types";

export type { IdeaSort, IdeaTab } from "@/domain/ideas";

export interface IdeasState {
  /** Stored as picked; `effectiveIdeaTab()` maps a tab the current view lacks to "all". */
  tab: IdeaTab;
  statuses: IdeaStatus[];
  sort: IdeaSort;
  /** "Ideas for <app>" chip. */
  appFilter: AppId | null;
  setTab(tab: IdeaTab): void;
  toggleStatus(status: IdeaStatus): void;
  setSort(sort: IdeaSort): void;
  setAppFilter(appId: AppId | null): void;
  /** Navigation from an app page: that app's ideas, All tab, no status chips. */
  focusApp(appId: AppId | null): void;
}

export const useIdeasStore = create<IdeasState>()((set) => ({
  tab: "all",
  statuses: [],
  sort: "top",
  appFilter: null,

  setTab(tab) {
    set({ tab });
  },
  toggleStatus(status) {
    set((s) => ({
      statuses: s.statuses.includes(status)
        ? s.statuses.filter((x) => x !== status)
        : [...s.statuses, status],
    }));
  },
  setSort(sort) {
    set({ sort });
  },
  setAppFilter(appFilter) {
    set({ appFilter });
  },
  focusApp(appFilter) {
    set({ appFilter, tab: "all", statuses: [] });
  },
}));
