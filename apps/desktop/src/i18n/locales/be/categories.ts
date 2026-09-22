import type { categories as En } from "../en/categories";
import type { LocaleCatalog } from "../../types";

export const categories: LocaleCatalog<typeof En> = {
  categoriesSub: "Даследуйце нашу адабраную калекцыю праграм.",
  featuredIn: "Рэкамендаваныя: {{category}}",
  items: {
    productivity: { label: "Прадукцыйнасць", desc: "Рабіце больш." },
    development: { label: "Распрацоўка", desc: "Будуйце. Тэстуйце. Выпускайце." },
    design: { label: "Дызайн", desc: "Стварайце і натхняйце." },
    media: { label: "Медыя", desc: "Глядзіце. Мантуйце. Слухайце." },
    utilities: { label: "Утыліты", desc: "Малыя інструменты. Вялікі эфект." },
    system: { label: "Сістэма", desc: "Зрабіце Windows лепшай." },
    lifestyle: { label: "Стыль жыцця", desc: "Больш балансу ў жыцці." },
    games: { label: "Гульні", desc: "Добрыя гульні. Без рэкламы." },
    education: { label: "Адукацыя", desc: "Вучыцеся. Расціце. Ідзіце далей." },
  },
};
