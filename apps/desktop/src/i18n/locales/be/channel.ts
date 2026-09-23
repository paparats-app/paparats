import type { channel as En } from "../en/channel";
import type { LocaleCatalog } from "../../types";

export const channel: LocaleCatalog<typeof En> = {
  subscribed: "Вы падпісаны",
  subscribedTo: "Вы падпісаліся на {{channel}}",
  unsubscribedFrom: "Вы адпісаліся ад {{channel}}",
  channelPausedMsg: "{{channel}} прыпынены",
  channelResumedMsg: "{{channel}} зноў уключаны",
  proNotCovered: "Праграмы з гэтага канала не ўваходзяць у Paparats Pro.",
  officialNote: "Ваша крыніца па змаўчанні. Яе нельга выдаліць.",
  copyAddr: "Капіяваць адрас",
  syncNow: "Сінхранізаваць",
  inChannel: "Праграмы ў гэтым канале",
  noChannelApps: "Пакуль пуста",
  noChannelAppsHint: "Аўтар яшчэ не апублікаваў праграмы.",
  notFound: "Канал не знойдзены",
  notFoundHint: "Магчыма, ён больш недаступны.",
  notProvided: "—",
};
