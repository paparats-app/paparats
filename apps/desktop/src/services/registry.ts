// Picks the service implementation once at startup and hands it to React (`useServices()`) and to
// non-React code such as Zustand store actions (`getServices()`).
import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";
import type { Services } from "./contracts";
import { createMockServices } from "./mock";
import type { MockServiceOptions } from "./mock";
import { createTauriServices } from "./tauri";

export type ServicesMode = "mock" | "tauri";

/** `mock`: in-memory fixtures; `tauri`: the Rust core (see `platform/runtime.ts` › `shouldUseMockServices`). */
export function createServices(mode: ServicesMode, options?: MockServiceOptions): Services {
  return mode === "mock" ? createMockServices(options) : createTauriServices(options);
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
