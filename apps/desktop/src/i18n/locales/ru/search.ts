import type { search as En } from "../en/search";
import type { LocaleCatalog } from "../../types";

export const search: LocaleCatalog<typeof En> = {
  noResultsHint: "Попробуйте более короткий запрос или загляните в категории.",
  offlineSearch: "Для поиска нужна сеть",
  offlineSearchHint: "Приложения из Библиотеки можно открывать и без неё.",
  tryThese: "Попробуйте",
  searching: "Поиск…",
};
