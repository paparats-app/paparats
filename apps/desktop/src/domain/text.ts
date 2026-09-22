// Localised text helpers (the prototype's `L()` and the avatar initials).
import type { Locale, Localized, Text } from "@/services/types";

/** The value for `locale`, falling back to English. */
export function pickLocalized<T>(value: Localized<T>, locale: Locale): T {
  return value[locale] ?? value.en;
}

/** Catalog text (one value per language) or user text (written once, shown as typed). */
export function pickText(text: Text | Localized<string>, locale: Locale): string {
  return typeof text === "string" ? text : pickLocalized(text, locale);
}

/** First letters of the first two words, upper-cased: "Serj Kaje" → "SK", "Alena K." → "AK". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}
