// Mounted once by the app providers: keeps `useDownloadsStore` in sync with DownloadService and
// the service in sync with "Parallel downloads" and connectivity.
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { recordInstalled } from "@/domain/apps";
import { useOffline } from "@/hooks/useOffline";
import { queryKeys } from "@/queries";
import { useServices } from "@/services";
import type { Library } from "@/services/types";
import { useDownloadsStore } from "./useDownloadsStore";
import { useSettingsStore } from "./useSettingsStore";
import { useUiStore } from "./useUiStore";

export function useDownloadsBridge(): void {
  const { downloads, system } = useServices();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const parallel = useSettingsStore((s) => s.settings.parallel);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const offline = useOffline();

  // The event handler outlives renders; read the current language's `t` through a ref.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let alive = true;
    const store = useDownloadsStore.getState;
    const unsubscribe = downloads.subscribe((event) => {
      // Record an install in the cached library before the item leaves the queue, so no render
      // sees the app as neither downloading nor installed ("Get" flashing until the refetch).
      if (event.type === "state" && event.payload.phase.kind === "installed") {
        const entry = {
          appId: event.payload.appId,
          version: event.payload.phase.version,
          lastUsed: system.today(),
        };
        queryClient.setQueryData<Library>(queryKeys.library, (library) =>
          library ? recordInstalled(library, entry) : library,
        );
      }
      const outcome = store().applyEvent(event);
      if (outcome.unknown) void store().refresh();
      if (outcome.installed) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.library });
        void queryClient.invalidateQueries({ queryKey: queryKeys.account });
      }
      if (outcome.batchFinished) useUiStore.getState().notify(tRef.current("updates.allUpdated"));
    });
    downloads.getSnapshot().then(
      (snapshot) => {
        if (alive) store().applySnapshot(snapshot);
      },
      () => undefined,
    );
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [downloads, system, queryClient]);

  // The service starts with the persisted value; follow changes once settings are loaded.
  useEffect(() => {
    if (hydrated) downloads.setConcurrency(parallel).catch(() => undefined);
  }, [downloads, parallel, hydrated]);

  useEffect(() => {
    downloads.setOnline(!offline).catch(() => undefined);
  }, [downloads, offline]);
}
