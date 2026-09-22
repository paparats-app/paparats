// Render helpers for component, screen and shell tests (docs/architecture.md §11): mock services
// with 0 ms latency and isolated settings storage, a fresh QueryClient, i18n in English and a
// memory router. Importing this module also registers the cleanup: after each test the tree is
// unmounted, the services it rendered with are disposed and global state is reset.
import type { ReactElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { App } from "@/app/App";
import { AppProviders } from "@/app/providers";
import { createTestServices, resetStores } from "@/hooks/testing";
import { changeLocale } from "@/i18n";
import { createQueryClient } from "@/queries";
import { setServices, type MockServices } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";

export { createTestServices, flush, resetStores } from "@/hooks/testing";

export interface RenderOptions {
  /** Default: fresh mock services (`createTestServices()`). */
  services?: MockServices;
  /** Initial route. */
  route?: string;
}

const rendered = new Set<MockServices>();

afterEach(async () => {
  cleanup();
  for (const services of rendered) services.dispose();
  rendered.clear();
  await resetApp();
});

/** Installs `services` and loads their settings, as `bootstrap()` does before the first render. */
async function prepare(services: MockServices): Promise<void> {
  rendered.add(services);
  setServices(services);
  await useSettingsStore.getState().hydrate();
}

/**
 * Renders `ui` under the app providers at `route` (default `/`). Every path renders `ui`, so
 * `useNav()` and `useParams()`-free screens work; navigation changes the location only.
 */
export async function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const services = options.services ?? createTestServices();
  await prepare(services);
  const queryClient = createQueryClient({ retry: false });
  const router = createMemoryRouter([{ path: "*", element: ui }], {
    initialEntries: [options.route ?? "/"],
  });
  const result = render(
    <AppProviders services={services} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, services, queryClient, router };
}

/** Renders the whole app (shell, routes) at `route` (default `/home`). */
export async function renderApp(options: RenderOptions = {}) {
  const services = options.services ?? createTestServices();
  await prepare(services);
  const queryClient = createQueryClient({ retry: false });
  const result = render(
    <App
      services={services}
      queryClient={queryClient}
      initialEntries={[options.route ?? "/home"]}
    />,
  );
  return { ...result, services, queryClient };
}

/** Undo what a test changed globally: stores, document attributes, language. */
export async function resetApp(): Promise<void> {
  resetStores();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.motion;
  await changeLocale("en");
}
