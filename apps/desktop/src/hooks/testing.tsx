// Test helpers for hooks and stores: mock services (0 ms latency, +10 % per download tick),
// a fresh QueryClient, i18n in English, and a reset for every store. Not exported by the barrel.
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import "@/i18n";
import { createQueryClient } from "@/queries";
import {
  createMemoryStorage,
  createMockServices,
  ServicesProvider,
  type MockServiceOptions,
  type MockServices,
  type Services,
} from "@/services";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useFirstLaunchStore } from "@/stores/useFirstLaunchStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { useIdeasStore } from "@/stores/useIdeasStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { useUpdatesStore } from "@/stores/useUpdatesStore";

export function createTestServices(options: MockServiceOptions = {}): MockServices {
  return createMockServices({
    latencyMs: 0,
    random: () => 1,
    storage: createMemoryStorage(),
    ...options,
  });
}

/** Renders `hook` under the service and query providers (fresh mock services by default). */
export function renderWithServices<T, S extends Services = MockServices>(hook: () => T, given?: S) {
  const services = given ?? (createTestServices() as Services as S);
  const queryClient = createQueryClient({ retry: false });
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>{children}</ServicesProvider>
    </QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), services, queryClient };
}

/** Advances fake timers inside `act` (also flushes promises and TanStack's notify batching). */
export function flush(ms = 0): Promise<void> {
  return act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

export function resetStores(): void {
  for (const store of [
    useBrowseStore,
    useDialogStore,
    useDownloadsStore,
    useFirstLaunchStore,
    useHomeStore,
    useIdeasStore,
    useLibraryStore,
    useProfileStore,
    useSettingsStore,
    useUiStore,
    useUpdatesStore,
  ] as const) {
    // Each store's own initial state (actions included).
    (store.setState as (s: unknown, replace: true) => void)(store.getInitialState(), true);
  }
}
