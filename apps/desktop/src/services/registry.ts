// Picks the service implementation once at startup and hands it to React (`useServices()`) and to
// non-React code such as Zustand store actions (`getServices()`).
//
// The mock world (`./mock/**` and `fixtures/*.json`) is reached only through the dynamic import
// below, so it is a chunk of its own that a Tauri build never loads or parses. Keep it that way:
// no static import of `./mock` from anything the app's entry reaches (tests may import it freely).
import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";
import type { Services } from "./contracts";
import type { MockServiceOptions } from "./mock";
import { createTauriServices } from "./tauri";

export type ServicesMode = "mock" | "tauri";

/**
 * `tauri`: the Rust core; `mock`: in-memory fixtures with the prototype's timings, loaded on
 * demand (see `platform/runtime.ts` › `shouldUseMockServices`). `options` apply to the mock set
 * only: the core owns its timings, dates and storage.
 */
export async function createServices(
  mode: ServicesMode,
  options?: MockServiceOptions,
): Promise<Services> {
  if (mode === "tauri") return createTauriServices();
  const { createMockServices } = await import("./mock");
  return createMockServices(options);
}

let current: Services | null = null;

/** Makes `services` the set `getServices()` returns. `ServicesProvider` calls it. */
export function setServices(services: Services): void {
  current = services;
}

/** The active service set for code outside React. Throws before `setServices()`. */
export function getServices(): Services {
  if (!current) throw new Error("Services are not set: render <ServicesProvider> first");
  return current;
}

const ServicesContext = createContext<Services | null>(null);

export interface ServicesProviderProps {
  services: Services;
  children?: ReactNode;
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  // Set during render (idempotent) so store actions run from any child effect, layout effects
  // included, already see this set.
  setServices(services);
  return createElement(ServicesContext, { value: services }, children);
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices() must be used inside <ServicesProvider>");
  return services;
}
