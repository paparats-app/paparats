import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useServices } from "@/services/registry";
import type { AppId, Library } from "@/services/types";
import { queryKeys } from "./keys";

export function useLibrary(): UseQueryResult<Library> {
  const { install } = useServices();
  return useQuery({ queryKey: queryKeys.library, queryFn: () => install.getLibrary() });
}

export interface LibraryActions {
  setFavorite(appId: AppId, favorite: boolean): Promise<Library>;
  uninstall(appId: AppId): Promise<Library>;
  open(appId: AppId): Promise<void>;
  openInstallFolder(appId: AppId): Promise<void>;
}

export function useLibraryActions(): LibraryActions {
  const { install } = useServices();
  const queryClient = useQueryClient();
  return useMemo(() => {
    const write = async (pending: Promise<Library>) => {
      const library = await pending;
      queryClient.setQueryData(queryKeys.library, library);
      return library;
    };
    return {
      setFavorite: (appId, favorite) => write(install.setFavorite(appId, favorite)),
      uninstall: (appId) => write(install.uninstall(appId)),
      open: (appId) => install.open(appId),
      openInstallFolder: (appId) => install.openInstallFolder(appId),
    };
  }, [install, queryClient]);
}
