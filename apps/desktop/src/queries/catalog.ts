import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useServices } from "@/services/registry";
import type { Catalog, PlatformInfo } from "@/services/types";
import { queryKeys } from "./keys";

export function useCatalog(): UseQueryResult<Catalog> {
  const { catalog } = useServices();
  return useQuery({ queryKey: queryKeys.catalog, queryFn: () => catalog.getCatalog() });
}

export function usePlatform(): UseQueryResult<PlatformInfo> {
  const { catalog } = useServices();
  return useQuery({ queryKey: queryKeys.platform, queryFn: () => catalog.getPlatform() });
}
