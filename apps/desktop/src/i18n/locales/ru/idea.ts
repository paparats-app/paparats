import type { idea as En } from "../en/idea";
import type { LocaleCatalog } from "../../types";

export const idea: LocaleCatalog<typeof En> = {
  takeIdea: "Взять идею",
  tookIdea: "Закреплена за {{channel}} · автор уведомлён",
  markReleased: "Отметить выпущенной",
  releaseIdea: "Выпуск идеи",
  releaseApp: "Какое приложение её реализует?",
  releaseVersion: "Версия",
  release: "Выпустить",
  releasedMsg_one: "Выпущена · уведомлено {{count, number}} человек",
  releasedMsg_few: "Выпущена · уведомлено {{count, number}} человека",
  releasedMsg_many: "Выпущена · уведомлено {{count, number}} человек",
  releasedMsg_other: "Выпущена · уведомлено {{count, number}} человека",
  authorBonus: "Автор получил 3 месяца Paparats Pro.",
  discussion: "Обсуждение",
  commentPlaceholder: "Добавьте к обсуждению…",
  post: "Отправить",
  authorBadge: "Автор",
  noComments: "Комментариев пока нет. Начните обсуждение.",
};
