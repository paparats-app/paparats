import type { report as En } from "../en/report";
import type { LocaleCatalog } from "../../types";

export const report: LocaleCatalog<typeof En> = {
  reportTitle: "Праблема з {{name}}",
  reportRoute:
    "Паведамленне пойдзе аўтару канала {{channel}} ({{author}}). Paparats атрымае копію, каб заўважаць каналы з паўторнымі праблемамі.",
  reportRouteOfficial: "Паведамленне пойдзе камандзе Paparats.",
  reportPlaceholder: "Што пайшло не так?",
  send: "Адправіць",
  reportSent: "Адпраўлена ў {{channel}} · копія ў Paparats",
  reportSentOfficial: "Адпраўлена ў Paparats",
};
