// The night scene as data: what every layer does in each phase (the prototype's `at([...])` arrays
// in `renderVals` "// first launch"), the eight fern fronds and eleven fireflies (`FLIES`), and the
// geometry that scales the 1440 × 920 authored layout to the window. Pure; no React.
import { phaseIndex, type FirstLaunchPhase } from "@/stores/useFirstLaunchStore";

/** The window size every position in the spec is authored for. */
export const AUTHORED = { width: 1440, height: 920 } as const;

/**
 * Where the flower lands on finish: the spec's Home hero centre, (+122, −173) px from the window
 * centre at 1440 × 920. The hero does not scale with the window: horizontally the offset is half
 * the 244 px sidebar at any width, vertically the point stays 287 px below the window top (under
 * the fixed-height top bar). (The hero's measured centre is ≈ 18 px higher, in the prototype too.)
 */
export const HERO_FROM_CENTRE_X = 122;
export const HERO_CENTRE_Y = AUTHORED.height / 2 - 173;

/** One layer state per phase. Distances are authored px, angles degrees. */
export interface SceneFrame {
  /** Left fern group: translateX (the right group mirrors it) and rotation. */
  fernX: number;
  fernRotate: number;
  /** Both groups: translateY and opacity. */
  fernY: number;
  fernOpacity: number;
  flowerX: number;
  flowerY: number;
  flowerScale: number;
  flowerOpacity: number;
  starOpacity: number;
  /** The shock ring is mounted (it plays once, from `bloom`). */
  ring: boolean;
  fliesOpacity: number;
  logoOpacity: number;
  logoY: number;
  /** A step panel shows (phases 5–7): panel and step indicator visible and interactive. */
  panel: boolean;
  panelY: number;
  /** Phases 0–4: a click on the scene or `››` skips to the language step. */
  skippable: boolean;
  done: boolean;
}

/** The prototype's `at(arr)`: the value for phase index `k`, clamped to the array. */
function at(values: readonly number[], k: number): number {
  return values[Math.max(0, Math.min(k, values.length - 1))] ?? 0;
}

/**
 * Layer values for `phase`. `hero` is where the flower goes on `done`, in authored px from the
 * window centre (default: the spec's +122, −173).
 */
export function sceneFrame(
  phase: FirstLaunchPhase,
  hero: { x: number; y: number } = { x: HERO_FROM_CENTRE_X, y: -173 },
): SceneFrame {
  const k = phaseIndex(phase);
  const done = k === 8;
  const panel = k >= 5 && k <= 7;
  return {
    fernX: at([0, 0, -360, -390, -450, -540, -540, -540, -820], k),
    fernRotate: at([0, 0, -9, -10, -12, -15, -15, -15, -19], k),
    fernY: at([90, 0, 0, 0, 0, 0, 0, 0, 40], k),
    fernOpacity: at([0, 1, 0.95, 0.9, 0.72, 0.5, 0.5, 0.5, 0], k),
    flowerScale: at([0.1, 0.1, 0.28, 1, 0.32, 0.32, 0.32, 0.32, 2.6], k),
    flowerOpacity: done ? 0 : at([0, 0, 0.75, 1, 1, 0.95, 0.95, 0.95], k),
    flowerX: done ? hero.x : k >= 4 ? -7 : 0,
    flowerY: done ? hero.y : k >= 4 ? -265 : 0,
    starOpacity: k >= 4 ? 0 : 1,
    ring: k >= 3 && !done,
    fliesOpacity: at([0, 0, 0.3, 1, 1, 0.55, 0.55, 0.55, 0], k),
    logoOpacity: k >= 4 && !done ? 1 : 0,
    logoY: k >= 4 ? 0 : 24,
    panel,
    panelY: panel ? 0 : 28,
    skippable: k <= 4,
    done,
  };
}

/** Viewport → the uniform scale of the authored layout (the whole scene fits the window). */
export function sceneScale(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.min(width / AUTHORED.width, height / AUTHORED.height);
}

/**
 * The exit target in the scene's (scaled) coordinates: the Home hero centre of a window `height`
 * px tall — (+122, −173) at 1440 × 920. The horizontal offset is half the sidebar at any width.
 */
export function heroTarget(height: number, scale: number): { x: number; y: number } {
  const h = height > 0 ? height : AUTHORED.height;
  const s = scale > 0 ? scale : 1;
  return { x: HERO_FROM_CENTRE_X / s, y: (HERO_CENTRE_Y - h / 2) / s };
}

