import type { updates as En } from "../en/updates";
import type { LocaleCatalog } from "../../types";

export const updates: LocaleCatalog<typeof En> = {
  promoUpdTitle: "Лучшие инструменты каждый день.",
  promoUpdBody:
    "Обновления приносят новые функции, лучшую производительность и меньше шероховатостей.",
  updateAll: "Обновить всё",
  updatesSub: "Держите приложения в актуальном состоянии.",
  // TODO(i18n): n => `${pl(n, 'Доступно', 'Доступны', 'Доступно')} ${n} ${pl(n, 'обновление', 'обновления', 'обновлений')}`
  updatesAvailable: "TODO",
  viewDetails: "Подробнее",
  hideDetails: "Скрыть",
  autoUpdates: "Автоматические обновления",
  autoUpdatesHint: "Держите приложения актуальными автоматически.",
  updateSettings: "Настройки обновлений",
  updateSettingsHint: "Уведомления, расписание, сеть",
  updateHistory: "История обновлений",
  updateHistoryHint: "Смотрите, что изменилось",
  allUpdated: "Все обновления установлены",
  updatedNow: "Только что обновлено",
  cancelAll: "Отменить всё",
};
