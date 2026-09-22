import type { report as En } from "../en/report";
import type { LocaleCatalog } from "../../types";

export const report: LocaleCatalog<typeof En> = {
  reportTitle: "Проблема с {{name}}",
  reportRoute:
    "Сообщение уйдёт автору канала {{channel}} ({{author}}). Paparats получит копию, чтобы замечать каналы с повторяющимися проблемами.",
  reportRouteOfficial: "Сообщение уйдёт команде Paparats.",
  reportPlaceholder: "Что пошло не так?",
  send: "Отправить",
  reportSent: "Отправлено в {{channel}} · копия в Paparats",
  reportSentOfficial: "Отправлено в Paparats",
};
