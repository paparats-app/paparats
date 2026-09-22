import i18next, { type InitOptions } from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "@/services/types";
import { LOCALES, resources } from "./resources";

export { LANGUAGES, isLocale, toLocale, type Language } from "./languages";
export { LOCALES } from "./resources";

const OPTIONS: InitOptions = {
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: [...LOCALES],
  // React escapes on render.
  interpolation: { escapeValue: false },
  // Resources are bundled, so init and changeLanguage complete synchronously.
  initAsync: false,
  react: { useSuspense: false },
};

/** The app's i18next instance, ready (in English) as soon as this module is imported. */
export const i18n = i18next.createInstance();
i18n.use(initReactI18next);
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
});
void i18n.init(OPTIONS);

/** Sets the UI language at startup (from settings). Safe to call more than once. */
export async function initI18n(locale: Locale): Promise<void> {
  if (!i18n.isInitialized) await i18n.init({ ...OPTIONS, lng: locale });
  await changeLocale(locale);
}

/** Switches every `t()` and `useFormat()` consumer to `locale`; completes synchronously. */
export async function changeLocale(locale: Locale): Promise<void> {
  if (i18n.language === locale) return;
  await i18n.changeLanguage(locale);
}
