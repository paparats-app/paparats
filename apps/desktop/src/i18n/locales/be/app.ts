import type { app as En } from "../en/app";
import type { LocaleCatalog } from "../../types";

export const app: LocaleCatalog<typeof En> = {
  about: "Пра праграму",
  screenshots: "Скрыншоты",
  size: "Памер",
  updated: "Абноўлена",
  license: "Ліцэнзія",
  publisher: "Выдавец",
  requires: "Патрабуе",
  requiresValue: "Windows 10 і навей, x64",
  moreIn: "Яшчэ ў калекцыі",
  proFeatures: "Pro-функцыі",
  proHint: "Уваходзяць у Paparats Pro.",
  // TODO(i18n): n => `Скрыншот ${n}`
  shotLabel: "TODO",
  yes: "Так",
  no: "Не",
  reviews: "Ацэнкі і водгукі",
  // TODO(i18n): n => `${n} ${pl(n, 'ацэнка', 'ацэнкі', 'ацэнак')}`
  ratingsCount: "TODO",
  rateApp: "Ацаніце праграму",
  thanksRating: "Дзякуй за ацэнку",
  writeReview: "Напісаць водгук",
  // TODO(i18n): n => `${n} ${pl(n, 'палічыў', 'палічылі', 'палічылі')} карысным`
  helpful: "TODO",
  versionHistory: "Гісторыя версій",
  current: "Актуальная",
  showAll: "Паказаць усе версіі",
  showLess: "Схаваць",
  // TODO(i18n): v => `Выпушчана ў версіі ${v}`
  releasedInVersion: "TODO",
  grewFromIdea: "Вырасла з ідэі",
  seeIdea: "Да ідэі",
  // TODO(i18n): n => `${n} ${pl(n, 'ідэя', 'ідэі', 'ідэй')} для гэтай праграмы`
  ideasForApp: "TODO",
  suggestImprovement: "Прапанаваць паляпшэнне",
  // TODO(i18n): c => `Таксама ёсць у канале ${c}.`
  alsoIn: "TODO",
  srcRule: "Paparats усталёўвае і абнаўляе з самага даверанага канала, дзе ёсць праграма.",
  // TODO(i18n): c => `З канала ${c} (правераны). Paparats праверыў аўтара і люструе файлы; сама праграма застаецца адказнасцю аўтара.`
  srcVerifiedNote: "TODO",
  // TODO(i18n): c => `З канала ${c} (супольнасць). Не праверана Paparats; загружаецца з сервера аўтара.`
  srcCommunityNote: "TODO",
};
