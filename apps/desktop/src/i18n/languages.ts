import type { Locale } from "@/services/types";

export type Language = { code: Locale; native: string };

/** UI languages in picker order, each named in its own language (never translated). */
export const LANGUAGES: readonly Language[] = [
  { code: "en", native: "English" },
  { code: "be", native: "Беларуская" },
  { code: "ru", native: "Русский" },
];

export function isLocale(value: string | undefined): value is Locale {
  return LANGUAGES.some((l) => l.code === value);
}

/** The UI locale for an i18next language code; anything unknown (e.g. `cimode`) → `en`. */
export function toLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : "en";
}
