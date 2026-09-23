/**
 * Belarusian formatting without the runtime's `be` data (docs/decisions.md D62). Chromium ships
 * no Belarusian ICU locale: WebView2 resolves `be` to `ru-BY` (Russian month names, "3 дня
 * назад", "A и B") and Chrome to `en-US` ("September 15, 2026", "18.4 MB"). These are the CLDR
 * `be` patterns Node's full ICU produces — the same strings `createFormat("be")` gives where the
 * data exists: "18,4 МБ", "12 345,6" (grouping from five digits), "43 %", "15 верасня 2026 г.",
 * "верасень 2026", "3 дні таму", "4,99 $", "A, B і C".
 */

const NBSP = "\u00a0";

const MONTHS_GENITIVE = [
  "студзеня",
  "лютага",
  "сакавіка",
  "красавіка",
  "мая",
  "чэрвеня",
  "ліпеня",
  "жніўня",
  "верасня",
  "кастрычніка",
  "лістапада",
  "снежня",
] as const;

const MONTHS_NOMINATIVE = [
  "студзень",
  "люты",
  "сакавік",
  "красавік",
  "май",
  "чэрвень",
  "ліпень",
  "жнівень",
  "верасень",
  "кастрычнік",
  "лістапад",
  "снежань",
] as const;

/** CLDR `be` cardinal plural forms of the past-time units: [one, few, many]. */
const UNITS = {
  day: ["дзень", "дні", "дзён"],
  week: ["тыдзень", "тыдні", "тыдняў"],
  month: ["месяц", "месяцы", "месяцаў"],
} as const;

/** Whether this runtime's ICU formats `tag` with its own data (not a fallback locale). */
export function hasLocaleData(tag: string): boolean {
  try {
    const resolved = new Intl.DateTimeFormat(tag).resolvedOptions().locale;
    return resolved.split("-")[0] === tag.split("-")[0];
  } catch {
    return false;
  }
}

/** A plain decimal rounded by ICU itself (en-US is always present), then Belarusian separators. */
function decimal(n: number, minFraction: number, maxFraction: number): string {
  const plain = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  }).format(n);
  const negative = plain.startsWith("-");
  const [int = "", fraction] = (negative ? plain.slice(1) : plain).split(".");
  // CLDR `be`: minimum grouping digits 2 — "1234", "12 345".
  const grouped = int.length >= 5 ? int.replace(/\B(?=(\d{3})+$)/g, NBSP) : int;
  return (negative ? "-" : "") + grouped + (fraction ? `,${fraction}` : "");
}

/** CLDR `be` cardinal category of an integer: one, few or many. */
function pluralIndex(n: number): 0 | 1 | 2 {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
  return 2;
}

export const belarusian = {
  number: (n: number): string => decimal(n, 0, 3),
  /** Exactly `digits` decimals: "4,6". */
  fixed: (n: number, digits: number): string => decimal(n, digits, digits),
  size: (mb: number): string => `${decimal(mb, 0, 1)} МБ`,
  sizeGb: (gb: number): string => `${decimal(gb, 1, 1)} ГБ`,
  percent: (n: number): string => `${decimal(n, 0, 0)}${NBSP}%`,
  date: (d: Date): string =>
    `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()] ?? ""} ${d.getFullYear()} г.`,
  month: (d: Date): string => `${MONTHS_NOMINATIVE[d.getMonth()] ?? ""} ${d.getFullYear()}`,
  /** `amount` units ago (`amount` ≥ 0), like `Intl.RelativeTimeFormat("be", { numeric: "auto" })`. */
  ago(amount: number, unit: keyof typeof UNITS): string {
    if (unit === "day" && amount === 0) return "сёння";
    if (unit === "day" && amount === 1) return "учора";
    if (unit === "day" && amount === 2) return "пазаўчора";
    if (unit === "week" && amount === 1) return "на мінулым тыдні";
    if (unit === "month" && amount === 1) return "у мінулым месяцы";
    return `${decimal(amount, 0, 0)} ${UNITS[unit][pluralIndex(amount)]} таму`;
  },
  price(amount: number, currency: string, digits: number): string {
    const symbol =
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency;
    return `${decimal(amount, digits, digits)}${NBSP}${symbol}`;
  },
  list(items: readonly string[]): string {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} і ${items[items.length - 1] ?? ""}`;
  },
};
