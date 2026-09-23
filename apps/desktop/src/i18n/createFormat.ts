import type { IsoDate, Locale } from "@/services/types";
import { belarusian, hasLocaleData } from "./belarusian";

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
  /** Exactly `digits` decimals, e.g. an average rating: "4.6" / "4,6". */
  fixed(n: number, digits: number): string;
  /** "10,000+" / "10 000+". */
  plus(n: number): string;
  /** "$4.99", "$49" / "4,99 $", "49 $": decimals only when the amount has cents. */
  price(amount: number, currency: string): string;
  /** A 0–100 value, rounded: "45%" / "45 %". */
  percent(n: number): string;
  /** "Nilesoft and Winaero" / "Nilesoft і Winaero". */
  list(items: readonly string[]): string;
};

/** The part of `Format` that needs no "today": what presentational components use (`useNumberFormat`). */
export type NumberFormat = Pick<Format, "number" | "fixed" | "plus" | "percent">;

const DAY_MS = 86_400_000;

/** Local noon of a `YYYY-MM-DD` date (noon keeps the day stable across time zones and DST). */
function atNoon(iso: IsoDate): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The number formatters of `createFormat`; `belarusianFallback` as decided there. */
function numberFormat(locale: Locale, belarusianFallback: boolean): NumberFormat {
  if (belarusianFallback) {
    const be = belarusian;
    return {
      number: be.number,
      fixed: be.fixed,
      plus: (n) => `${be.number(n)}+`,
      percent: (n) => be.percent(n),
    };
  }
  const tag = locale === "en" ? "en-GB" : locale;
  const numberFmt = new Intl.NumberFormat(tag);
  const percentFmt = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 });
  return {
    number: (n) => numberFmt.format(n),
    fixed: (n, digits) =>
      new Intl.NumberFormat(tag, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n),
    plus: (n) => `${numberFmt.format(n)}+`,
    percent: (n) => percentFmt.format(Math.round(n) / 100),
  };
}

/** Just the number formatters of `createFormat(locale, …)`, with the same Belarusian fallback. */
export function createNumberFormat(locale: Locale): NumberFormat {
  return numberFormat(locale, locale === "be" && !hasLocaleData("be"));
}

/**
 * Pure formatter set for `locale`, with `today` as the reference for `relative`. English uses
 * en-GB conventions ("15 September 2026") except prices, which follow en-US ("$4.99").
 */
export function createFormat(locale: Locale, today: IsoDate): Format {
  const tag = locale === "en" ? "en-GB" : locale;
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
  const listFmt = new Intl.ListFormat(tag, { style: "long", type: "conjunction" });
  const todayNoon = atNoon(today);

  const onDate = (fmt: Intl.DateTimeFormat) => (iso: IsoDate) => {
    const d = atNoon(iso);
    return d ? fmt.format(d) : iso;
  };
  const date = onDate(dateFmt);

  // Chromium has no Belarusian ICU data (WebView2 falls back to ru-BY, Chrome to en-US): the
  // CLDR `be` patterns are applied by hand there, so the app reads the same in every runtime.
  const belarusianFallback = locale === "be" && !hasLocaleData("be");
  const numbers = numberFormat(locale, belarusianFallback);
  if (belarusianFallback) {
    const be = belarusian;
    return {
      ...numbers,
      size: be.size,
      sizeGb: (mb) => be.sizeGb(mb / 1024),
      date: (iso) => {
        const d = atNoon(iso);
        return d ? be.date(d) : iso;
      },
      month: (iso) => {
        const d = atNoon(iso);
        return d ? be.month(d) : iso;
      },
      relative(iso) {
        const then = atNoon(iso);
        if (!then || !todayNoon) {
          return then ? be.date(then) : iso;
        }
        const days = Math.round((todayNoon.getTime() - then.getTime()) / DAY_MS);
        if (days < 1) return be.ago(0, "day");
        if (days < 7) return be.ago(days, "day");
        if (days < 30) return be.ago(Math.round(days / 7), "week");
        return be.ago(Math.round(days / 30), "month");
      },
      price: (amount, currency) => be.price(amount, currency, Number.isInteger(amount) ? 0 : 2),
      list: be.list,
    };
  }

  return {
    ...numbers,
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
    list: (items) => listFmt.format(items),
  };
}
