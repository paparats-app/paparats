import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useChannelContext } from "@/hooks";
import { useFormat } from "@/i18n/format";
import type { App } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import page from "./AppScreen.module.css";
import styles from "./AppDetails.module.css";

/** Details table, then Report a problem and Suggest an improvement (prototype lines 1040–1045). */
export function AppDetails({ app }: { app: App }) {
  const { t } = useTranslation();
  const format = useFormat();
  const channels = useChannelContext();
  const openDialog = useDialogStore((s) => s.open);
  const sourceId = channels.sourceOf(app);

  const rows: Array<[label: string, value: string]> = [
    [t("common.version"), app.version],
    [t("app.size"), format.size(app.sizeMb)],
    [t("app.updated"), format.date(app.updated)],
    [t("app.license"), app.license],
    [t("app.publisher"), app.publisher],
    [t("common.source"), channels.byId[sourceId]?.name ?? ""],
    [t("common.category"), t(`categories.items.${app.category}.label`)],
    [t("common.portable"), app.portable ? t("app.yes") : t("app.no")],
    [t("app.requires"), t("app.requiresValue")],
  ];

  return (
    <div className={styles.details}>
      <h2 className={`${page.heading} ${styles.heading}`}>{t("common.details")}</h2>
      <dl className={styles.table}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <Button
          variant="outline"
          size="sm"
          className={styles.action}
          leadingIcon={<Icon name="flag" size={14} strokeWidth={2} />}
          onClick={() =>
            openDialog({ kind: "report", target: { appId: app.id, channelId: sourceId } })
          }
        >
          {t("common.reportProblem")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={styles.action}
          leadingIcon={<Icon name="lightbulb" size={14} strokeWidth={2} />}
          onClick={() => openDialog({ kind: "suggestIdea", appId: app.id })}
        >
          {t("app.suggestImprovement")}
        </Button>
      </div>
    </div>
  );
}
