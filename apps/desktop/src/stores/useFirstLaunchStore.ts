// First launch: requests to play the onboarding again (Settings › Advanced › Replay first launch,
// developer mode). Minimal on purpose — the first-launch scene (M6) builds on it: it watches
// `replayRequested` and plays when the counter changes.
import { create } from "zustand";

export interface FirstLaunchState {
  /** Bumped by every `replay()`; 0 until a replay is requested this session. */
  replayRequested: number;
  /** Asks the first-launch scene to play again (language, appearance, sign-in). */
  replay(): void;
}

export const useFirstLaunchStore = create<FirstLaunchState>()((set) => ({
  replayRequested: 0,

  replay() {
    set((s) => ({ replayRequested: s.replayRequested + 1 }));
  },
}));
