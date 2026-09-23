import { afterEach, describe, expect, it } from "vitest";
import i18nDoc from "../../../../docs/i18n.md?raw";
import { changeLocale, i18n, initI18n, LANGUAGES } from ".";
import { createFormat } from "./createFormat";
import keymap from "./keymap.json";
import { LOCALES, resources } from "./resources";

type Tree = { readonly [key: string]: string | Tree };
type Lang = (typeof LOCALES)[number];

const PLURAL = /_(zero|one|two|few|many|other)$/;
const VARIABLE = /\{\{\s*([^,}\s]+)\s*(?:,\s*([^}]*?)\s*)?\}\}/g;

function flatten(tree: Tree, prefix = "", out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else flatten(value, path, out);
  }
  return out;
}

const base = (key: string) => key.replace(PLURAL, "");
const suffix = (key: string) => PLURAL.exec(key)?.[1];
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

const catalogs = Object.fromEntries(
  LOCALES.map((lang) => [lang, flatten(resources[lang].translation)]),
) as Record<Lang, Map<string, string>>;

/** Base key → its strings (one per plural form, or just one). */
function grouped(lang: Lang): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const [key, value] of catalogs[lang]) {
    groups.set(base(key), [...(groups.get(base(key)) ?? []), value]);
  }
  return groups;
}

/** `name` or `name, format` for every `{{…}}` in the given strings. */
function variables(values: readonly string[]): string[] {
  return sorted(
    values.flatMap((v) =>
      [...v.matchAll(VARIABLE)].map(([, name, format]) =>
        format ? `${name}, ${format}` : `${name}`,
      ),
    ),
  );
}

const pluralBases = (lang: Lang) =>
  sorted([...catalogs[lang].keys()].filter((k) => PLURAL.test(k)).map(base));

