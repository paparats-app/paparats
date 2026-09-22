import type { sources as En } from "../en/sources";
import type { LocaleCatalog } from "../../types";

export const sources: LocaleCatalog<typeof En> = {
  sources: "Крыніцы",
  sourcesSub: "Каналы, з якіх Paparats усталёўвае праграмы і абнаўленні.",
  channel: "Канал",
  addChannel: "Дадаць канал",
  channelAddr: "Адрас канала",
  channelAddrHint: "Устаўце спасылку ад аўтара або кароткі код, напрыклад @winaero.",
  channelAddrPlaceholder: "https://… або @назва",
  add: "Дадаць",
  catalog: "Каталог каналаў",
  alwaysOn: "Заўсёды ўключаны",
  enabledCh: "Уключаны",
  pausedCh: "Прыпынены",
  trustOfficial: "Афіцыйны",
  trustVerified: "Правераны",
  trustCommunity: "Супольнасць",
  trustOfficialHint: "Каталог Paparats. Адабраны, пратэставаны і падпісаны намі.",
  trustVerifiedHint:
    "Аўтар і канал правераны камандай Paparats. Файлы люструе Paparats; праграмы застаюцца адказнасцю аўтара.",
  trustLevels: "Узроўні даверу",
  kindCatalog: "Каталог",
  kindDeveloper: "Распрацоўшчык",
  kindCurated: "Падборка",
  // TODO(i18n): a => `ад ${a}`
  byAuthor: "TODO",
  // TODO(i18n): n => `${n.toLocaleString('ru')} ${pl(n, 'падпісчык', 'падпісчыкі', 'падпісчыкаў')}`
  subscribersCount: "TODO",
  // TODO(i18n): r => `Сінхранізавана ${r}`
  syncedRel: "TODO",
  neverSynced: "Яшчэ не сінхранізавана",
  // TODO(i18n): n => `${n} ${pl(n, 'канал', 'каналы', 'каналаў')}`
  channelsCount: "TODO",
  notFound: "Па гэтым адрасе канала няма",
  notFoundHint: "Праверце спасылку або папрасіце ў аўтара кароткі код.",
  alreadySubscribed: "Вы ўжо падпісаны на гэты канал.",
  // TODO(i18n): c => `Дадаць ${c}?`
  confirmChannelTitle: "TODO",
  confirmChannelBody:
    "Гэта канал супольнасці. Paparats не правяраў яго праграмы — яны прыходзяць напрамую з сервера аўтара і не ўваходзяць у Paparats Pro. Дадавайце толькі каналы, аўтару якіх давяраеце.",
  addrCopied: "Адрас скапіяваны",
  channelSynced: "Канал сінхранізаваны",
  address: "Адрас",
  trust: "Давер",
  type: "Тып",
  author: "Аўтар",
  lastSync: "Апошняя сінхранізацыя",
  catalogEmpty: "Вы падпісаны на ўсе каналы з каталога.",
  hostLabel: "Файлы",
  hostAuthor: "Сервер аўтара",
  hostMirrored: "Аўтар + люстэрка Paparats",
  hostPaparats: "CDN Paparats",
  reviewedLabel: "Праверка",
  // TODO(i18n): d => `Каманда Paparats, ${d}`
  reviewedBy: "TODO",
  notReviewed: "Не правераны",
  supportLabel: "Падтрымка",
  // TODO(i18n): n => `Недаступны ${n} ${pl(n, 'дзень', 'дні', 'дзён')}`
  unreachableFor: "TODO",
  // TODO(i18n): (c, n) => `${c} не адказвае ${n} ${pl(n, 'дзень', 'дні', 'дзён')}`
  staleTitle: "TODO",
  // TODO(i18n): c => `${c} усё яшчэ недаступны`
  stillUnreachable: "TODO",
};
