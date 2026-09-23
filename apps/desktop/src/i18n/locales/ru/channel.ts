import type { channel as En } from "../en/channel";
import type { LocaleCatalog } from "../../types";

export const channel: LocaleCatalog<typeof En> = {
  subscribed: "Вы подписаны",
  subscribedTo: "Вы подписались на {{channel}}",
  unsubscribedFrom: "Вы отписались от {{channel}}",
  channelPausedMsg: "{{channel}} приостановлен",
  channelResumedMsg: "{{channel}} снова включён",
  proNotCovered: "Приложения из этого канала не входят в Paparats Pro.",
  officialNote: "Ваш источник по умолчанию. Его нельзя удалить.",
  copyAddr: "Копировать адрес",
  syncNow: "Синхронизировать",
  inChannel: "Приложения в этом канале",
  noChannelApps: "Пока пусто",
  noChannelAppsHint: "Автор ещё не опубликовал приложения.",
  notFound: "Канал не найден",
  notFoundHint: "Возможно, он больше недоступен.",
  notProvided: "—",
};
