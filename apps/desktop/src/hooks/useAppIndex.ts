import { useMemo } from "react";
import { useCatalog } from "@/queries";
import type { App, AppId } from "@/services/types";

export interface AppIndex {
  byId: Readonly<Record<AppId, App>>;
  get(id: AppId | null | undefined): App | undefined;
}

/** Lookup over the full catalog (visible or not). Empty while the catalog loads. */
export function useAppIndex(): AppIndex {
  const catalog = useCatalog().data;
  return useMemo(() => {
    const byId: Record<AppId, App> = Object.fromEntries(
      (catalog?.apps ?? []).map((app) => [app.id, app]),
    );
    return {
      byId,
      get: (id) => (id != null && Object.hasOwn(byId, id) ? byId[id] : undefined),
    };
  }, [catalog]);
}
