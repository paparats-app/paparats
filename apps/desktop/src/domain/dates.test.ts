import { addDays, addMonths, addYears, compareIso, daysBetween, parseIso, toIso } from "./dates";

describe("dates", () => {
  it("parses ISO dates at local noon", () => {
    const d = parseIso("2026-09-15");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 15, 12]);
    expect(toIso(d)).toBe("2026-09-15");
    expect(Number.isNaN(parseIso("garbage").getTime())).toBe(true);
  });

  it("counts whole days between dates, across DST changes", () => {
    expect(daysBetween("2026-08-30", "2026-09-15")).toBe(16);
    expect(daysBetween("2026-09-15", "2026-08-30")).toBe(-16);
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-10-20", "2026-11-05")).toBe(16);
  });

  it("adds days", () => {
    expect(addDays("2026-09-12", -23)).toBe("2026-08-20");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("adds months and years, clamping the day to the month's end", () => {
    expect(addMonths("2026-09-15", 1)).toBe("2026-10-15");
    expect(addMonths("2026-09-15", 3)).toBe("2026-12-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
    expect(addYears("2026-09-15", 1)).toBe("2027-09-15");
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
  });

  it("compares ISO dates", () => {
    expect(compareIso("2026-09-14", "2026-09-15")).toBeLessThan(0);
    expect(compareIso("2026-09-15", "2026-09-15")).toBe(0);
    expect(compareIso("2027-01-01", "2026-12-31")).toBeGreaterThan(0);
    expect(["2026-09-15", "2025-01-01", "2026-01-10"].sort(compareIso)).toEqual([
      "2025-01-01",
      "2026-01-10",
      "2026-09-15",
    ]);
  });
});
