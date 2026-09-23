import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { AppCard } from "@/components/AppCard";
import { useAppAction } from "@/hooks";
import type { App } from "@/services/types";
import { toActionView, useStoreAppView } from "./storeApp";

export interface StoreAppCardProps {
  app: App;
  /**
   * The category chip and, for apps from a non-official channel, the source channel chip. On by
   * default; off on Categories › "Featured in …" (prototype line 441).
   */
  chips?: boolean;
  /**
   * The source channel chip alone (with `chips` on). On by default; off on the channel page,
   * whose cards show only the category chip (prototype line 1166).
   */
  channelChip?: boolean;
}

/**
 * A store grid `AppCard` wired to the app (Home, Browse, Categories, Search, the app page's
 * "More in"): the primary action from `useAppAction()` (Get / Open / Update / Subscribe /
 * Offline / Queued / progress); the icon/text area and the chevron-down part open the app page.
 * Prototype lines 224–233 (the same card repeats on Browse, Categories, search and the app page;
 * `card()` in the logic).
 */
export function StoreAppCard({ app, chips = true, channelChip = true }: StoreAppCardProps) {
  const { t } = useTranslation();
  const { go } = useNav();
  const action = useAppAction(app);
  const view = useStoreAppView(app);
  const open = () => go({ to: "app", appId: app.id });

  return (
    <AppCard
      name={app.name}
      icon={view.icon}
      tagline={view.tagline}
      category={chips ? view.category : undefined}
      channel={chips && channelChip ? view.channel : undefined}
      action={toActionView(action)}
      secondary={{ label: t("common.details"), icon: "chevron-down", onClick: open }}
      onOpen={open}
    />
  );
}
