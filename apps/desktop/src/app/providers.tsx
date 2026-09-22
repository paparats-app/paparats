// Context for the whole UI: TanStack Query, the service set, i18next, plus the app-wide effects
// that must run exactly once (download events, document settings, "Back online").
import { useEffect, useRef, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { I18nextProvider, useTranslation } from "react-i18next";
import { useOffline } from "@/hooks/useOffline";
import { i18n } from "@/i18n";
import { ServicesProvider, type Services } from "@/services";
import { useDownloadsBridge } from "@/stores/useDownloadsBridge";
import { useUiStore } from "@/stores/useUiStore";
import { useDocumentSettings } from "./documentSettings";

export interface AppProvidersProps {
  services: Services;
  queryClient: QueryClient;
  children?: ReactNode;
}

export function AppProviders({ services, queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>
        <I18nextProvider i18n={i18n}>
          <AppEffects />
          {children}
        </I18nextProvider>
      </ServicesProvider>
    </QueryClientProvider>
  );
}

function AppEffects() {
  useDownloadsBridge();
  useDocumentSettings();
  useBackOnlineToast();
  return null;
}

/** "Back online" toast when connectivity (real or simulated) returns. */
function useBackOnlineToast(): void {
  const offline = useOffline();
  const { t } = useTranslation();
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) useUiStore.getState().notify(t("common.backOnline"));
    wasOffline.current = offline;
  }, [offline, t]);
}
