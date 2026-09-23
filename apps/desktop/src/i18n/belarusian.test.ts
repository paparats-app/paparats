import { describe, expect, it, vi } from "vitest";
import type * as belarusianModule from "./belarusian";
import { belarusian, hasLocaleData } from "./belarusian";
import { createFormat } from "./createFormat";

// Node's full ICU has the `be` data Chromium lacks: it is the oracle for the hand-written patterns.
vi.mock("./belarusian", async (importOriginal) => {
  const actual = await importOriginal<typeof belarusianModule>();
  return { ...actual, hasLocaleData: vi.fn(actual.hasLocaleData) };
});

const TODAY = "2026-09-15";
const intl = {
  size: new Intl.NumberFormat("be", { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }),
  gb: new Intl.NumberFormat("be", {
    style: "unit",
    unit: "gigabyte",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
  number: new Intl.NumberFormat("be"),
  percent: new Intl.NumberFormat("be", { style: "percent", maximumFractionDigits: 0 }),
  date: new Intl.DateTimeFormat("be", { day: "numeric", month: "long", year: "numeric" }),
  month: new Intl.DateTimeFormat("be", { month: "long", year: "numeric" }),
  relative: new Intl.RelativeTimeFormat("be", { numeric: "auto" }),
  list: new Intl.ListFormat("be", { style: "long", type: "conjunction" }),
};

describe("Belarusian formatting without ICU data", () => {
  it("detects whether the runtime has a locale's own data", () => {
    expect(hasLocaleData("ru")).toBe(true);
    expect(hasLocaleData("be")).toBe(true); // Node has full ICU
    expect(hasLocaleData("xx-invalid-tag-")).toBe(false);
  });

  it("writes numbers, sizes and percents like ICU's be", () => {
    for (const n of [0, 3, 18.4, 18.45, 18.25, 105, 1234, 1234.5, 12345.6, 10000, 248000, -3]) {
      expect(belarusian.size(n)).toBe(intl.size.format(n));
      expect(belarusian.number(n)).toBe(intl.number.format(n));
    }
    for (const gb of [0.8, 1.2, 12.04, 1536])
      expect(belarusian.sizeGb(gb)).toBe(intl.gb.format(gb));
    for (const n of [0, 18, 43, 100])
      expect(belarusian.percent(n)).toBe(intl.percent.format(n / 100));
  });

  it("writes dates, months, lists and relative times like ICU's be", () => {
    for (let m = 0; m < 12; m += 1) {
      const d = new Date(2026, m, 15, 12);
      expect(belarusian.date(d)).toBe(intl.date.format(d));
      expect(belarusian.month(d)).toBe(intl.month.format(d));
    }
    for (const n of [0, 1, 2, 3, 4, 5, 6])
      expect(belarusian.ago(n, "day")).toBe(intl.relative.format(-n, "day"));
    for (const n of [1, 2, 3, 4, 5])
      expect(belarusian.ago(n, "week")).toBe(intl.relative.format(-n, "week"));
    for (const n of [1, 2, 5, 11, 12, 21, 22, 25]) {
      expect(belarusian.ago(n, "month")).toBe(intl.relative.format(-n, "month"));
    }
    for (const items of [["A"], ["A", "B"], ["Nilesoft", "Winaero", "FOSS Friends"]]) {
      expect(belarusian.list(items)).toBe(intl.list.format(items));
    }
  });

  it("is what createFormat('be') returns when the runtime lacks be (WebView2, Chrome)", () => {
    const native = createFormat("be", TODAY);
    vi.mocked(hasLocaleData).mockReturnValueOnce(false);
    const fallback = createFormat("be", TODAY);
    for (const mb of [18.4, 105, 1234.5]) expect(fallback.size(mb)).toBe(native.size(mb));
    expect(fallback.sizeGb(820)).toBe(native.sizeGb(820));
    for (const iso of [
      "2026-09-15",
      "2026-09-14",
      "2026-09-13",
      "2026-09-10",
      "2026-09-01",
      "2026-06-02",
      "2024-09-12",
    ]) {
      expect(fallback.date(iso)).toBe(native.date(iso));
      expect(fallback.month(iso)).toBe(native.month(iso));
      expect(fallback.relative(iso)).toBe(native.relative(iso));
    }
    expect(fallback.date("soon")).toBe("soon");
    expect(fallback.number(12345.6)).toBe(native.number(12345.6));
    expect(fallback.plus(10000)).toBe(native.plus(10000));
    expect(fallback.price(4.99, "USD")).toBe(native.price(4.99, "USD"));
    expect(fallback.price(49, "USD")).toBe(native.price(49, "USD"));
    expect(fallback.price(4.99, "EUR")).toBe(native.price(4.99, "EUR"));
    expect(fallback.percent(43.4)).toBe(native.percent(43.4));
    expect(fallback.list(["Nilesoft", "Winaero"])).toBe(native.list(["Nilesoft", "Winaero"]));
  });

  it("formats i18next `{{…, number}}` in be the same way when the runtime lacks be", async () => {
    vi.resetModules();
    const mod = await import("./belarusian");
    vi.mocked(mod.hasLocaleData).mockReturnValue(false);
    const { i18n } = await import("./index");
    vi.mocked(mod.hasLocaleData).mockReset();
    const format = (value: number, lng: string) =>
      i18n.services.formatter?.format(value, "number", lng, {});
    expect(format(3120, "be")).toBe(intl.number.format(3120));
    expect(format(12345.6, "be")).toBe(intl.number.format(12345.6));
    expect(format(3120, "ru")).toBe(new Intl.NumberFormat("ru").format(3120));
    expect(format(3120, "en")).toBe("3,120");
  });
});
