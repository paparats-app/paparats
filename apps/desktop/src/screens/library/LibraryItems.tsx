import { useTranslation } from "react-i18next";
import { LibraryGridCard, LibraryRow } from "@/components/AppListItem";
import type { App } from "@/services/types";
import { useLibraryItem } from "./useLibraryItem";

/**
 * A Library list row wired to the app (prototype lines 599–615): opens the app page, runs the
 * app action (Open / Update / Pause / Resume …), the ⋯ menu (favourite, install folder,
 * uninstall) and the 2px progress bar while the app is in the download queue.
 */
export function LibraryAppRow({ app }: { app: App }) {
  const { t } = useTranslation();
  const item = useLibraryItem(app);
  return (
    <LibraryRow
      name={app.name}
      icon={item.icon}
      tagline={item.tagline}
      favorite={item.favorite}
      tags={item.tags}
      channel={item.channel}
      status={item.status}
      statusSub={item.statusSub}
      statusTone={item.statusTone}
      action={item.action}
      progress={item.busy ? item.progress : undefined}
      onOpen={item.open}
      onToggleFavorite={item.toggleFavorite}
      onOpenFolder={item.openFolder}
      onUninstall={item.uninstall}
      moreLabel={t("library.moreActionsFor", { app: app.name })}
      menuOpen={item.menuOpen}
      onMenuOpenChange={item.setMenuOpen}
    />
  );
}

/** A Library grid card wired to the app: the same action and a favourite toggle (lines 622–629). */
export function LibraryAppCard({ app }: { app: App }) {
  const item = useLibraryItem(app);
  return (
    <LibraryGridCard
      name={app.name}
      icon={item.icon}
      subtitle={item.gridSub}
      action={item.action}
      favorite={item.favorite}
      onToggleFavorite={item.toggleFavorite}
      onOpen={item.open}
      progress={item.busy ? item.progress : undefined}
    />
  );
}
