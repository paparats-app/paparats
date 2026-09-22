import type { IsoDate, Locale } from "@/services/types";

/** Locale-aware formatters for the current UI language. See docs/i18n.md › Formatting. */
export type Format = {
  /** Megabytes, at most one decimal: "18.4 MB", "105 MB" / "18,4 МБ". */
  size(mb: number): string;
  /** Megabytes shown as gigabytes with one decimal: "1.2 GB" / "1,2 ГБ". */
  sizeGb(mb: number): string;
  /** "15 September 2026" / "15 верасня 2026 г.". */
  date(iso: IsoDate): string;
  /** "September 2024" / "верасень 2024". */
  month(iso: IsoDate): string;
  /** Past time relative to today: today, yesterday, 3 days ago, last week, 2 months ago. */
  relative(iso: IsoDate): string;
  number(n: number): string;
  /** "10,000+" / "10 000+". */
  plus(n: number): string;
  /** "$4.99", "$49" / "4,99 $", "49 $": decimals only when the amount has cents. */
  price(amount: number, currency: string): string;
  /** A 0–100 value, rounded: "45%" / "45 %". */
  percent(n: number): string;
  /** "Nilesoft and Winaero" / "Nilesoft і Winaero". */
  list(items: readonly string[]): string;
};

const DAY_MS = 86_400_000;

/** Local noon of a `YYYY-MM-DD` date (noon keeps the day stable across time zones and DST). */
function atNoon(iso: IsoDate): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Pure formatter set for `locale`, with `today` as the reference for `relative`. English uses
 * en-GB conventions ("15 September 2026") except prices, which follow en-US ("$4.99").
 */
export function createFormat(locale: Locale, today: IsoDate): Format {
  const tag = locale === "en" ? "en-GB" : locale;
  const numberFmt = new Intl.NumberFormat(tag);
  const mbFmt = new Intl.NumberFormat(tag, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
  });
  const gbFmt = new Intl.NumberFormat(tag, {
    style: "unit",
    unit: "gigabyte",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const dateFmt = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" });
  const monthFmt = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" });
  const relFmt = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  const percentFmt = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 });
  const listFmt = new Intl.ListFormat(tag, { style: "long", type: "conjunction" });
  const todayNoon = atNoon(today);

  const onDate = (fmt: Intl.DateTimeFormat) => (iso: IsoDate) => {
    const d = atNoon(iso);
    return d ? fmt.format(d) : iso;
  };
  const date = onDate(dateFmt);

  return {
    size: (mb) => mbFmt.format(mb),
    sizeGb: (mb) => gbFmt.format(mb / 1024),
    date,
    month: onDate(monthFmt),
    relative(iso) {
      const then = atNoon(iso);
      if (!then || !todayNoon) return date(iso);
      // The prototype's rule: under a week in days, under a month in weeks, then months.
      const days = Math.round((todayNoon.getTime() - then.getTime()) / DAY_MS);
      if (days < 1) return relFmt.format(0, "day");
      if (days < 7) return relFmt.format(-days, "day");
      if (days < 30) return relFmt.format(-Math.round(days / 7), "week");
      return relFmt.format(-Math.round(days / 30), "month");
    },
    number: (n) => numberFmt.format(n),
    plus: (n) => `${numberFmt.format(n)}+`,
    price(amount, currency) {
      const digits = Number.isInteger(amount) ? 0 : 2;
      return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(amount);
    },
    percent: (n) => percentFmt.format(Math.round(n) / 100),
    list: (items) => listFmt.format(items),
  };
}
