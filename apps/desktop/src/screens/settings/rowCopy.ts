// Typed access to a settings row's copy: `settings.rows.<id>.title / .hint / .action`. The schema
// (domain/settings.ts) types row ids as plain strings; these guards narrow them to the ids the
// catalog has, so `t()` keeps checking keys and variables.
import type { i18n as I18n } from "i18next";
import type { en } from "@/i18n/locales/en";

type RowsCopy = (typeof en)["settings"]["rows"];

/** A row id with copy in the catalog (every schema row has it). */
export type RowCopyId = keyof RowsCopy;

type RowIdWith<F extends "hint" | "action"> = {
  [K in RowCopyId]: F extends keyof RowsCopy[K] ? K : never;
}[RowCopyId];

/** Rows with a hint line (all but `location`, whose path is shown instead). */
export type HintedRowId = RowIdWith<"hint">;

/** Rows with a button or link label. */
export type ActionRowId = RowIdWith<"action">;

export function isRowCopyId(i18n: I18n, id: string): id is RowCopyId {
  return i18n.exists(`settings.rows.${id}.title`);
}

export function hasHint(i18n: I18n, id: RowCopyId): id is HintedRowId {
  return i18n.exists(`settings.rows.${id}.hint`);
}

export function hasAction(i18n: I18n, id: RowCopyId): id is ActionRowId {
  return i18n.exists(`settings.rows.${id}.action`);
}
