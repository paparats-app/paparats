import type { app as En } from "../en/app";
import type { LocaleCatalog } from "../../types";

export const app: LocaleCatalog<typeof En> = {
  about: "О приложении",
  screenshots: "Скриншоты",
  size: "Размер",
  updated: "Обновлено",
  license: "Лицензия",
  publisher: "Издатель",
  requires: "Требуется",
  requiresValue: "Windows 10 и новее, x64",
  moreIn: "Ещё в коллекции",
  proFeatures: "Pro-функции",
  proHint: "Входят в Paparats Pro.",
  // TODO(i18n): n => `Скриншот ${n}`
  shotLabel: "TODO",
  yes: "Да",
  no: "Нет",
  reviews: "Оценки и отзывы",
  // TODO(i18n): n => `${n} ${pl(n, 'оценка', 'оценки', 'оценок')}`
  ratingsCount: "TODO",
  rateApp: "Оцените приложение",
  thanksRating: "Спасибо за оценку",
  writeReview: "Написать отзыв",
  // TODO(i18n): n => `${n} ${pl(n, 'посчитал', 'посчитали', 'посчитали')} полезным`
  helpful: "TODO",
  versionHistory: "История версий",
  current: "Текущая",
  showAll: "Показать все версии",
  showLess: "Скрыть",
  // TODO(i18n): v => `Выпущена в версии ${v}`
  releasedInVersion: "TODO",
  grewFromIdea: "Выросло из идеи",
  seeIdea: "К идее",
  // TODO(i18n): n => `${n} ${pl(n, 'идея', 'идеи', 'идей')} для этого приложения`
  ideasForApp: "TODO",
  suggestImprovement: "Предложить улучшение",
  // TODO(i18n): c => `Также есть в канале ${c}.`
  alsoIn: "TODO",
  srcRule: "Paparats устанавливает и обновляет из самого доверенного канала, где есть приложение.",
  // TODO(i18n): c => `Из канала ${c} (проверенный). Paparats проверил автора и зеркалирует файлы; само приложение остаётся ответственностью автора.`
  srcVerifiedNote: "TODO",
  // TODO(i18n): c => `Из канала ${c} (сообщество). Не проверено Paparats; загружается с сервера автора.`
  srcCommunityNote: "TODO",
};
