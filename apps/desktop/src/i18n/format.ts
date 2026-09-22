import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useToday } from "@/hooks/useToday";
import { toLocale } from "./languages";
import { createFormat, type Format } from "./createFormat";

export { createFormat, type Format } from "./createFormat";

/** Formatters for the current UI language and the app's "today"; re-renders on language change. */
export function useFormat(): Format {
  const { i18n } = useTranslation();
  const today = useToday();
  const locale = toLocale(i18n.resolvedLanguage ?? i18n.language);
  return useMemo(() => createFormat(locale, today), [locale, today]);
}
