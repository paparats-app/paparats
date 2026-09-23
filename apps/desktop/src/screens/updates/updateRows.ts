// Which apps the Updates list shows (the prototype's `updateRows` in `renderVals` "// updates");
// what a busy row says about its download is `screens/shared › downloadStatus`.
import { useMemo } from "react";
import { useChannelContext, useInstalledIndex, useUpdates } from "@/hooks";
import { useCatalog } from "@/queries";
import type { App, AppId } from "@/services/types";
import { useDownloadsStore } from "@/stores/useDownloadsStore";

export interface UpdateRowsInput {
  /** Catalog order. */
  catalog: readonly App[];
  /** Pending updates (`useUpdates().apps`). */
  pending: readonly App[];
  /** "Updated just now" markers. */
  justUpdated: Readonly<Record<AppId, true>>;
  isInstalled(appId: AppId): boolean;
  /** The app's source channel is switched on and answering. */
  isReachable(app: App): boolean;
}

/**
 * The rows of the Updates list in catalog order: every pending update, plus the apps marked
 * "Updated just now" that are still installed from a reachable source.
 */
export function updateRowApps({
  catalog,
  pending,
  justUpdated,
  isInstalled,
  isReachable,
}: UpdateRowsInput): App[] {
  const pendingIds = new Set(pending.map((app) => app.id));
  return catalog.filter(
    (app) =>
      pendingIds.has(app.id) ||
      (justUpdated[app.id] === true && isInstalled(app.id) && isReachable(app)),
  );
}

const NO_ROWS: App[] = [];

/** `updateRowApps` over the live catalog, library, channels and download store. */
export function useUpdateRows(): App[] {
  const catalog = useCatalog().data;
  const { apps: pending } = useUpdates();
  const justUpdated = useDownloadsStore((s) => s.justUpdated);
  const installed = useInstalledIndex();
  const channels = useChannelContext();

  return useMemo(() => {
    if (!catalog) return NO_ROWS;
    return updateRowApps({
      catalog: catalog.apps,
      pending,
      justUpdated,
      isInstalled: (appId) => installed.has(appId),
      isReachable: (app) => {
        const source = channels.sourceOf(app);
        return channels.isActive(source) && channels.downDays(source) === 0;
      },
    });
  }, [catalog, pending, justUpdated, installed, channels]);
}
