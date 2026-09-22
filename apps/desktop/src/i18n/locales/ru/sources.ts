import type { sources as En } from "../en/sources";
import type { LocaleCatalog } from "../../types";

export const sources: LocaleCatalog<typeof En> = {
  sources: "Источники",
  sourcesSub: "Каналы, из которых Paparats устанавливает приложения и обновления.",
  channel: "Канал",
  addChannel: "Добавить канал",
  channelAddr: "Адрес канала",
  channelAddrHint: "Вставьте ссылку от автора или короткий код, например @winaero.",
  channelAddrPlaceholder: "https://… или @название",
  add: "Добавить",
  catalog: "Каталог каналов",
  alwaysOn: "Всегда включён",
  enabledCh: "Включён",
  pausedCh: "Приостановлен",
  trustOfficial: "Официальный",
  trustVerified: "Проверенный",
  trustCommunity: "Сообщество",
  trustOfficialHint: "Каталог Paparats. Отобран, протестирован и подписан нами.",
  trustVerifiedHint:
    "Автор и канал проверены командой Paparats. Файлы зеркалирует Paparats; приложения остаются ответственностью автора.",
  trustLevels: "Уровни доверия",
  kindCatalog: "Каталог",
  kindDeveloper: "Разработчик",
  kindCurated: "Подборка",
  // TODO(i18n): a => `от ${a}`
  byAuthor: "TODO",
  // TODO(i18n): n => `${n.toLocaleString('ru')} ${pl(n, 'подписчик', 'подписчика', 'подписчиков')}`
  subscribersCount: "TODO",
  // TODO(i18n): r => `Синхронизировано ${r}`
  syncedRel: "TODO",
  neverSynced: "Ещё не синхронизирован",
  // TODO(i18n): n => `${n} ${pl(n, 'канал', 'канала', 'каналов')}`
  channelsCount: "TODO",
  notFound: "По этому адресу канала нет",
  notFoundHint: "Проверьте ссылку или попросите у автора короткий код.",
  alreadySubscribed: "Вы уже подписаны на этот канал.",
  // TODO(i18n): c => `Добавить ${c}?`
  confirmChannelTitle: "TODO",
  confirmChannelBody:
    "Это канал сообщества. Paparats не проверял его приложения — они приходят напрямую с сервера автора и не входят в Paparats Pro. Добавляйте только каналы, автору которых доверяете.",
  addrCopied: "Адрес скопирован",
  channelSynced: "Канал синхронизирован",
  address: "Адрес",
  trust: "Доверие",
  type: "Тип",
  author: "Автор",
  lastSync: "Последняя синхронизация",
  catalogEmpty: "Вы подписаны на все каналы из каталога.",
  hostLabel: "Файлы",
  hostAuthor: "Сервер автора",
  hostMirrored: "Автор + зеркало Paparats",
  hostPaparats: "CDN Paparats",
  reviewedLabel: "Проверка",
  // TODO(i18n): d => `Команда Paparats, ${d}`
  reviewedBy: "TODO",
  notReviewed: "Не проверен",
  supportLabel: "Поддержка",
  // TODO(i18n): n => `Недоступен ${n} ${pl(n, 'день', 'дня', 'дней')}`
  unreachableFor: "TODO",
  // TODO(i18n): (c, n) => `${c} не отвечает ${n} ${pl(n, 'день', 'дня', 'дней')}`
  staleTitle: "TODO",
  // TODO(i18n): c => `${c} всё ещё недоступен`
  stillUnreachable: "TODO",
};
