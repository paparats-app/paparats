import type { channel as En } from "../en/channel";
import type { LocaleCatalog } from "../../types";

export const channel: LocaleCatalog<typeof En> = {
  subscribed: "Вы падпісаны",
  // TODO(i18n): c => `Вы падпісаліся на ${c}`
  subscribedTo: "TODO",
  // TODO(i18n): c => `Вы адпісаліся ад ${c}`
  unsubscribedFrom: "TODO",
  // TODO(i18n): c => `${c} прыпынены`
  channelPausedMsg: "TODO",
  // TODO(i18n): c => `${c} зноў уключаны`
  channelResumedMsg: "TODO",
  proNotCovered: "Праграмы з гэтага канала не ўваходзяць у Paparats Pro.",
  officialNote: "Ваша крыніца па змаўчанні. Яе нельга выдаліць.",
  copyAddr: "Капіяваць адрас",
  syncNow: "Сінхранізаваць",
  inChannel: "Праграмы ў гэтым канале",
  noChannelApps: "Пакуль пуста",
  noChannelAppsHint: "Аўтар яшчэ не апублікаваў праграмы.",
};
