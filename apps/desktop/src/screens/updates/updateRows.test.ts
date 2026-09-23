import type { App } from "@/services/types";
import { updateRowApps } from "./updateRows";

const app = (id: string, channel?: string) => ({ id, channel }) as unknown as App;

describe("updateRowApps", () => {
  const catalog = [app("a"), app("b"), app("c"), app("d", "down")];
  const base = {
    catalog,
    pending: [] as App[],
    justUpdated: {},
    isInstalled: () => true,
    isReachable: (a: App) => a.channel !== "down",
  };

  it("lists pending updates in catalog order", () => {
    const rows = updateRowApps({ ...base, pending: [catalog[2] as App, catalog[0] as App] });
    expect(rows.map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("keeps apps updated just now while they are installed from a reachable source", () => {
    const rows = updateRowApps({
      ...base,
      pending: [catalog[2] as App],
      justUpdated: { b: true, d: true },
    });
    expect(rows.map((a) => a.id)).toEqual(["b", "c"]);
    const uninstalled = updateRowApps({
      ...base,
      justUpdated: { b: true },
      isInstalled: (id) => id !== "b",
    });
    expect(uninstalled).toEqual([]);
  });
});
