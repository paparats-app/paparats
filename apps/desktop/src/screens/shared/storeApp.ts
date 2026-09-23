// What a store card or row shows about an app besides its name: the prototype's `card()` fields
// (icon, tagline, category chip, source channel chip) and the action as a view.
import { useTranslation } from "react-i18next";
import type { AppActionView, AppIconSource, ChannelMark } from "@/components/AppCard";
import { pickLocalized } from "@/domain/text";
import { useChannelContext, useLocale, type AppAction } from "@/hooks";
import { OFFICIAL_CHANNEL, type App } from "@/services/types";

export interface StoreAppView {
  icon: AppIconSource;
  /** The tagline in the UI language. */
  tagline: string;
  /** The category chip label. */
  category: string;
  /** The source channel chip; absent when the app installs from the official catalog. */
  channel?: ChannelMark;
}

/** An app's card fields in the current language and channel context. */
export function useStoreAppView(app: App): StoreAppView {
  const { t } = useTranslation();
  const locale = useLocale();
  const channels = useChannelContext();
  const sourceId = channels.sourceOf(app);
  const source = sourceId === OFFICIAL_CHANNEL ? undefined : channels.byId[sourceId];
  return {
    icon: { mono: app.mono, tint: app.tint, iconUrl: app.iconUrl },
    tagline: pickLocalized(app.tagline, locale),
    category: t(`categories.items.${app.category}.label`),
    channel: source ? { name: source.name, tint: source.tint } : undefined,
  };
}

/** `useAppAction()` as the `action` of a card or row. */
export function toActionView(action: AppAction): AppActionView {
  return {
    label: action.label,
    tone: action.tone,
    disabled: action.disabled,
    onClick: action.run,
  };
}
