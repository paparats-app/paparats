import type { idea as En } from "../en/idea";
import type { LocaleCatalog } from "../../types";

export const idea: LocaleCatalog<typeof En> = {
  takeIdea: "Узяць ідэю",
  // TODO(i18n): c => `Замацавана за ${c} · аўтар паведамлены`
  tookIdea: "TODO",
  markReleased: "Адзначыць выпушчанай",
  releaseIdea: "Выпуск ідэі",
  releaseApp: "Якая праграма яе рэалізуе?",
  releaseVersion: "Версія",
  release: "Выпусціць",
  // TODO(i18n): n => `Выпушчана · паведамлена ${n} ${pl(n, 'чалавеку', 'чалавекам', 'чалавекам')}`
  releasedMsg: "TODO",
  authorBonus: "Аўтар атрымаў 3 месяцы Paparats Pro.",
  discussion: "Абмеркаванне",
  commentPlaceholder: "Дадайце да абмеркавання…",
  post: "Адправіць",
  authorBadge: "Аўтар",
  noComments: "Каментароў пакуль няма. Пачніце абмеркаванне.",
};
