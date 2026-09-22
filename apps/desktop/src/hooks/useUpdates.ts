import { useMemo } from "react";
import { pendingUpdates, totalUpdateMb } from "@/domain/apps";
import { useCatalog } from "@/queries";
import type { App } from "@/services/types";
import { useChannelContext } from "./useChannelContext";
import { useInstalledIndex } from "./useInstalledIndex";
import { useToday } from "./useToday";

export interface PendingUpdates {
  /** Catalog order. */
  apps: App[];
  count: number;
  /** Total update download size (manifest sizes), MB. */
  totalMb: number;
}

const NONE: PendingUpdates = { apps: [], count: 0, totalMb: 0 };

/** Installed apps with a newer catalog version from an active, reachable source channel. */
export function useUpdates(): PendingUpdates {
  const catalog = useCatalog().data;
  const installed = useInstalledIndex();
  const channels = useChannelContext();
  const today = useToday();

  return useMemo(() => {
    if (!catalog) return NONE;
    const apps = pendingUpdates(catalog.apps, installed, channels, today);
    return { apps, count: apps.length, totalMb: totalUpdateMb(apps, catalog.updates) };
  }, [catalog, installed, channels, today]);
}
