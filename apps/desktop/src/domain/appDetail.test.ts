import {
  appHash,
  bumpVersion,
  pickReviews,
  rating,
  ratingHistogram,
  ratingsCount,
  versionHistory,
} from "./appDetail";
import { manifestOf } from "./apps";
import { appById, catalog } from "./testFixtures";

describe("generators seeded by the app id", () => {
  it("hashes the id as the sum of its char codes", () => {
    expect(appHash("obsidian")).toBe(841);
    expect(appHash("vscode")).toBe(644);
    expect(appHash("")).toBe(0);
  });

  it("derives rating and ratings count", () => {
    expect(rating("obsidian")).toBe(4.4);
    expect(rating("vscode")).toBe(4.3);
    expect(rating("shell")).toBe(4.7);
    expect(ratingsCount("obsidian")).toBe(637);
    expect(ratingsCount("shell")).toBe(152);
  });

  it("builds a 5→1 histogram that adds up to 100", () => {
    const bars = ratingHistogram("obsidian");
    expect(bars.map((b) => b.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(bars.map((b) => b.pct)).toEqual([64, 20, 7, 3, 6]);
    for (const id of ["vscode", "shell", "czkawka", "a"]) {
      expect(ratingHistogram(id).reduce((s, b) => s + b.pct, 0)).toBe(100);
    }
  });

  it("picks three reviews from the pool", () => {
    const pool = catalog.reviewPool;
    expect(pickReviews("obsidian", pool).map((r) => r.author)).toEqual([
      "Dzmitry P.",
      "Ihar V.",
      "Pavel R.",
    ]);
    expect(pickReviews("vscode", pool).map((r) => r.author)).toEqual([
      "Maria S.",
      "Kasia L.",
      "Alena K.",
    ]);
    expect(pickReviews("vscode", [])).toEqual([]);
  });
});

describe("version history", () => {
  it("steps versions back with base-10 borrowing", () => {
    expect(bumpVersion("1.93.0", 1)).toBe("1.92.9");
    expect(bumpVersion("1.8.10", 3)).toBe("1.8.7");
    expect(bumpVersion("25.01", 3)).toBe("24.8");
    expect(bumpVersion("0.0.1", 3)).toBe("0.9.8");
    expect(bumpVersion("2.0.0-beta", 1)).toBe("2.0.0-beta");
  });

  it("builds four entries like the prototype", () => {
    const vscode = appById("vscode");
    const history = versionHistory(
      vscode,
      manifestOf(catalog.updates, "vscode"),
      catalog.genericNotes,
      "1.92.9",
    );
    expect(history.map((v) => v.version)).toEqual(["1.93.0", "1.92.9", "1.92.8", "1.92.7"]);
    expect(history.map((v) => v.date)).toEqual([
      "2026-09-12",
      "2026-08-20",
      "2026-07-23",
      "2026-06-16",
    ]);
    expect(history.map((v) => v.sizeMb)).toEqual([95, 93, 91, 89]);
    expect(history.map((v) => v.isCurrent)).toEqual([true, false, false, false]);
    expect(history.map((v) => v.isInstalled)).toEqual([false, true, false, false]);
  });

  it("uses the manifest notes for the latest version and alternates the generic notes", () => {
    const vscode = appById("vscode");
    const manifest = manifestOf(catalog.updates, "vscode");
    const gen = catalog.genericNotes;
    const history = versionHistory(vscode, manifest, gen);
    expect(history[0]?.notes).toBe(manifest?.notes);
    expect(history[1]?.notes).toBe(gen);
    expect(history[2]?.notes.ru).toEqual([...gen.ru].reverse());
    expect(history[3]?.notes).toBe(gen);
    expect(history.every((v) => !v.isInstalled)).toBe(true);

    const noManifest = versionHistory(appById("everything"), undefined, gen);
    expect(noManifest[0]?.notes.en).toEqual([...gen.en].reverse());
    expect(noManifest.map((v) => v.sizeMb)).toEqual([2, 2, 2, 2]);
  });

  it("never marks the current version as the installed older one", () => {
    const flow = appById("flow");
    expect(
      versionHistory(flow, undefined, catalog.genericNotes, flow.version)[0]?.isInstalled,
    ).toBe(false);
  });
});
