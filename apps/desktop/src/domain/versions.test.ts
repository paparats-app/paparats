import { describe, expect, it } from "vitest";
import { compareVersions, isNewer } from "./versions";

// The same cases as the core's `paparats_inventory::version` tests: both sides must agree.
describe("compareVersions", () => {
  it("compares dotted numeric versions numerically", () => {
    expect(isNewer("1.4.1.1028", "1.4.1.1027")).toBe(true);
    expect(isNewer("1.4.1.1028", "1.4.1")).toBe(true);
    expect(isNewer("1.4.1.1028", "1.4.1.1028")).toBe(false);
    expect(isNewer("1.93.0", "1.92.2")).toBe(true);
    expect(isNewer("1.8.10", "1.8.9")).toBe(true);
    expect(isNewer("146", "145")).toBe(true);
    expect(isNewer("4.120", "4.12")).toBe(true);
    expect(isNewer("2026.8.1", "2026.7.30")).toBe(true);
    expect(isNewer("1.10", "1.9")).toBe(true);
    expect(isNewer("1.9", "1.10")).toBe(false);
  });

  it("ignores leading zeros and treats missing components as 0", () => {
    expect(compareVersions("25.01", "25.1")).toBe(0);
    expect(isNewer("25.02", "25.01")).toBe(true);
    expect(isNewer("25.02.4", "25.2.3")).toBe(true);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(isNewer("1.0.0", "1")).toBe(false);
    expect(isNewer("1.0.1", "1")).toBe(true);
    expect(isNewer("100000000000000000000001", "100000000000000000000000")).toBe(true);
  });

  it("handles prefixes, build metadata, suffixes and pre-releases", () => {
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.3+build.7", "1.2.3")).toBe(0);
    expect(isNewer("2.0.0", "2.0.0-rc.1")).toBe(true);
    expect(isNewer("2.0.0-rc.2", "2.0.0-rc.1")).toBe(true);
    expect(isNewer("2.0.0-rc.10", "2.0.0-rc.9")).toBe(true);
    expect(isNewer("2.0.0-beta", "2.0.0-alpha")).toBe(true);
    expect(isNewer("2.0.0-alpha.beta", "2.0.0-alpha.1")).toBe(true);
    expect(isNewer("2.0.0-alpha.1", "2.0.0-alpha")).toBe(true);
    expect(isNewer("1.2", "1.2a")).toBe(true);
    expect(isNewer("1.2b", "1.2a")).toBe(true);
    expect(isNewer("1.3a", "1.2")).toBe(true);
  });

  it("reads what the real inventory reports", () => {
    expect(compareVersions("2026.8.1.0", "2026.8.1")).toBe(0);
    expect(compareVersions("5.2.9.0", "5.2.9")).toBe(0);
    expect(isNewer("5.2.9.1", "5.2.9")).toBe(true);
    expect(isNewer("0.100.2", "0.94.0")).toBe(true);
    // A newer installed release than the catalog's is not an update.
    expect(isNewer("1.93.0", "1.121.0")).toBe(false);
    expect(isNewer("25.01", "24.09")).toBe(true);
    expect(compareVersions("24.09", "24.9")).toBe(0);
    expect(compareVersions("4.1.1+40101", "4.1.1")).toBe(0);
    expect(isNewer("3.7.4", "3.7.4-beta.1")).toBe(true);
  });

  it("is antisymmetric", () => {
    const pairs: [string, string][] = [
      ["1.2", "1.10"],
      ["2.0.0-rc.1", "2.0.0"],
      ["1.2a", "1.2"],
    ];
    for (const [a, b] of pairs) expect(compareVersions(a, b)).toBe(-compareVersions(b, a));
  });
});
