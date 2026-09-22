// Home: the hero carousel position.
import { create } from "zustand";

export interface HomeState {
  heroIndex: number;
  setHeroIndex(index: number): void;
  /** Next/previous slide, wrapping around `count` slides. */
  step(delta: 1 | -1, count: number): void;
}

export const useHomeStore = create<HomeState>()((set) => ({
  heroIndex: 0,

  setHeroIndex(heroIndex) {
    set({ heroIndex });
  },
  step(delta, count) {
    if (count <= 0) return;
    set((s) => ({ heroIndex: (((s.heroIndex + delta) % count) + count) % count }));
  },
}));
