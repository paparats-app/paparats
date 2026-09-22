import type { report as En } from "../en/report";
import type { LocaleCatalog } from "../../types";

export const report: LocaleCatalog<typeof En> = {
  // TODO(i18n): x => `Проблема с ${x}`
  reportTitle: "TODO",
  // TODO(i18n): (a, c) => `Сообщение уйдёт автору канала ${c} (${a}). Paparats получит копию, чтобы замечать каналы с повторяющимися проблемами.`
  reportRoute: "TODO",
  reportRouteOfficial: "Сообщение уйдёт команде Paparats.",
  reportPlaceholder: "Что пошло не так?",
  send: "Отправить",
  // TODO(i18n): c => `Отправлено в ${c} · копия в Paparats`
  reportSent: "TODO",
  reportSentOfficial: "Отправлено в Paparats",
};
