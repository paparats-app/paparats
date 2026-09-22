import type { categories as En } from "../en/categories";
import type { LocaleCatalog } from "../../types";

export const categories: LocaleCatalog<typeof En> = {
  categoriesSub: "Исследуйте нашу отобранную коллекцию приложений.",
  featuredIn: "Рекомендуемые: {{category}}",
  items: {
    productivity: { label: "Продуктивность", desc: "Успевайте больше." },
    development: { label: "Разработка", desc: "Создавайте. Тестируйте. Выпускайте." },
    design: { label: "Дизайн", desc: "Создавайте и вдохновляйте." },
    media: { label: "Медиа", desc: "Смотрите. Монтируйте. Слушайте." },
    utilities: { label: "Утилиты", desc: "Маленькие инструменты. Большой эффект." },
    system: { label: "Система", desc: "Сделайте Windows лучше." },
    lifestyle: { label: "Образ жизни", desc: "Больше баланса в жизни." },
    games: { label: "Игры", desc: "Хорошие игры. Без рекламы." },
    education: { label: "Образование", desc: "Учитесь. Растите. Идите дальше." },
  },
};
