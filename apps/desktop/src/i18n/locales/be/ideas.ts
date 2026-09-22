import type { ideas as En } from "../en/ideas";
import type { LocaleCatalog } from "../../types";

export const ideas: LocaleCatalog<typeof En> = {
  ideasSub: "Расказвайце распрацоўшчыкам, чаго не хапае. Галасуйце за важнае.",
  suggestIdea: "Прапанаваць ідэю",
  ideaNew: "Новая праграма",
  ideaImprove: "Палепшыць праграму",
  // TODO(i18n): a => `Для ${a}`
  ideaForApp: "TODO",
  // TODO(i18n): c => `Новая праграма · ${c}`
  ideaNewIn: "TODO",
  tabAllIdeas: "Усе",
  tabNewApps: "Новыя праграмы",
  tabExistingApps: "Існуючыя",
  tabMyIdeas: "Мае ідэі",
  tabForMyApps: "Для маіх праграм",
  tabMyWork: "Мая праца",
  stOpen: "Адкрыта",
  stWork: "У працы",
  stReleased: "Выпушчана",
  sortTop: "Папулярныя",
  sortNew: "Новыя",
  vote: "Галасаваць",
  voted: "Вы за",
  // TODO(i18n): n => `${n} ${pl(n, 'каментар', 'каментары', 'каментароў')}`
  commentsCount: "TODO",
  you: "Вы",
  // TODO(i18n): c => `${c} працуе над гэтым`
  onIt: "TODO",
  // TODO(i18n): (a, v) => `Выпушчана як ${a} ${v}`
  releasedAs: "TODO",
  howItWorks: "Як гэта працуе",
  how1T: "Прапануйце",
  how1B: "Інструмент, якога не хапае, або паляпшэнне праграмы, якой вы ўжо карыстаецеся.",
  how2T: "Галасуйце",
  how2B: "Папулярныя ідэі падымаюцца ўверх — распрацоўшчыкі бачаць, што важна.",
  how3T: "Распрацоўшчык бярэ ідэю",
  how3B: "Пакуль ідзе праца, ідэя замацаваная за ім. Вы даведаецеся адразу, як яна выйдзе.",
  how4T: "Падзяка",
  how4B: "Аўтар выпушчанай ідэі атрымлівае 3 месяцы Paparats Pro.",
  yourIdeas: "Вашы ідэі",
  noMyIdeas: "Вы пакуль нічога не прапанавалі.",
  ideaReleasedTitle: "Ваша ідэя стала праграмай",
  // TODO(i18n): (title, dev, app) => `«${title}» цяпер даступная як ${app} — ад ${dev}. Дзякуй — вас чакаюць 3 месяцы Paparats Pro.`
  ideaReleasedBody: "TODO",
  activateBonus: "Актываваць 3 месяцы Pro",
  // TODO(i18n): d => `Paparats Pro дзейнічае да ${d}`
  bonusActive: "TODO",
  // TODO(i18n): a => `Адкрыць ${a}`
  openAppBtn: "TODO",
  gotIt: "Зразумела",
  ideaTitle: "Назва",
  ideaTitlePlaceholder: "Кароткая і ясная назва ідэі",
  ideaBody: "Апісанне",
  ideaBodyPlaceholder: "Што яна павінна рабіць? Чаму гэта важна? Ці ёсць нешта падобнае?",
  whichApp: "Якая праграма?",
  publish: "Апублікаваць",
  ideaPublished: "Ідэя апублікаваная — распрацоўшчыкі ўжо яе бачаць",
  ideaTitleShort: "Дайце ідэі назву не менш як з 6 знакаў.",
  ideaFooter:
    "Распрацоўшчыкі бачаць новыя ідэі адразу. Калі вашу выпусцяць, вы атрымаеце 3 месяцы Paparats Pro.",
  takeShort: "Узяць",
  // TODO(i18n): c => `Ідэя будзе замацаваная за ${c}. Аўтар і ўсе, хто галасаваў, атрымаюць паведамленне.`
  takeHint: "TODO",
  // TODO(i18n): c => `У працы ў ${c}`
  takenByOther: "TODO",
  // TODO(i18n): (a, n) => `Паведамленне атрымаюць ${a} і яшчэ ${n} ${pl(n, 'чалавек', 'чалавекі', 'чалавек')}, якія галасавалі. Аўтар атрымае 3 месяцы Paparats Pro.`
  releaseNote: "TODO",
  statusOpenHint: "Адкрыта для распрацоўшчыкаў. Чым больш галасоў, тым хутчэй хтосьці возьмецца.",
  // TODO(i18n): (c, d) => `У працы ў ${c} з ${d}.`
  statusWorkHint: "TODO",
  // TODO(i18n): (a, d) => `Выйшла як ${a} ${d}.`
  statusReleasedHint: "TODO",
  tlProposed: "Прапанавана",
  tlWork: "У працы",
  tlReleased: "Выпушчана",
  tlPending: "Пакуль не",
  // TODO(i18n): c => `Рэжым распрацоўшчыка · ${c}`
  devView: "TODO",
  devViewHint:
    "Вы бачыце тое, што бачыць аўтар канала: бярыце адкрытыя ідэі і адзначайце іх выпушчанымі.",
  inWorkN: "У працы",
  releasedN: "Выпушчана",
  forYourApps: "Для вашых праграм",
  noIdeas: "Пакуль пуста",
  noIdeasHint: "Прапануйце нешта першым.",
};
