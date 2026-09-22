import { en } from "./locales/en";
import { be } from "./locales/be";
import { ru } from "./locales/ru";

/** i18next resources: one `translation` namespace per language, grouped by screen inside. */
export const resources = {
  en: { translation: en },
  be: { translation: be },
  ru: { translation: ru },
} as const;

export const LOCALES = ["en", "be", "ru"] as const;
