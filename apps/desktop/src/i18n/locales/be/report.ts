import type { report as En } from "../en/report";
import type { LocaleCatalog } from "../../types";

export const report: LocaleCatalog<typeof En> = {
  // TODO(i18n): x => `Праблема з ${x}`
  reportTitle: "TODO",
  // TODO(i18n): (a, c) => `Паведамленне пойдзе аўтару канала ${c} (${a}). Paparats атрымае копію, каб заўважаць каналы з паўторнымі праблемамі.`
  reportRoute: "TODO",
  reportRouteOfficial: "Паведамленне пойдзе камандзе Paparats.",
  reportPlaceholder: "Што пайшло не так?",
  send: "Адправіць",
  // TODO(i18n): c => `Адпраўлена ў ${c} · копія ў Paparats`
  reportSent: "TODO",
  reportSentOfficial: "Адпраўлена ў Paparats",
};
