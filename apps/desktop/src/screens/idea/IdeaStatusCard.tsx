import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { StatusPill } from "@/components/StatusPill";
import { useTakeIdea } from "@/screens/shared";
import type { Idea } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import type { IdeaDetailView } from "./ideaDetail";
import styles from "./IdeaStatusCard.module.css";

export interface IdeaStatusCardProps {
  idea: Idea;
  detail: IdeaDetailView;
}

/**
 * The status card (lines 1298–1314): the status pill and developer, the status hint, the released
 * app with the author's thank-you note, and in the developer view Take this idea, Mark as
 * released or "In work at <developer>". A keyboard press on Take this idea moves the focus to the
 * Mark as released that replaces it.
 */
export function IdeaStatusCard({ idea, detail }: IdeaStatusCardProps) {
  const { t } = useTranslation();
  const { go } = useNav();
  const take = useTakeIdea();
  const openDialog = useDialogStore((s) => s.open);
  const [taking, setTaking] = useState(false);
  const { action, developer, releasedApp } = detail;
  const markRef = useRef<HTMLButtonElement>(null);
  const handoff = useRef(false);
  const actionType = action?.type;
  useLayoutEffect(() => {
    if (!handoff.current || actionType === "take") return;
    handoff.current = false;
    markRef.current?.focus();
  }, [actionType]);

  const takeIdea = async (event: MouseEvent<HTMLButtonElement>) => {
    if (taking) return;
    // Enter / Space fire the click with `detail` 0: only keyboard users get the focus moved.
    handoff.current = event.detail === 0;
    setTaking(true);
    // Not taken (e.g. someone else took it first): the card shows the idea as it is.
    await take(idea);
    setTaking(false);
  };

  return (
    <div className={styles.card}>
      <div className={styles.statusRow}>
        <StatusPill status={idea.status} label={detail.statusLabel} className={styles.pill} />
        {developer && (
          <span className={styles.developer}>
            <span
              className={styles.devDot}
              style={{ backgroundColor: developer.tint }}
              aria-hidden="true"
            />
            {developer.name}
          </span>
        )}
      </div>
      <div className={styles.hint}>{detail.statusHint}</div>

      {releasedApp && (
        <>
          <div className={styles.appRow}>
            <AppIcon
              mono={releasedApp.app.mono}
              tint={releasedApp.app.tint}
              iconUrl={releasedApp.app.iconUrl}
              size={36}
              className={styles.appTile}
            />
            <div className={styles.appText}>
              <div className={styles.appName}>{releasedApp.app.name}</div>
              {releasedApp.version !== "" && (
                <div className={styles.appVersion}>
                  {`${t("common.version")} ${releasedApp.version}`}
                </div>
              )}
            </div>
            <Button
              size="xs"
              className={styles.open}
              aria-label={t("ideas.openAppBtn", { app: releasedApp.app.name })}
              onClick={() => go({ to: "app", appId: releasedApp.app.id })}
            >
              {t("common.open")}
            </Button>
          </div>
          <div className={styles.bonus}>
            <Icon name="crown" size={14} strokeWidth={2} className={styles.crown} />
            <span>{t("idea.authorBonus")}</span>
          </div>
        </>
      )}

      {action?.type === "take" && (
        <>
          <Button
            variant="primary"
            size="field"
            fullWidth
            className={styles.cta}
            loading={taking}
            onClick={(event) => void takeIdea(event)}
          >
            {t("idea.takeIdea")}
          </Button>
          <div className={styles.takeHint}>
            {t("ideas.takeHint", { channel: detail.devChannelName })}
          </div>
        </>
      )}
      {action?.type === "release" && (
        <Button
          ref={markRef}
          variant="primary"
          size="field"
          fullWidth
          className={styles.cta}
          onClick={() => openDialog({ kind: "releaseIdea", ideaId: idea.id })}
        >
          {t("idea.markReleased")}
        </Button>
      )}
      {action?.type === "takenByOther" && (
        <div className={styles.takenBy}>
          {t("ideas.takenByOther", { channel: action.developer })}
        </div>
      )}
    </div>
  );
}
