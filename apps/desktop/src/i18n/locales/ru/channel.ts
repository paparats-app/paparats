import type { channel as En } from "../en/channel";
import type { LocaleCatalog } from "../../types";

export const channel: LocaleCatalog<typeof En> = {
  subscribed: "Вы подписаны",
  // TODO(i18n): c => `Вы подписались на ${c}`
  subscribedTo: "TODO",
  // TODO(i18n): c => `Вы отписались от ${c}`
  unsubscribedFrom: "TODO",
  // TODO(i18n): c => `${c} приостановлен`
  channelPausedMsg: "TODO",
  // TODO(i18n): c => `${c} снова включён`
  channelResumedMsg: "TODO",
  proNotCovered: "Приложения из этого канала не входят в Paparats Pro.",
  officialNote: "Ваш источник по умолчанию. Его нельзя удалить.",
  copyAddr: "Копировать адрес",
  syncNow: "Синхронизировать",
  inChannel: "Приложения в этом канале",
  noChannelApps: "Пока пусто",
  noChannelAppsHint: "Автор ещё не опубликовал приложения.",
};
