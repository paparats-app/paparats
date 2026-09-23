import { useTranslation } from "react-i18next";
import { toLocale } from "@/i18n/languages";
import type { Locale } from "@/services/types";

/**
 * The current UI language as a catalog locale — for picking catalog copy with
 * `pickText` / `pickLocalized` (the prototype's `L()`) and for locale-aware sorting.
 */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return toLocale(i18n.resolvedLanguage ?? i18n.language);
}
