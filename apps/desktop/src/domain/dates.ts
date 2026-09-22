// `YYYY-MM-DD` arithmetic. Dates are parsed at local noon so DST shifts never move the day.
import type { IsoDate } from "@/services/types";

const DAY_MS = 86_400_000;

/** `2026-09-15` → a `Date` at 12:00 local time. Invalid input gives an invalid `Date`. */
export function parseIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return new Date(Number.NaN);
  return new Date(y, m - 1, d, 12);
}

/** A `Date` → `YYYY-MM-DD` in local time. */
export function toIso(date: Date): IsoDate {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso: IsoDate, toIsoDate: IsoDate): number {
  return Math.round((parseIso(toIsoDate).getTime() - parseIso(fromIso).getTime()) / DAY_MS);
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const date = parseIso(iso);
  date.setDate(date.getDate() + n);
  return toIso(date);
}

/** Calendar months; the day is clamped to the target month (Jan 31 + 1 → Feb 28). */
export function addMonths(iso: IsoDate, n: number): IsoDate {
  const date = parseIso(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + n);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toIso(date);
}

export function addYears(iso: IsoDate, n: number): IsoDate {
  return addMonths(iso, n * 12);
}

/** Sort comparator for ISO dates: negative when `a` is earlier. */
export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
