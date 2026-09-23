// App page generators (prototype lines 2111–2127): rating, histogram, reviews and version history
// are derived deterministically from the app id until the catalog carries real data.
import type { App, IsoDate, Localized, Review, UpdateManifest } from "@/services/types";
import { addDays } from "./dates";
import { compareVersions } from "./versions";

/** Sum of the char codes of the id — the seed of every generator here. */
export function appHash(appId: string): number {
  return Array.from(appId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

/** Average rating 4.3–4.9, one decimal. */
export function rating(appId: string): number {
  return Math.round((4.3 + (appHash(appId) % 7) / 10) * 10) / 10;
}

/** Number of ratings, 120–1019. */
export function ratingsCount(appId: string): number {
  return 120 + ((appHash(appId) * 37) % 900);
}

export interface HistogramBar {
  stars: 5 | 4 | 3 | 2 | 1;
  /** Share of ratings, percent; the five bars add up to 100. */
  pct: number;
}

export function ratingHistogram(appId: string): HistogramBar[] {
  const five = 55 + (appHash(appId) % 16);
  const four = 20;
  const three = 7;
  const two = 3;
  return [
    { stars: 5, pct: five },
    { stars: 4, pct: four },
    { stars: 3, pct: three },
    { stars: 2, pct: two },
    { stars: 1, pct: 100 - five - four - three - two },
  ];
}

/** Three reviews from the shared pool: `pool[(h + 2i) % n]`. */
export function pickReviews(appId: string, pool: readonly Review[]): Review[] {
  if (pool.length === 0) return [];
  const h = appHash(appId);
  return [0, 1, 2].flatMap((i) => pool[(h + i * 2) % pool.length] ?? []);
}

/**
 * Steps a dotted version back by `d` in its last segment, borrowing in base 10:
 * `bump("1.93.0", 1)` → `1.92.9`. Non-numeric versions are returned unchanged.
 */
export function bumpVersion(version: string, d: number): string {
  const parts = version.split(".").map(Number);
  if (parts.some(Number.isNaN)) return version;
  let i = parts.length - 1;
  parts[i] = (parts[i] ?? 0) - d;
  while (i > 0 && (parts[i] ?? 0) < 0) {
    parts[i] = (parts[i] ?? 0) + 10;
    parts[i - 1] = (parts[i - 1] ?? 0) - 1;
    i--;
  }
  if ((parts[0] ?? 0) < 0) parts[0] = 0;
  return parts.join(".");
}

export interface VersionEntry {
  version: string;
  date: IsoDate;
  sizeMb: number;
  /** The catalog's latest version (first entry). */
  isCurrent: boolean;
  /** An older version that is the one installed on this PC. */
  isInstalled: boolean;
  notes: Localized<string[]>;
}

const HISTORY_DAYS_BACK = [0, 23, 51, 88] as const;

function reversed(notes: Localized<string[]>): Localized<string[]> {
  return { en: [...notes.en].reverse(), be: [...notes.be].reverse(), ru: [...notes.ru].reverse() };
}

/**
 * Four entries, newest first. Entry 0 is the catalog version with the manifest's notes; the rest
 * step the version back, shift the date back 23/51/88 days, shrink the size by 2 % per step and
 * alternate the generic notes (reversed on even steps).
 */
export function versionHistory(
  app: App,
  manifest: UpdateManifest | undefined,
  genericNotes: Localized<string[]>,
  installedVersion?: string | null,
): VersionEntry[] {
  return HISTORY_DAYS_BACK.map((daysBack, i) => {
    const version = i === 0 ? app.version : bumpVersion(app.version, i);
    const notes =
      i === 0 && manifest ? manifest.notes : i % 2 ? genericNotes : reversed(genericNotes);
    return {
      version,
      date: i === 0 ? app.updated : addDays(app.updated, -daysBack),
      sizeMb: Math.max(1, Math.round(app.sizeMb * (1 - i * 0.02))),
      isCurrent: i === 0,
      isInstalled:
        i !== 0 && installedVersion != null && compareVersions(installedVersion, version) === 0,
      notes,
    };
  });
}
