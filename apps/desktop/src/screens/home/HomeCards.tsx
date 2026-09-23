// "Recently updated" rows: one component per app, so each can call `useAppAction()` (the
// prototype's `card()`, Paparats Prototype.dc.html lines 1880–1896).
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { CompactUpdatedRow } from "@/components/AppListItem";
import { useAppAction } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { toActionView } from "@/screens/shared";
import type { App } from "@/services/types";

/** "Recently updated": icon + name + "version · Updated 3 days ago" + a 30px action (270–276). */
export function RecentlyUpdatedRow({ app }: { app: App }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { go } = useNav();
  const action = useAppAction(app);
  return (
    <CompactUpdatedRow
      name={app.name}
      icon={{ mono: app.mono, tint: app.tint, iconUrl: app.iconUrl }}
      version={app.version}
      updated={t("common.updatedRel", { when: format.relative(app.updated) })}
      action={toActionView(action)}
      onOpen={() => go({ to: "app", appId: app.id })}
    />
  );
}
