import type { subscription as En } from "../en/subscription";
import type { LocaleCatalog } from "../../types";

export const subscription: LocaleCatalog<typeof En> = {
  testimonial:
    "Paparats Pro помогает мне сосредоточиться на работе. Одна подписка — и столько замечательных инструментов.",
  testimonialBy: "Довольный пользователь",
  subLead: "Одна подписка. Больше возможностей.",
  subBody:
    "Откройте расширенные функции во всех приложениях Paparats. Поддержите независимых разработчиков и помогите нам принести хорошие инструменты большему числу людей.",
  getPro: "Получить Paparats Pro",
  forever: "навсегда",
  perMonth: "/ месяц",
  perYear: "/ год",
  mostPopular: "Самый популярный",
  save18: "Скидка 18%",
  currentPlan: "Ваш план",
  choosePlan: "Выбрать план",
  selected: "Выбрано",
  yourImpact: "Ваш вклад",
  impactBody:
    "Ваша подписка помогает независимым разработчикам создавать и поддерживать хорошее ПО.",
  popularPro: "Популярные приложения с Pro-функциями",
  // TODO(i18n): p => `Подтвердить ${p}`
  confirmTitle: "TODO",
  // TODO(i18n): (price, date) => `Сегодня будет списано ${price}. Следующее списание — ${date}. Отменить можно в любой момент в Настройки › Аккаунт.`
  confirmBody: "TODO",
  confirm: "Подтвердить",
  planConfirmed: "Добро пожаловать в Paparats Pro",
  proActive: "Paparats Pro",
  manage: "Управлять",
  // TODO(i18n): d => `Продление ${d}`
  renewsOn: "TODO",
  proFree: "Бесплатный план",
  upgrade: "Перейти на Pro",
  switchYearly: "Перейти на годовой",
  cancelPlan: "Отменить план",
  proGift: "Paparats Pro · подарок",
  // TODO(i18n): d => `Бонус за идею · действует до ${d}`
  giftUntil: "TODO",
};
