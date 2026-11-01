import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { fundingName, projectAge, repoUrl } from "@/domain/project";
import { useChannelContext, useFeatures, useToday } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useSystemActions } from "@/queries";
import type { App } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import page from "./AppScreen.module.css";
import styles from "./AppDetails.module.css";

const ignore = () => undefined;

/**
 * Details table, then Report a problem and Suggest an improvement (prototype lines 1040–1045).
 * An app from the real catalog adds its GitHub project — repository, stars, age, website — and
 * "Support the author" links from its `FUNDING.yml`; its problems are reported on GitHub (D68).
 */
export function AppDetails({ app }: { app: App }) {
  const { t } = useTranslation();
  const format = useFormat();
  const today = useToday();
  const features = useFeatures();
  const channels = useChannelContext();
  const { openExternal } = useSystemActions();
  const openDialog = useDialogStore((s) => s.open);
  const sourceId = channels.sourceOf(app);
  const project = app.source ?? null;
  const open = (url: string) => void openExternal(url).catch(ignore);

  const link = (label: string, url: string) => (
    <button type="button" className={styles.link} onClick={() => open(url)}>
      {label}
    </button>
  );

  const age = project ? projectAge(project.since, today) : null;
  const ageText =
    age === null
      ? ""
      : age.unit === "new"
        ? t("app.projectAgeNew")
        : age.unit === "months"
          ? t("app.projectAgeMonths", { count: age.count })
          : t("app.projectAgeYears", { count: age.count });

  const rows: Array<[label: string, value: ReactNode] | null> = [
    [t("common.version"), app.version],
    [t("app.size"), format.size(app.sizeMb)],
    [t("app.updated"), format.date(app.updated)],
    [t("app.license"), app.license],
    [t("app.publisher"), app.publisher],
    features.channels ? [t("common.source"), channels.byId[sourceId]?.name ?? ""] : null,
    [t("common.category"), t(`categories.items.${app.category}.label`)],
    [t("common.portable"), app.portable ? t("app.yes") : t("app.no")],
    [t("app.requires"), t("app.requiresValue")],
    project ? [t("app.repository"), link(project.repo, repoUrl(project.repo))] : null,
    project ? [t("app.stars"), format.number(project.stars)] : null,
    project ? [t("app.projectAge"), ageText] : null,
    project?.homepage
      ? [t("app.homepage"), link(hostOf(project.homepage), project.homepage)]
      : null,
  ];
  const funding = project?.funding ?? [];

  return (
    <div className={styles.details}>
      <h2 className={`${page.heading} ${styles.heading}`}>{t("common.details")}</h2>
      <dl className={styles.table}>
        {rows.map((row) =>
          row === null ? null : (
            <div key={row[0]} className={styles.row}>
              <dt className={styles.label}>{row[0]}</dt>
              <dd className={styles.value}>{row[1]}</dd>
            </div>
          ),
        )}
      </dl>
      <div className={styles.actions}>
        <Button
          variant="outline"
          size="sm"
          className={styles.action}
          leadingIcon={<Icon name="flag" size={14} strokeWidth={2} />}
          onClick={() =>
            project
              ? open(`${repoUrl(project.repo)}/issues`)
              : openDialog({ kind: "report", target: { appId: app.id, channelId: sourceId } })
          }
        >
          {t("common.reportProblem")}
        </Button>
        {features.ideas && (
          <Button
            variant="outline"
            size="sm"
            className={styles.action}
            leadingIcon={<Icon name="lightbulb" size={14} strokeWidth={2} />}
            onClick={() => openDialog({ kind: "suggestIdea", appId: app.id })}
          >
            {t("app.suggestImprovement")}
          </Button>
        )}
        {funding.map((url) => (
          <Button
            key={url}
            variant="outline"
            size="sm"
            className={styles.action}
            leadingIcon={<Icon name="heart" size={14} strokeWidth={2} />}
            onClick={() => open(url)}
            title={url}
          >
            {funding.length === 1
              ? t("app.supportAuthor")
              : `${t("app.supportAuthor")}: ${fundingName(url)}`}
          </Button>
        ))}
      </div>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
