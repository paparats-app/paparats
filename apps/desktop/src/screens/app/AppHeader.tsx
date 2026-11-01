import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { AppIcon } from "@/components/AppIcon";
import { Chip } from "@/components/Chip";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ProgressBar";
import { ProPill } from "@/components/ProPill";
import { SplitButton } from "@/components/SplitButton";
import { isBusy } from "@/domain/apps";
import { pickText } from "@/domain/text";
import { useAppAction, useChannelContext, useFeatures, useLocale } from "@/hooks";
import { useFormat, type Format } from "@/i18n/format";
import { useLibrary, useLibraryActions } from "@/queries";
import { useDownloadStatus } from "@/screens/shared";
import type { App } from "@/services/types";
import styles from "./AppHeader.module.css";

const ignore = () => undefined;

/**
 * 96px icon | name, publisher, chips, tagline, source notes | the primary action with its
 * progress (prototype lines 969–998). An app from the real catalog also says when its version is
 * early, when it comes from the author of Paparats, when its author signs nothing and when its
 * installer asks for administrator rights (D68).
 */
export function AppHeader({ app }: { app: App }) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const { go } = useNav();
  const features = useFeatures();
  const channels = useChannelContext();
  const sourceId = channels.sourceOf(app);
  // Without channels every app comes from the official catalog: nothing to name or compare.
  const source = features.channels ? channels.byId[sourceId] : undefined;
  const alternatives = features.channels
    ? channels.alternativesOf(app).flatMap((id) => channels.byId[id]?.name ?? [])
    : [];
  const project = app.source;

  let sourceNote: string | null = null;
  if (source?.trust === "verified") sourceNote = t("app.srcVerifiedNote", { channel: source.name });
  if (source?.trust === "community") {
    sourceNote = t("app.srcCommunityNote", { channel: source.name });
  }

  return (
    <header className={styles.header}>
      <AppIcon
        mono={app.mono}
        tint={app.tint}
        iconUrl={app.iconUrl}
        size={96}
        className={styles.icon}
      />
      <div className={styles.main}>
        <h1 className={styles.title}>{app.name}</h1>
        <div className={styles.meta}>
          <span>{app.publisher}</span>
          {source && (
            <Chip
              tone="outline"
              dot={source.tint}
              title={t("common.source")}
              onClick={() => go({ to: "channel", channelId: source.id })}
              className={styles.channel}
            >
              {source.name}
            </Chip>
          )}
          <Chip className={styles.chip}>{t(`categories.items.${app.category}.label`)}</Chip>
          <Chip tone="mint" className={styles.chip}>
            {t("common.free")}
          </Chip>
          {features.pro && app.pro && <ProPill label={t("common.pro")} className={styles.pro} />}
          {project?.early && <Chip className={styles.chip}>{t("app.early")}</Chip>}
          {project?.byPaparatsAuthor && (
            <Chip tone="outline" className={styles.chip}>
              {t("app.byPaparatsAuthor")}
            </Chip>
          )}
        </div>
        <p className={styles.tagline}>{pickText(app.tagline, locale)}</p>
        {sourceNote !== null && (
          <div className={`${styles.note} ${styles.sourceNote}`}>
            <Icon name="info-serif" size={15} strokeWidth={2} className={styles.noteIcon} />
            <span>{sourceNote}</span>
          </div>
        )}
        {project?.unsigned && (
          <div className={`${styles.note} ${styles.sourceNote}`}>
            <Icon name="shield" size={15} strokeWidth={2} className={styles.noteIcon} />
            <span>{t("app.unsignedNote")}</span>
          </div>
        )}
        {project?.needsAdmin && (
          <div className={`${styles.note} ${styles.sourceNote}`}>
            <Icon name="key-round" size={15} strokeWidth={2} className={styles.noteIcon} />
            <span>{t("app.needsAdminNote")}</span>
          </div>
        )}
        {alternatives.length > 0 && (
          <div className={`${styles.note} ${styles.altNote}`}>
            <Icon name="git-branch" size={15} strokeWidth={2} className={styles.noteIcon} />
            <span>
              {t("app.alsoIn", { channels: format.list(alternatives) })} {t("app.srcRule")}
            </span>
          </div>
        )}
      </div>
      <AppActionPanel app={app} format={format} />
    </header>
  );
}

/** The split action (primary + favourite), then the progress bar and status, or the sub line. */
function AppActionPanel({ app, format }: { app: App; format: Format }) {
  const { t } = useTranslation();
  const action = useAppAction(app);
  const favorites = useLibrary().data?.favorites;
  const { setFavorite } = useLibraryActions();
  const isFavorite = favorites?.includes(app.id) ?? false;
  const busy = isBusy(action.state);
  const status = useDownloadStatus(app, action.state, action.progress);

  return (
    <div className={styles.aside}>
      <SplitButton
        size="lg"
        label={action.label}
        tone={action.tone}
        disabled={action.disabled}
        onClick={action.run}
        secondaryIcon="star"
        secondaryLabel={t(isFavorite ? "common.removeFavorite" : "common.addFavorite")}
        secondaryPressed={isFavorite}
        onSecondaryClick={() => void setFavorite(app.id, !isFavorite).catch(ignore)}
        className={styles.split}
      />
      {busy ? (
        <div className={styles.busy}>
          <ProgressBar value={action.progress} height={4} label={app.name} />
          <div className={styles.status}>
            <span className={styles.statusText}>{status?.text}</span>
            <button type="button" className={styles.cancel} onClick={action.cancel}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.sub}>
          {[t("common.free"), format.size(app.sizeMb), app.license].join(" · ")}
        </div>
      )}
    </div>
  );
}
