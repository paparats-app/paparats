// The offline banner's state and Retry (hooks/useConnectivity) over the mock services.
import { act } from "@testing-library/react";
import type { SystemService } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, flush, renderWithServices, resetStores } from "./testing";
import { useConnectivity } from "./useConnectivity";

beforeEach(() => {
  vi.useFakeTimers();
  resetStores();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const simulateOffline = (on: boolean) =>
  act(() => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, simulateOffline: on } }));
  });

/** Mock services whose network is up or down (`online`), with a way to change it later. */
function withNetwork(online: boolean) {
  const base = createTestServices();
  let up = online;
  let notify: (online: boolean) => void = () => undefined;
  const system: SystemService = {
    ...base.system,
    isOnline: () => up,
    onConnectivityChange: (listener) => {
      notify = listener;
      return () => undefined;
    },
  };
  const setOnline = (next: boolean) =>
    act(() => {
      up = next;
      notify(next);
    });
  return { services: { ...base, system }, setOnline };
}

async function retry(current: { retry: () => void }) {
  act(() => current.retry());
  await flush();
}

describe("useConnectivity", () => {
  it("is online by default; Retry then changes nothing", async () => {
    const { result } = renderWithServices(() => useConnectivity());
    expect(result.current.offline).toBe(false);
    await retry(result.current);
    expect(useUiStore.getState().toast).toBeNull();
    expect(useSettingsStore.getState().settings.simulateOffline).toBe(false);
  });

  it("Retry ends a simulated outage without a toast when the network is up", async () => {
    const { result } = renderWithServices(() => useConnectivity());
    simulateOffline(true);
    expect(result.current.offline).toBe(true);

    await retry(result.current);
    expect(useSettingsStore.getState().settings.simulateOffline).toBe(false);
    expect(result.current.offline).toBe(false);
    expect(useUiStore.getState().toast).toBeNull();
  });

  it("Retry during a real outage answers with the offline toast", async () => {
    const { services, setOnline } = withNetwork(false);
    const { result } = renderWithServices(() => useConnectivity(), services);
    expect(result.current.offline).toBe(true);

    await retry(result.current);
    expect(useUiStore.getState().toast?.message).toBe("You’re offline");
    expect(result.current.offline).toBe(true);

    setOnline(true);
    expect(result.current.offline).toBe(false);
  });

  it("Retry ends the simulation but still reports a real outage", async () => {
    const { services } = withNetwork(false);
    const { result } = renderWithServices(() => useConnectivity(), services);
    simulateOffline(true);

    await retry(result.current);
    expect(useSettingsStore.getState().settings.simulateOffline).toBe(false);
    expect(useUiStore.getState().toast?.message).toBe("You’re offline");
    expect(result.current.offline).toBe(true);
  });
});
