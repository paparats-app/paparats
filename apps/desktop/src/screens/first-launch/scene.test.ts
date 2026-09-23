import { describe, expect, it } from "vitest";
import { FIRST_LAUNCH_PHASES } from "@/stores/useFirstLaunchStore";
import { FIREFLIES, heroTarget, LEFT_FRONDS, RIGHT_FRONDS, sceneFrame, sceneScale } from "./scene";

describe("sceneFrame (FIRST_LAUNCH_SPEC timeline, prototype `at([...])`)", () => {
  it("seed: ferns 90px low and transparent, flower at .1 and invisible", () => {
    expect(sceneFrame("seed")).toMatchObject({
      fernX: 0,
      fernY: 90,
      fernOpacity: 0,
      flowerScale: 0.1,
      flowerOpacity: 0,
      fliesOpacity: 0,
      skippable: true,
      panel: false,
      done: false,
    });
  });

  it("each phase moves the layers as the spec's table says", () => {
    const pick = (phase: (typeof FIRST_LAUNCH_PHASES)[number]) => {
      const f = sceneFrame(phase);
      return [f.fernX, f.fernRotate, f.fernY, f.fernOpacity, f.flowerScale, f.fliesOpacity];
    };
    expect(pick("fern")).toEqual([0, 0, 0, 1, 0.1, 0]);
    expect(pick("part")).toEqual([-360, -9, 0, 0.95, 0.28, 0.3]);
    expect(pick("bloom")).toEqual([-390, -10, 0, 0.9, 1, 1]);
    expect(pick("logo")).toEqual([-450, -12, 0, 0.72, 0.32, 1]);
    expect(pick("lang")).toEqual([-540, -15, 0, 0.5, 0.32, 0.55]);
    expect(pick("theme")).toEqual(pick("lang"));
    expect(pick("signin")).toEqual(pick("lang"));
    expect(pick("done")).toEqual([-820, -19, 40, 0, 2.6, 0]);
  });

  it("the flower sparks, blooms (ring), rises to the logo, then flies to the hero", () => {
    expect(sceneFrame("part")).toMatchObject({ flowerOpacity: 0.75, ring: false });
    expect(sceneFrame("bloom")).toMatchObject({ flowerOpacity: 1, ring: true, starOpacity: 1 });
    expect(sceneFrame("logo")).toMatchObject({
      flowerX: -7,
      flowerY: -265,
      starOpacity: 0,
      logoOpacity: 1,
      logoY: 0,
    });
    expect(sceneFrame("lang")).toMatchObject({ flowerOpacity: 0.95, panel: true, panelY: 0 });
    expect(sceneFrame("done")).toMatchObject({
      flowerX: 122,
      flowerY: -173,
      flowerOpacity: 0,
      ring: false,
      logoOpacity: 0,
      panel: false,
      done: true,
    });
    expect(sceneFrame("done", { x: 1, y: 2 })).toMatchObject({ flowerX: 1, flowerY: 2 });
  });

  it("only phases 0–4 can be skipped; steps show the panel", () => {
    const skippable = FIRST_LAUNCH_PHASES.filter((p) => sceneFrame(p).skippable);
    const panel = FIRST_LAUNCH_PHASES.filter((p) => sceneFrame(p).panel);
    expect(skippable).toEqual(["seed", "fern", "part", "bloom", "logo"]);
    expect(panel).toEqual(["lang", "theme", "signin"]);
  });
});

describe("scene geometry", () => {
  it("scales the 1440 × 920 layout uniformly to fit the window", () => {
    expect(sceneScale(1440, 920)).toBe(1);
    expect(sceneScale(1280, 800)).toBeCloseTo(800 / 920);
    expect(sceneScale(2880, 1840)).toBe(2);
    expect(sceneScale(0, 0)).toBe(1);
  });

  it("aims the exit at the Home hero centre: (+122, −173) at 1440 × 920", () => {
    expect(heroTarget(920, 1)).toEqual({ x: 122, y: -173 });
    // A taller window: the hero stays under the top bar, so the target is further up.
    const tall = heroTarget(1000, 1000 / 920);
    expect(tall.x * (1000 / 920)).toBeCloseTo(122);
    expect(tall.y * (1000 / 920)).toBeCloseTo(287 - 500);
  });

  it("has the prototype's eight fronds and eleven fireflies", () => {
    expect(LEFT_FRONDS).toHaveLength(4);
    expect(RIGHT_FRONDS).toHaveLength(4);
    for (const frond of [...LEFT_FRONDS, ...RIGHT_FRONDS]) {
      expect(frond.height).toBeGreaterThanOrEqual(540);
      expect(frond.height).toBeLessThanOrEqual(900);
      expect(frond.sway).toBeGreaterThanOrEqual(5);
      expect(frond.sway).toBeLessThanOrEqual(8);
    }
    expect(FIREFLIES).toHaveLength(11);
    for (const fly of FIREFLIES) {
      expect(fly.drift).toBeGreaterThanOrEqual(5.5);
      expect(fly.drift).toBeLessThanOrEqual(8);
      expect(fly.twinkle).toBeGreaterThanOrEqual(1.9);
      expect(fly.twinkle).toBeLessThanOrEqual(3.4);
    }
  });
});
