/** CLDR plural categories used as i18next key suffixes (`key_one`, `key_few`, …). */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

type PluralKey = `${string}_${PluralCategory}`;

/**
 * Shape a translation must have, given the English catalog `T`: every non-plural key of `T`
 * (strings or nested groups, recursively). Plural keys are free-form because languages use
 * different categories (en: one/other; be, ru: one/few/many/other) — `i18n.test.ts` checks that
 * each language defines every category `Intl.PluralRules` reports for it.
 */
export type LocaleCatalog<T> = {
  [K in keyof T as K extends PluralKey ? never : K]: T[K] extends string
    ? string
    : LocaleCatalog<T[K]>;
} & { [key: PluralKey]: string };
