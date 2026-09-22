import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryStorage, createMockServices } from "./mock";
import { ServicesProvider, createServices, getServices, useServices } from "./registry";

const mock = () => createMockServices({ latencyMs: 0, storage: createMemoryStorage() });

afterEach(() => vi.restoreAllMocks());

describe("services registry", () => {
  it("getServices throws before any set is installed", async () => {
    vi.resetModules();
    const fresh = await import("./registry");
    expect(() => fresh.getServices()).toThrow(/ServicesProvider/);
  });

  it("createServices builds a full set in both modes", () => {
    const names = ["account", "catalog", "channels", "downloads", "ideas", "install", "settings"];
    for (const mode of ["mock", "tauri"] as const) {
      const services = createServices(mode, { latencyMs: 0, storage: createMemoryStorage() });
      expect(Object.keys(services)).toEqual(expect.arrayContaining([...names, "system"]));
    }
  });

  it("ServicesProvider exposes the set to hooks and to getServices()", () => {
    const services = mock();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    const { result } = renderHook(() => useServices(), { wrapper });
    expect(result.current).toBe(services);
    expect(getServices()).toBe(services);
  });

  it("the set is available to children as they render", () => {
    const services = mock();
    function Probe() {
      return <span>{getServices() === services ? "same" : "other"}</span>;
    }
    render(
      <ServicesProvider services={services}>
        <Probe />
      </ServicesProvider>,
    );
    expect(screen.getByText("same")).toBeInTheDocument();
  });

  it("useServices outside a provider throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useServices())).toThrow(/ServicesProvider/);
  });
});
