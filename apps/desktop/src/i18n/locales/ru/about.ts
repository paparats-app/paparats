import type { about as En } from "../en/about";
import type { LocaleCatalog } from "../../types";

export const about: LocaleCatalog<typeof En> = {
  youUpToDate: "У вас последняя версия!",
  checking: "Проверка…",
  checkUpdates: "Проверить обновления",
  updateAvailable: "Доступна версия {{version}}",
  installUpdate: "Установить версию {{version}}",
  installing: "Установка…",
  updateFailed: "Не удалось установить обновление. Попробуйте позже.",
  aboutBody1: "Paparats — отобранный каталог современных инструментов и утилит.",
  aboutBody2: "Мы верим в полезное ПО, приватность и более открытую экосистему.",
  website: "Сайт",
  docs: "Документация",
  support: "Поддержка",
  report: "Сообщить о проблеме",
  copyright: "© 2026 Paparats. Все права защищены.",
  terms: "Условия использования",
  privacyPolicy: "Политика конфиденциальности",
  licenses: "Лицензии",
  principles: {
    p1: "Отобранные качественные приложения",
    p2: "Без рекламы. Без телеметрии",
    p3: "Поддержка независимых разработчиков",
    p4: "Открывайте скрытые сокровища",
  },
};
