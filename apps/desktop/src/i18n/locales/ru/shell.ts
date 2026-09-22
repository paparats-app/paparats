import type { shell as En } from "../en/shell";
import type { LocaleCatalog } from "../../types";

export const shell: LocaleCatalog<typeof En> = {
  search: "Поиск приложений, инструментов, идей…",
  offlineHint: "Библиотека работает. Загрузки и обновления продолжатся, когда появится сеть.",
  retry: "Повторить",
};
