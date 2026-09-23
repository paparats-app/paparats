// One Library app as a row / grid card sees it: the prototype's `card()` plus the Library fields
// (`libraryRows` in `renderVals`, line 1966) and the ⋯ menu actions (lines 1892–1894).
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import type { AppActionView, AppIconSource, ChannelMark } from "@/components/AppCard";
import { isBusy } from "@/domain/apps";
import { useAppAction, useInstalledIndex } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useLibrary, useLibraryActions } from "@/queries";
import { toActionView, useDownloadStatus, useStoreAppView } from "@/screens/shared";
import type { App } from "@/services/types";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useUiStore } from "@/stores/useUiStore";

export interface LibraryItemView {
  icon: AppIconSource;
  tagline: string;
  /** Category + Pro / Portable / license. */
  tags: [string, string];
  /** Source channel chip (non-official sources). */
  channel?: ChannelMark;
  favorite: boolean;
  action: AppActionView;
  /** In the download queue: the 2px bar shows `progress` and the status lines the download. */
  busy: boolean;
  progress: number;
  /** List row, first line: installed version, or "Downloading… 43%" / "Paused · 43%" / … */
  status: string;
  /** List row, second line: "Updated 3 days ago", "Update → 1.93.0" or "12 MB of 87 MB". */
  statusSub: string;
  statusTone: "default" | "mint";
  /** Grid card: "1.8.9 · Updated yesterday", or the download line while busy. */
  gridSub: string;
  menuOpen: boolean;
  setMenuOpen(open: boolean): void;
  open(): void;
  toggleFavorite(): void;
  openFolder(): void;
  uninstall(): void;
}

const ignore = () => undefined;

export function useLibraryItem(app: App): LibraryItemView {
  const { t } = useTranslation();
  const format = useFormat();
  const { go } = useNav();
  const view = useStoreAppView(app);
  const action = useAppAction(app);
  const installed = useInstalledIndex().get(app.id);
  const favorite = useLibrary().data?.favorites.includes(app.id) ?? false;
  const actions = useLibraryActions();
  const clearJustUpdated = useDownloadsStore((s) => s.clearJustUpdated);
  const menuOpen = useLibraryStore((s) => s.menuFor === app.id);
  const toggleMenu = useLibraryStore((s) => s.toggleMenu);
  const closeMenu = useLibraryStore((s) => s.closeMenu);
  const notify = useUiStore((s) => s.notify);

  const { state, progress } = action;
  const busy = isBusy(state);
  // The prototype's `dlLine` / `dlSize`: the size stays on the second line while paused, as there.
  const download = useDownloadStatus(app, state, progress);

  const lastUsed = installed
    ? t("common.updatedRel", { when: format.relative(installed.lastUsed) })
    : "";
  const hasUpdate = state === "update";
  let statusSub: string = lastUsed;
  if (busy) statusSub = download?.size ?? "";
  else if (hasUpdate) statusSub = `${t("common.update")} → ${app.version}`;

  let license: string = app.license;
  if (app.pro) license = t("common.pro");
  else if (app.portable) license = t("common.portable");

  return {
    icon: view.icon,
    tagline: view.tagline,
    tags: [view.category, license],
    channel: view.channel,
    favorite,
    action: toActionView(action),
    busy,
    progress,
    status: busy ? (download?.line ?? "") : (installed?.version ?? ""),
    statusSub,
    statusTone: hasUpdate ? "mint" : "default",
    gridSub: busy ? (download?.line ?? "") : `${installed?.version ?? ""} · ${lastUsed}`,
    menuOpen,
    setMenuOpen(open) {
      if (open !== menuOpen) {
        if (open) toggleMenu(app.id);
        else closeMenu();
      }
    },
    open: () => go({ to: "app", appId: app.id }),
    toggleFavorite() {
      closeMenu();
      actions.setFavorite(app.id, !favorite).catch(ignore);
    },
    openFolder() {
      closeMenu();
      actions.openInstallFolder(app.id).catch(ignore);
    },
    uninstall() {
      closeMenu();
      actions.uninstall(app.id).then(() => {
        clearJustUpdated(app.id);
        notify(t("common.uninstalled", { app: app.name }));
      }, ignore);
    },
  };
}
