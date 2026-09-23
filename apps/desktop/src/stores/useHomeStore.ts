// Home: the hero carousel position and the first-launch hero glow.
import { create } from "zustand";

export interface HomeState {
  heroIndex: number;
  /**
   * The coral glow over the hero (first-launch exit, FIRST_LAUNCH_SPEC "Exit transition" step 4):
   * the first-launch scene turns it on as it hands over to Home and off again ~1.7 s later.
   */
  heroGlow: boolean;
  setHeroIndex(index: number): void;
  /** Next/previous slide, wrapping around `count` slides. */
  step(delta: 1 | -1, count: number): void;
  setHeroGlow(on: boolean): void;
}

export const useHomeStore = create<HomeState>()((set) => ({
  heroIndex: 0,
  heroGlow: false,

  setHeroIndex(heroIndex) {
    set({ heroIndex });
  },
  step(delta, count) {
    if (count <= 0) return;
    set((s) => ({ heroIndex: (((s.heroIndex + delta) % count) + count) % count }));
  },
  setHeroGlow(heroGlow) {
    set({ heroGlow });
  },
}));
