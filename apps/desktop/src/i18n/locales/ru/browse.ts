import type { browse as En } from "../en/browse";
import type { LocaleCatalog } from "../../types";

export const browse: LocaleCatalog<typeof En> = {
  searchFilters: "Поиск фильтров…",
  // TODO(i18n): n => `Получить ${n}`
  getApp: "TODO",
  topCategories: "Популярные категории",
  featuredKicker: "Рекомендуем",
  browseSub: "Отобранные приложения для работы, творчества и повседневной жизни.",
  clearAll: "Сбросить",
  price: "Цена",
  priceFree: "Бесплатно",
  pricePro: "Pro-функции",
  platform: "Платформа",
  platWindows: "Windows",
  platPortable: "Портативная сборка",
  sortFeatured: "Рекомендуемые",
  sortNewest: "Новые",
};
