// Updates screen: which rows show their release notes, and the history card.
import { create } from "zustand";
import type { AppId } from "@/services/types";

export interface UpdatesState {
  expanded: Record<AppId, boolean>;
  historyOpen: boolean;
  toggleExpanded(appId: AppId): void;
  toggleHistory(): void;
}

export const useUpdatesStore = create<UpdatesState>()((set) => ({
  // Two rows start expanded, like the design.
  expanded: { vscode: true, obsidian: true },
  historyOpen: false,

  toggleExpanded(appId) {
    set((s) => ({ expanded: { ...s.expanded, [appId]: !s.expanded[appId] } }));
  },
  toggleHistory() {
    set((s) => ({ historyOpen: !s.historyOpen }));
  },
}));