/** A fern frond: the one watermark image at a size, tilt, blur and depth (prototype 1522–1533). */
export interface Frond {
  left: number;
  bottom: number;
  height: number;
  rotate: number;
  blur: number;
  brightness: number;
  saturate: number;
  opacity: number;
  /** Sway −1.5° → 1.3°, alternating: duration and (negative) delay in seconds. */
  sway: number;
  delay: number;
}

export const LEFT_FRONDS: readonly Frond[] = [
  {
    left: 40,
    bottom: -170,
    height: 900,
    rotate: 3,
    blur: 3,
    brightness: 0.5,
    saturate: 1,
    opacity: 0.9,
    sway: 7.5,
    delay: -1,
  },
  {
    left: -150,
    bottom: -60,
    height: 700,
    rotate: -10,
    blur: 1.5,
    brightness: 0.62,
    saturate: 1,
    opacity: 0.9,
    sway: 6.5,
    delay: -3,
  },
  {
    left: 250,
    bottom: -130,
    height: 780,
    rotate: 7,
    blur: 0.5,
    brightness: 0.9,
    saturate: 1.1,
    opacity: 1,
    sway: 6,
    delay: -2,
  },
  {
    left: 430,
    bottom: -240,
    height: 560,
    rotate: 26,
    blur: 2.5,
    brightness: 0.68,
    saturate: 1,
    opacity: 0.95,
    sway: 5,
    delay: -0.5,
  },
];

/** The right wall: its own set, drawn mirrored (`scaleX(-1)`). */
export const RIGHT_FRONDS: readonly Frond[] = [
  {
    left: 70,
    bottom: -150,
    height: 860,
    rotate: 5,
    blur: 3,
    brightness: 0.48,
    saturate: 1,
    opacity: 0.9,
    sway: 8,
    delay: -4,
  },
  {
    left: -120,
    bottom: -40,
    height: 680,
    rotate: -8,
    blur: 1.5,
    brightness: 0.6,
    saturate: 1,
    opacity: 0.9,
    sway: 7,
    delay: -1.5,
  },
  {
    left: 270,
    bottom: -140,
    height: 760,
    rotate: 9,
    blur: 0.5,
    brightness: 0.88,
    saturate: 1.1,
    opacity: 1,
    sway: 6.4,
    delay: -3.2,
  },
  {
    left: 400,
    bottom: -230,
    height: 540,
    rotate: 24,
    blur: 2.5,
    brightness: 0.66,
    saturate: 1,
    opacity: 0.95,
    sway: 5.4,
    delay: -2.6,
  },
];

/**
 * A firefly (the prototype's `FLIES`): position in % of the scene, size and glow in px, drift and
 * twinkle durations and their shared (negative) delay in seconds.
 */
export interface Firefly {
  x: number;
  y: number;
  size: number;
  glow: number;
  drift: number;
  delay: number;
  twinkle: number;
}

export const FIREFLIES: readonly Firefly[] = [
  { x: 38, y: 44, size: 3, glow: 8, drift: 6.5, delay: -1, twinkle: 2.3 },
  { x: 61, y: 38, size: 2, glow: 6, drift: 7, delay: -3, twinkle: 3.1 },
  { x: 47, y: 63, size: 3, glow: 9, drift: 5.5, delay: -2, twinkle: 2.7 },
  { x: 55, y: 52, size: 2, glow: 6, drift: 8, delay: -4, twinkle: 1.9 },
  { x: 33, y: 57, size: 2, glow: 7, drift: 6, delay: -0.5, twinkle: 2.9 },
  { x: 66, y: 58, size: 3, glow: 8, drift: 7.5, delay: -2.5, twinkle: 2.1 },
  { x: 42, y: 34, size: 2, glow: 6, drift: 6.8, delay: -1.6, twinkle: 3.4 },
  { x: 58, y: 69, size: 2, glow: 7, drift: 5.8, delay: -3.5, twinkle: 2.5 },
  { x: 50, y: 29, size: 2, glow: 6, drift: 7.2, delay: -1.2, twinkle: 2.8 },
  { x: 29, y: 47, size: 2, glow: 6, drift: 6.3, delay: -2.8, twinkle: 3.2 },
  { x: 71, y: 46, size: 2, glow: 6, drift: 6.9, delay: -0.8, twinkle: 2.2 },
];
