// First launch (FIRST_LAUNCH_SPEC.md, prototype `startIntro / skipIntro / introStep / finishIntro`):
// the phase of the night scene and onboarding, the startup decision (`launch()`), Settings ›
// Advanced › Replay first launch (`replay()`), and the `paparats.firstRun` record written on
// finish. The store holds no timers: the scene (`screens/first-launch`) runs the timeline while it
// is mounted and calls `advance()` / `close()`, so nothing keeps ticking after it unmounts.
import { create } from "zustand";
import { localStore } from "@/platform/storage";
import type { Locale, ThemePreference } from "@/services/types";
import { useHomeStore } from "./useHomeStore";
import { useSettingsStore } from "./useSettingsStore";

/** seed → fern → part → bloom → logo (auto) → lang → theme → signin (steps) → done (exit). */
export type FirstLaunchPhase =
  "seed" | "fern" | "part" | "bloom" | "logo" | "lang" | "theme" | "signin" | "done";

export const FIRST_LAUNCH_PHASES: readonly FirstLaunchPhase[] = [
  "seed",
  "fern",
  "part",
  "bloom",
  "logo",
  "lang",
  "theme",
  "signin",
  "done",
];

/** The onboarding steps, in order (phases 5–7). */
export type FirstLaunchStep = "lang" | "theme" | "signin";
export const FIRST_LAUNCH_STEPS: readonly FirstLaunchStep[] = ["lang", "theme", "signin"];

/** Auto-advancing phases and when they start after the scene mounts (ms, spec "Timeline"). */
export const FIRST_LAUNCH_TIMELINE: readonly (readonly [FirstLaunchPhase, number])[] = [
  ["fern", 120],
  ["part", 1400],
  ["bloom", 2800],
  ["logo", 4300],
  ["lang", 5400],
];

/** The overlay unmounts this long after finishing (spec "Exit transition"). */
export const FIRST_LAUNCH_EXIT_MS = 1500;
/** The Home hero glow turns off this long after finishing (prototype `glowTimer`). */
export const HERO_GLOW_MS = 1700;
/** "Signed in as …" appears this long after Sign in (prototype `signInIntro`). */
export const SIGNED_IN_TOAST_MS = 1600;

/** `localStorage` key of the first-launch record. */
export const FIRST_RUN_KEY = "paparats.firstRun";

/** Written on finish; `seen` skips the scene on the next launch. */
export interface FirstRunRecord {
  seen: true;
  locale: Locale;
  theme: ThemePreference;
  /** ISO timestamp of the finish. */
  at: string;
}

export function phaseIndex(phase: FirstLaunchPhase): number {
  return FIRST_LAUNCH_PHASES.indexOf(phase);
}

/** Index of `lang`: phases before it auto-advance and can be skipped. */
const LANG_INDEX = 5;

export function isStep(phase: FirstLaunchPhase | null): phase is FirstLaunchStep {
  return phase === "lang" || phase === "theme" || phase === "signin";
}

/** Whether the first launch was finished before (a readable record with `seen: true`). */
export function hasSeenFirstLaunch(): boolean {
  const record = localStore.readJson(FIRST_RUN_KEY);
  return typeof record === "object" && record !== null && "seen" in record && record.seen === true;
}

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/**
 * The scene animates unless the OS asks for reduced motion or "Subtle animations" is off; then it
 * starts at the language step with no motion (spec "Exit transition" 5).
 */
export function sceneMotionAllowed(): boolean {
  return useSettingsStore.getState().settings.animations && !prefersReducedMotion();
}

export interface FirstLaunchState {
  /** Bumped by every `replay()`; 0 until a replay is requested this session. */
  replayRequested: number;
  /** The scene's phase; `null` while no scene is showing. */
  phase: FirstLaunchPhase | null;
  /** Bumped by every start: the scene restarts its timeline (and animations) for a new run. */
  run: number;
  /** This run animates (false: reduced motion — it began at `lang`, nothing moves). */
  motion: boolean;
  /** Startup: plays the scene unless the first-run record says it was seen. */
  launch(): void;
  /** Asks the first-launch scene to play again (language, appearance, sign-in). */
  replay(): void;
  /** Starts a new run: `seed` (or `lang` without motion); the Home hero glow goes off. */
  start(): void;
  /** Timeline tick of run `run`: moves forward to `phase` (never back, never past `lang`). */
  advance(run: number, phase: FirstLaunchPhase): void;
  /** Click on the scene / `››` during phases 0–4: straight to `lang`. No-op once a step shows. */
  skip(): void;
  /** Continue: lang → theme → signin. */
  next(): void;
  /** Back: signin → theme → lang. */
  back(): void;
  /**
   * Later / Sign in: writes the first-run record (current locale and theme), switches to `done`
   * and turns the Home hero glow on. `false` (nothing changed) unless a step is showing.
   */
  finish(): boolean;
  /** The exit of run `run` is over: the overlay goes. */
  close(run: number): void;
}

export const useFirstLaunchStore = create<FirstLaunchState>()((set, get) => ({
  replayRequested: 0,
  phase: null,
  run: 0,
  motion: true,

  launch() {
    if (!hasSeenFirstLaunch()) get().start();
  },

  replay() {
    set((s) => ({ replayRequested: s.replayRequested + 1 }));
    get().start();
  },

  start() {
    const motion = sceneMotionAllowed();
    useHomeStore.getState().setHeroGlow(false);
    set((s) => ({ phase: motion ? "seed" : "lang", run: s.run + 1, motion }));
  },

  advance(run, phase) {
    const current = get().phase;
    if (run !== get().run || current === null) return;
    const from = phaseIndex(current);
    const to = phaseIndex(phase);
    if (from >= LANG_INDEX || to <= from || to > LANG_INDEX) return;
    set({ phase });
  },

  skip() {
    const { phase } = get();
    if (phase === null || phaseIndex(phase) >= LANG_INDEX) return;
    set({ phase: "lang" });
  },

  next() {
    const { phase } = get();
    if (!isStep(phase)) return;
    const following = FIRST_LAUNCH_STEPS[FIRST_LAUNCH_STEPS.indexOf(phase) + 1];
    if (following) set({ phase: following });
  },

  back() {
    const { phase } = get();
    if (!isStep(phase)) return;
    const previous = FIRST_LAUNCH_STEPS[FIRST_LAUNCH_STEPS.indexOf(phase) - 1];
    if (previous) set({ phase: previous });
  },

  finish() {
    if (!isStep(get().phase)) return false;
    const { locale, theme } = useSettingsStore.getState().settings;
    const record: FirstRunRecord = { seen: true, locale, theme, at: new Date().toISOString() };
    localStore.writeJson(FIRST_RUN_KEY, record);
    set({ phase: "done" });
    useHomeStore.getState().setHeroGlow(true);
    return true;
  },

  close(run) {
    if (run === get().run && get().phase === "done") set({ phase: null });
  },
}));
