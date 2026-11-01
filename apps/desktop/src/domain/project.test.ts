import { describe, expect, it } from "vitest";
import { fundingName, projectAge, repoUrl } from "./project";

describe("projectAge", () => {
  it("counts whole months, then years", () => {
    expect(projectAge("2026-10-15", "2026-11-01")).toEqual({ unit: "new" });
    expect(projectAge("2026-09-30", "2026-11-01")).toEqual({ unit: "months", count: 1 });
    expect(projectAge("2026-04-01", "2026-11-01")).toEqual({ unit: "months", count: 7 });
    expect(projectAge("2025-11-02", "2026-11-01")).toEqual({ unit: "months", count: 11 });
    expect(projectAge("2025-11-01", "2026-11-01")).toEqual({ unit: "years", count: 1 });
    expect(projectAge("2018-03-10", "2026-11-01")).toEqual({ unit: "years", count: 8 });
  });

  it("treats a date it cannot read as new", () => {
    expect(projectAge("", "2026-11-01")).toEqual({ unit: "new" });
    expect(projectAge("2027-01-01", "2026-11-01")).toEqual({ unit: "new" });
  });
});

describe("fundingName", () => {
  it("names the usual services and falls back to the host", () => {
    expect(fundingName("https://github.com/sponsors/someone")).toBe("GitHub Sponsors");
    expect(fundingName("https://www.patreon.com/x")).toBe("Patreon");
    expect(fundingName("https://ko-fi.com/x")).toBe("Ko-fi");
    expect(fundingName("https://example.org/donate")).toBe("example.org");
    expect(fundingName("not a url")).toBe("not a url");
  });

  it("builds the repository link", () => {
    expect(repoUrl("owner/name")).toBe("https://github.com/owner/name");
  });
});
