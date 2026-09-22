// Typed, language-aware sample data for the composite gallery sections (fixtures/*.json; JSON
// imports widen literal unions to string, hence the casts).
import catalogJson from "@fixtures/catalog.json";
import channelsJson from "@fixtures/channels.json";
import ideasJson from "@fixtures/ideas.json";
import libraryJson from "@fixtures/library.json";
import metaJson from "@fixtures/meta.json";
import platformJson from "@fixtures/platform.json";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AppIconSource } from "@/components/AppCard";
import { pickLocalized, pickText } from "@/domain/text";
import { createFormat, type Format } from "@/i18n/createFormat";
import { toLocale } from "@/i18n/languages";
import type {
  App,
  Catalog,
  ChannelInfo,
  Idea,
  IsoDate,
  Library,
  Locale,
  Localized,
  PlatformInfo,
  Text,
} from "@/services/types";

export const CATALOG = catalogJson as unknown as Catalog;
export const LIBRARY = libraryJson as unknown as Library;
export const CHANNELS = (channelsJson as unknown as { channels: ChannelInfo[] }).channels;
export const IDEAS = (ideasJson as unknown as { ideas: Idea[] }).ideas;
export const PLATFORM = platformJson as unknown as PlatformInfo;
export const TODAY: IsoDate = metaJson.today;

const FALLBACK_APP = CATALOG.apps[0] as App;
const FALLBACK_CHANNEL = CHANNELS[0] as ChannelInfo;

export function app(id: string): App {
  return CATALOG.apps.find((a) => a.id === id) ?? FALLBACK_APP;
}

export function channel(id: string): ChannelInfo {
  return CHANNELS.find((c) => c.id === id) ?? FALLBACK_CHANNEL;
}

export function iconOf(item: {
  mono: string;
  tint: string;
  iconUrl?: string | null;
}): AppIconSource {
  return { mono: item.mono, tint: item.tint, iconUrl: item.iconUrl };
}

export interface Sample {
  locale: Locale;
  format: Format;
  text: (value: Text | Localized<string>) => string;
  pick: <T>(value: Localized<T>) => T;
}

/** Locale, formatter (fixture "today") and text picker that follow the gallery language. */
export function useSample(): Sample {
  const { i18n } = useTranslation();
  const locale = toLocale(i18n.language);
  return useMemo(
    () => ({
      locale,
      format: createFormat(locale, TODAY),
      text: (value: Text | Localized<string>) => pickText(value, locale),
      pick: <T>(value: Localized<T>) => pickLocalized(value, locale),
    }),
    [locale],
  );
}

/** Content-column widths at the 1440×920 design size. */
export const WIDTH = {
  /** Full content column (1440 − 244 sidebar − 2 × 30 padding). */
  content: 1136,
  /** Browse main column (content − 220 filter panel − 24 gap). */
  browse: 892,
  /** Library / Subscription main column (content − 250 − 24). */
  library: 862,
  /** Settings panel (content − 250 nav − 20). */
  settings: 866,
  /** Updates main column (content − 340 − 24). */
  updates: 772,
  /** Ideas main column (content − 290 − 24). */
  ideas: 822,
  /** Profile main column (content − 400 − 24). */
  profile: 712,
} as const;

/** No-op handler for specimens whose action is not demonstrated. */
export const noop = (): void => undefined;
