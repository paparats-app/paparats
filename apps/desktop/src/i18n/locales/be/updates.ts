import type { updates as En } from "../en/updates";
import type { LocaleCatalog } from "../../types";

export const updates: LocaleCatalog<typeof En> = {
  promoUpdTitle: "Лепшыя інструменты кожны дзень.",
  promoUpdBody: "Абнаўленні прыносяць новыя функцыі, лепшую хуткасць і менш шурпатасцяў.",
  updateAll: "Абнавіць усё",
  updatesSub: "Трымайце праграмы актуальнымі.",
  // TODO(i18n): n => `${pl(n, 'Даступна', 'Даступны', 'Даступна')} ${n} ${pl(n, 'абнаўленне', 'абнаўленні', 'абнаўленняў')}`
  updatesAvailable: "TODO",
  viewDetails: "Падрабязнасці",
  hideDetails: "Схаваць",
  autoUpdates: "Аўтаматычныя абнаўленні",
  autoUpdatesHint: "Трымайце праграмы актуальнымі аўтаматычна.",
  updateSettings: "Налады абнаўленняў",
  updateSettingsHint: "Паведамленні, расклад, сетка",
  updateHistory: "Гісторыя абнаўленняў",
  updateHistoryHint: "Глядзіце, што змянілася",
  allUpdated: "Усе абнаўленні ўсталяваныя",
  updatedNow: "Толькі што абноўлена",
  cancelAll: "Адмяніць усё",
};
