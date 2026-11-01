// A background refresh of the catalog (the "Check for updates" schedule in the Rust core) brings
// new versions: reload the catalog, the platform file, the library and the channels, so the
// Updates badge and every list follow without a restart. Mounted once by the shell layout.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/queries/keys";
import { useServices } from "@/services/registry";

export function useCatalogRefreshes(): void {
  const { catalog } = useServices();
  const queryClient = useQueryClient();
  useEffect(
    () =>
      catalog.onChanged(() => {
        for (const queryKey of [
          queryKeys.catalog,
          queryKeys.platform,
          queryKeys.library,
          queryKeys.channels,
        ]) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }),
    [catalog, queryClient],
  );
}
