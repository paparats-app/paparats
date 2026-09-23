import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useToday } from "@/hooks/useToday";
import { toLocale } from "./languages";
import { createFormat, createNumberFormat, type Format, type NumberFormat } from "./createFormat";

export { createFormat, createNumberFormat, type Format, type NumberFormat } from "./createFormat";

/** Formatters for the current UI language and the app's "today"; re-renders on language change. */
export function useFormat(): Format {
  const { i18n } = useTranslation();
  const today = useToday();
  const locale = toLocale(i18n.resolvedLanguage ?? i18n.language);
  return useMemo(() => createFormat(locale, today), [locale, today]);
}

/**
 * The number formatters of `useFormat()` (same Belarusian fallback) without its "today", so
 * presentational components can use them without the services context.
 */
export function useNumberFormat(): NumberFormat {
  const { i18n } = useTranslation();
  const locale = toLocale(i18n.resolvedLanguage ?? i18n.language);
  return useMemo(() => createNumberFormat(locale), [locale]);
}
