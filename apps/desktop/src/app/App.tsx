import { useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { createQueryClient } from "@/queries";
import type { Services } from "@/services";
import { AppProviders } from "./providers";
import { createAppRouter } from "./routes";

export interface AppProps {
  /** The service set `bootstrap()` installed. */
  services: Services;
  queryClient?: QueryClient;
  /** Memory-router history to start with (default `/home`). */
  initialEntries?: string[];
}

/** The whole UI: providers, then the router with the shell layout around every screen. */
export function App({ services, queryClient, initialEntries }: AppProps) {
  const [router] = useState(() => createAppRouter(initialEntries));
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <AppProviders services={services} queryClient={client}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
