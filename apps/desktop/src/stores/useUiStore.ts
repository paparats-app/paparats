// Shell UI state: search query, toast, navigation skeleton. Timings are the prototype's.
import { create } from "zustand";

/** "Searching…" skeleton after each keystroke. */
export const SEARCH_SKELETON_MS = 340;
/** How long a toast stays up. */
export const TOAST_MS = 2800;
/** Loading skeleton after a navigation. */
export const NAV_SKELETON_MS = 420;

export interface Toast {
  /** Increments per toast, so a repeated message still re-renders as a new toast. */
  id: number;
  message: string;
}

export interface UiState {
  query: string;
  /** The search skeleton is showing (a non-blank query was typed < 340 ms ago). */
  searching: boolean;
  toast: Toast | null;
  /** Bumped by every navigation (enter animation key, scroll reset). */
  navCount: number;
  /** The navigation skeleton is showing. */
  loading: boolean;
  /** `skeleton: false` sets the query without the searching state (search suggestion chips). */
  setQuery(query: string, options?: { skeleton?: boolean }): void;
  clearQuery(): void;
  /** Shows `message` for 2.8 s, replacing any toast on screen. */
  notify(message: string): void;
  dismissToast(): void;
  /**
   * A navigation happened: clears the search, bumps `navCount` and, with `skeleton` (off when
   * "Subtle animations" is off), shows the loading skeleton for 420 ms.
   */
  beginNavigation(options: { skeleton: boolean }): void;
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let toastSeq = 0;

export const useUiStore = create<UiState>()((set) => ({
  query: "",
  searching: false,
  toast: null,
  navCount: 0,
  loading: false,

  setQuery(query, options) {
    clearTimeout(searchTimer);
    const searching = (options?.skeleton ?? true) && query.trim().length > 0;
    set({ query, searching });
    if (searching) searchTimer = setTimeout(() => set({ searching: false }), SEARCH_SKELETON_MS);
  },

  clearQuery() {
    clearTimeout(searchTimer);
    set({ query: "", searching: false });
  },

  notify(message) {
    clearTimeout(toastTimer);
    toastSeq += 1;
    set({ toast: { id: toastSeq, message } });
    toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
  },

  dismissToast() {
    clearTimeout(toastTimer);
    set({ toast: null });
  },

  beginNavigation({ skeleton }) {
    clearTimeout(searchTimer);
    clearTimeout(loadTimer);
    set((s) => ({ query: "", searching: false, navCount: s.navCount + 1, loading: skeleton }));
    if (skeleton) loadTimer = setTimeout(() => set({ loading: false }), NAV_SKELETON_MS);
  },
}));
