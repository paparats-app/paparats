import type { ideas as En } from "../en/ideas";
import type { LocaleCatalog } from "../../types";

export const ideas: LocaleCatalog<typeof En> = {
  ideasSub: "Расскажите разработчикам, чего не хватает. Голосуйте за важное.",
  suggestIdea: "Предложить идею",
  ideaNew: "Новое приложение",
  ideaImprove: "Улучшить приложение",
  // TODO(i18n): a => `Для ${a}`
  ideaForApp: "TODO",
  // TODO(i18n): c => `Новое приложение · ${c}`
  ideaNewIn: "TODO",
  tabAllIdeas: "Все",
  tabNewApps: "Новые приложения",
  tabExistingApps: "Существующие",
  tabMyIdeas: "Мои идеи",
  tabForMyApps: "Для моих приложений",
  tabMyWork: "Моя работа",
  stOpen: "Открыта",
  stWork: "В работе",
  stReleased: "Выпущена",
  sortTop: "Популярные",
  sortNew: "Новые",
  vote: "Голосовать",
  voted: "Вы за",
  // TODO(i18n): n => `${n} ${pl(n, 'комментарий', 'комментария', 'комментариев')}`
  commentsCount: "TODO",
  you: "Вы",
  // TODO(i18n): c => `${c} работает над этим`
  onIt: "TODO",
  // TODO(i18n): (a, v) => `Выпущена как ${a} ${v}`
  releasedAs: "TODO",
  howItWorks: "Как это работает",
  how1T: "Предложите",
  how1B: "Инструмент, которого не хватает, или улучшение приложения, которым вы уже пользуетесь.",
  how2T: "Голосуйте",
  how2B: "Популярные идеи поднимаются наверх — разработчики видят, что важно.",
  how3T: "Разработчик берёт идею",
  how3B: "Пока идёт работа, идея закреплена за ним. Вы узнаете сразу, как она выйдет.",
  how4T: "Благодарность",
  how4B: "Автор выпущенной идеи получает 3 месяца Paparats Pro.",
  yourIdeas: "Ваши идеи",
  noMyIdeas: "Вы пока ничего не предложили.",
  ideaReleasedTitle: "Ваша идея стала приложением",
  // TODO(i18n): (title, dev, app) => `«${title}» теперь доступна как ${app} — от ${dev}. Спасибо — вас ждут 3 месяца Paparats Pro.`
  ideaReleasedBody: "TODO",
  activateBonus: "Активировать 3 месяца Pro",
  // TODO(i18n): d => `Paparats Pro действует до ${d}`
  bonusActive: "TODO",
  // TODO(i18n): a => `Открыть ${a}`
  openAppBtn: "TODO",
  gotIt: "Понятно",
  ideaTitle: "Название",
  ideaTitlePlaceholder: "Короткое и ясное название идеи",
  ideaBody: "Описание",
  ideaBodyPlaceholder: "Что она должна делать? Почему это важно? Есть ли что-то похожее?",
  whichApp: "Какое приложение?",
  publish: "Опубликовать",
  ideaPublished: "Идея опубликована — разработчики уже её видят",
  ideaTitleShort: "Дайте идее название не короче 6 символов.",
  ideaFooter:
    "Разработчики видят новые идеи сразу. Если вашу выпустят, вы получите 3 месяца Paparats Pro.",
  takeShort: "Взять",
  // TODO(i18n): c => `Идея будет закреплена за ${c}. Автор и все, кто голосовал, получат уведомление.`
  takeHint: "TODO",
  // TODO(i18n): c => `В работе у ${c}`
  takenByOther: "TODO",
  // TODO(i18n): (a, n) => `Уведомление получат ${a} и ещё ${n} ${pl(n, 'человек', 'человека', 'человек')}, которые голосовали. Автор получит 3 месяца Paparats Pro.`
  releaseNote: "TODO",
  statusOpenHint: "Открыта для разработчиков. Чем больше голосов, тем быстрее кто-то возьмётся.",
  // TODO(i18n): (c, d) => `В работе у ${c} с ${d}.`
  statusWorkHint: "TODO",
  // TODO(i18n): (a, d) => `Вышла как ${a} ${d}.`
  statusReleasedHint: "TODO",
  tlProposed: "Предложена",
  tlWork: "В работе",
  tlReleased: "Выпущена",
  tlPending: "Пока нет",
  // TODO(i18n): c => `Режим разработчика · ${c}`
  devView: "TODO",
  devViewHint:
    "Вы видите то, что видит автор канала: берите открытые идеи и отмечайте их выпущенными.",
  inWorkN: "В работе",
  releasedN: "Выпущено",
  forYourApps: "Для ваших приложений",
  noIdeas: "Пока пусто",
  noIdeasHint: "Предложите что-нибудь первым.",
};
