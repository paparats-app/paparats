// Public API of the service layer. Screens and components do not use services directly: they go
// through queries/, stores/ and hooks/ (docs/architecture.md §2).
export type * from "./contracts";
export * from "./types";
export { ServiceError, isServiceError } from "./errors";
export {
  createServices,
  getServices,
  setServices,
  ServicesProvider,
  useServices,
} from "./registry";
export type { ServicesMode, ServicesProviderProps } from "./registry";
export { createMockServices, createMemoryStorage, FIXTURE_TODAY } from "./mock";
export type { MockServices, MockServiceOptions } from "./mock";
export { createTauriServices } from "./tauri";