/** NBSP / narrow NBSP (grouping, units, currency) → plain space, so expectations stay readable. */
const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("catalogs", () => {
  const en = grouped("en");

  it.each(LOCALES)("%s has exactly the keys of en (plural suffixes aside)", (lang) => {
    const keys = grouped(lang);
    const missing = [...en.keys()].filter((k) => !keys.has(k));
    const extra = [...keys.keys()].filter((k) => !en.has(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each(LOCALES)("%s defines every plural category Intl reports, and no others", (lang) => {
    const categories = sorted(new Intl.PluralRules(lang).resolvedOptions().pluralCategories);
    expect(pluralBases(lang)).toEqual(pluralBases("en"));
    for (const key of pluralBases(lang)) {
      const forms = [...catalogs[lang].keys()].filter((k) => base(k) === key);
      expect({ key, forms: sorted(forms.map((k) => suffix(k) ?? "(none)")) }).toEqual({
        key,
        forms: categories,
      });
    }
  });

  it.each(LOCALES)("%s has no TODO, empty or malformed strings", (lang) => {
    const bad = [...catalogs[lang]].filter(
      ([, v]) =>
        v.trim() === "" ||
        /TODO/.test(v) ||
        v.includes("${") ||
        /[{}]/.test(v.replace(VARIABLE, "")) ||
        v !== v.trim(),
    );
    expect(bad).toEqual([]);
  });

  it.each(LOCALES.filter((l) => l !== "en"))(
    "%s interpolates the same variables as en for every key",
    (lang) => {
      const mismatched = [...grouped(lang)]
        .map(([key, values]) => ({
          key,
          vars: variables(values),
          en: variables(en.get(key) ?? []),
        }))
        .filter((x) => x.vars.join("|") !== x.en.join("|"));
      expect(mismatched).toEqual([]);
    },
  );

  it("uses `count` for plurals only, always formatted as a number", () => {
    const plural = new Set(pluralBases("en"));
    for (const lang of LOCALES) {
      for (const [key, values] of grouped(lang)) {
        const vars = variables(values);
        const counts = vars.filter((v) => v.startsWith("count"));
        expect({ lang, key, counts }).toEqual({
          lang,
          key,
          counts: plural.has(key) ? ["count, number"] : [],
        });
      }
    }
  });

  it("keymap points every prototype key at an existing base key", () => {
    const en = catalogs.en;
    const broken = Object.entries(keymap).filter(
      ([, key]) => PLURAL.test(key) || !(en.has(key) || en.has(`${key}_other`)),
    );
    expect(broken).toEqual([]);
  });

  it("docs/i18n.md lists every key that takes variables", () => {
    const withVariables = [...en].filter(([, values]) => variables(values).length > 0);
    expect(withVariables.length).toBeGreaterThan(60);
    const undocumented = withVariables
      .map(([key]) => key)
      .filter((key) => !i18nDoc.includes(`| \`${key}\` |`));
    expect(undocumented).toEqual([]);
  });
});

describe("t()", () => {
  const counts = [1, 2, 5, 11, 21, 22, 25];

  it.each([
    [
      "ru",
      "common.appsCount",
      [
        "1 приложение",
        "2 приложения",
        "5 приложений",
        "11 приложений",
        "21 приложение",
        "22 приложения",
        "25 приложений",
      ],
    ],
    [
      "be",
      "common.appsCount",
      [
        "1 праграма",
        "2 праграмы",
        "5 праграм",
        "11 праграм",
        "21 праграма",
        "22 праграмы",
        "25 праграм",
      ],
    ],
    [
      "ru",
      "updates.updatesAvailable",
      [
        "Доступно 1 обновление",
        "Доступны 2 обновления",
        "Доступно 5 обновлений",
        "Доступно 11 обновлений",
        "Доступно 21 обновление",
        "Доступны 22 обновления",
        "Доступно 25 обновлений",
      ],
    ],
    [
      "be",
      "sources.unreachableFor",
      [
        "Недаступны 1 дзень",
        "Недаступны 2 дні",
        "Недаступны 5 дзён",
        "Недаступны 11 дзён",
        "Недаступны 21 дзень",
        "Недаступны 22 дні",
        "Недаступны 25 дзён",
      ],
    ],
    [
      "en",
      "common.appsCount",
      ["1 app", "2 apps", "5 apps", "11 apps", "21 apps", "22 apps", "25 apps"],
    ],
  ] as const)("%s %s picks the right plural form", (lang, key, expected) => {
    const t = i18n.getFixedT(lang);
    expect(counts.map((count) => t(key, { count }))).toEqual(expected);
  });

  it("formats counts with the language's digit grouping", () => {
    expect(i18n.getFixedT("en")("sources.subscribersCount", { count: 12400 })).toBe(
      "12,400 subscribers",
    );
    expect(norm(i18n.getFixedT("ru")("sources.subscribersCount", { count: 12400 }))).toBe(
      "12 400 подписчиков",
    );
    expect(norm(i18n.getFixedT("be")("sources.subscribersCount", { count: 12401 }))).toBe(
      "12 401 падпісчык",
    );
  });

  it("interpolates named variables without HTML-escaping", () => {
    const en = i18n.getFixedT("en");
    expect(en("browse.getApp", { app: "Obsidian" })).toBe("Get Obsidian");
    expect(en("common.resultsFor", { query: "<b> & co" })).toBe("Results for “<b> & co”");
    expect(en("settings.rows.signOut.title", { email: "serj.kaje@example.com" })).toBe(
      "Signed in as serj.kaje@example.com",
    );
    expect(i18n.getFixedT("ru")("ideas.releaseNote", { author: "Alena K.", count: 21 })).toMatch(
      /^Уведомление получат Alena K\. и ещё 21 человек, которые голосовали\./,
    );
    // @ts-expect-error — variables are typed from the en catalog: `app`, not `name`.
    expect(en("browse.getApp", { name: "Obsidian" })).toBe("Get {{app}}");
  });
});

describe("i18n instance", () => {
  afterEach(async () => {
    await changeLocale("en");
  });

  it("is ready in English as soon as it is imported", () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe("en");
    expect(i18n.t("nav.home")).toBe("Home");
  });

  it("switches language synchronously and mirrors it on <html lang>", () => {
    void changeLocale("ru");
    expect(i18n.language).toBe("ru");
    expect(i18n.t("nav.home")).toBe("Главная");
    expect(document.documentElement.lang).toBe("ru");
  });

  it("initI18n applies the saved locale", async () => {
    await initI18n("be");
    expect(i18n.t("nav.home")).toBe("Галоўная");
  });

  it("lists the languages in picker order with native names", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual([...LOCALES]);
    expect(LANGUAGES.map((l) => l.native)).toEqual(["English", "Беларуская", "Русский"]);
  });
});

describe("createFormat", () => {
  const today = "2026-09-15";
  const en = createFormat("en", today);
  const be = createFormat("be", today);
  const ru = createFormat("ru", today);

  it("formats sizes in MB and GB", () => {
    expect(en.size(18.4)).toBe("18.4 MB");
    expect(en.size(105)).toBe("105 MB");
    expect(norm(ru.size(18.4))).toBe("18,4 МБ");
    expect(norm(be.size(105))).toBe("105 МБ");
    expect(en.sizeGb(1229)).toBe("1.2 GB");
    expect(en.sizeGb(1024)).toBe("1.0 GB");
    expect(norm(ru.sizeGb(1229))).toBe("1,2 ГБ");
  });

  it("formats prices without forcing decimals on whole amounts", () => {
    expect([en.price(4.99, "USD"), en.price(0, "USD"), en.price(49, "USD")]).toEqual([
      "$4.99",
      "$0",
      "$49",
    ]);
    expect([4.99, 0, 49].map((a) => norm(ru.price(a, "USD")))).toEqual(["4,99 $", "0 $", "49 $"]);
    expect(norm(be.price(4.99, "USD"))).toBe("4,99 $");
  });

  it("formats dates and months (en uses en-GB order)", () => {
    expect(en.date("2026-09-15")).toBe("15 September 2026");
    expect(norm(ru.date("2026-09-15"))).toBe("15 сентября 2026 г.");
    expect(norm(be.date("2026-09-15"))).toBe("15 верасня 2026 г.");
    expect(en.month("2024-09-12")).toBe("September 2024");
    expect(en.date("not a date")).toBe("not a date");
  });

  it("formats relative dates with the prototype's day/week/month rule", () => {
    const cases: [string, string][] = [
      ["2026-09-15", "today"],
      ["2026-09-20", "today"],
      ["2026-09-14", "yesterday"],
      ["2026-09-12", "3 days ago"],
      ["2026-09-08", "last week"],
      ["2026-09-01", "2 weeks ago"],
      ["2026-08-14", "last month"],
      ["2026-06-15", "3 months ago"],
    ];
    expect(cases.map(([iso]) => en.relative(iso))).toEqual(cases.map(([, out]) => out));
    expect(ru.relative("2026-09-10")).toBe("5 дней назад");
    expect(be.relative("2026-09-10")).toBe("5 дзён таму");
  });

  it("formats numbers, plus-counts, percents and lists", () => {
    expect(en.number(1234.5)).toBe("1,234.5");
    expect([en.fixed(4.6, 1), en.fixed(4, 1), ru.fixed(4.25, 1), be.fixed(4.6, 1)]).toEqual([
      "4.6",
      "4.0",
      "4,3",
      "4,6",
    ]);
    expect(en.plus(10000)).toBe("10,000+");
    expect(norm(ru.plus(10000))).toBe("10 000+");
    expect(en.percent(45.6)).toBe("46%");
    expect(norm(ru.percent(18))).toBe("18 %");
    expect(en.list(["Nilesoft", "Winaero"])).toBe("Nilesoft and Winaero");
  });
});
