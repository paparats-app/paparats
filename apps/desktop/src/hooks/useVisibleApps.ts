import { useMemo } from "react";
import { visibleApps } from "@/domain/channels";
import { useCatalog } from "@/queries";
import type { App } from "@/services/types";
import { useChannelContext } from "./useChannelContext";
import { useInstalledIndex } from "./useInstalledIndex";

const NONE: App[] = [];

/** Catalog apps whose channels are followed and switched on, plus every installed app. */
export function useVisibleApps(): App[] {
  const catalog = useCatalog().data;
  const ctx = useChannelContext();
  const installed = useInstalledIndex();
  return useMemo(
    () => (catalog ? visibleApps(catalog.apps, ctx, installed) : NONE),
    [catalog, ctx, installed],
  );
}
