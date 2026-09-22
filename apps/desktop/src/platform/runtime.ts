/** Whether the UI runs inside the Tauri shell (as opposed to a plain browser / Vitest). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Mock services are used in a plain browser, in tests, and when `PAPARATS_MOCK=1`. */
export function useMockServices(): boolean {
  return __PAPARATS_MOCK__ || !isTauri();
}
