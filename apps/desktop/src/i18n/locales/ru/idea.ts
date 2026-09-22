import type { idea as En } from "../en/idea";
import type { LocaleCatalog } from "../../types";

export const idea: LocaleCatalog<typeof En> = {
  takeIdea: "Взять идею",
  // TODO(i18n): c => `Закреплена за ${c} · автор уведомлён`
  tookIdea: "TODO",
  markReleased: "Отметить выпущенной",
  releaseIdea: "Выпуск идеи",
  releaseApp: "Какое приложение её реализует?",
  releaseVersion: "Версия",
  release: "Выпустить",
  // TODO(i18n): n => `Выпущена · уведомлено ${n} ${pl(n, 'человек', 'человека', 'человек')}`
  releasedMsg: "TODO",
  authorBonus: "Автор получил 3 месяца Paparats Pro.",
  discussion: "Обсуждение",
  commentPlaceholder: "Добавьте к обсуждению…",
  post: "Отправить",
  authorBadge: "Автор",
  noComments: "Комментариев пока нет. Начните обсуждение.",
};
