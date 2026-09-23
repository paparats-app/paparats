// The board's right column (Paparats Prototype.dc.html lines 1250–1280): the developer panel
// (developer view), How it works, and Your ideas with the "Activate 3 months of Pro" rail
// (user view).
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { IDEA_STATUS_KEY } from "@/components/IdeaCard";
import { StatTile } from "@/components/StatTile";
import { StatusPill } from "@/components/StatusPill";
import { useFormat } from "@/i18n/format";
import { useBusyAction, useIdeaView } from "@/screens/shared";
import { useActivateBonus } from "./useActivateBonus";
import type { IdeasBoard } from "./useIdeasBoard";
import styles from "./IdeasAside.module.css";

const HOW_STEPS = [
  { n: 1, title: "ideas.how1T", body: "ideas.how1B" },
  { n: 2, title: "ideas.how2T", body: "ideas.how2B" },
  { n: 3, title: "ideas.how3T", body: "ideas.how3B" },
  { n: 4, title: "ideas.how4T", body: "ideas.how4B" },
] as const;

export function IdeasAside({ board }: { board: IdeasBoard }) {
  return (
    <aside className={styles.aside}>
      {board.view === "developer" && <DeveloperPanel board={board} />}
      <HowItWorks />
      {board.view === "user" && <YourIdeas board={board} />}
    </aside>
  );
}

/** The channel the developer view acts as, its hint and three numbers (prototype line 1252). */
function DeveloperPanel({ board }: { board: IdeasBoard }) {
  const { t } = useTranslation();
  const format = useFormat();
  const titleId = useId();
  const channel = board.developer.channel;
  const stats = [
    { value: board.devStats.work, label: t("ideas.inWorkN") },
    { value: board.devStats.released, label: t("ideas.releasedN") },
    { value: board.devStats.forApps, label: t("ideas.forYourApps") },
  ];
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.devHead}>
        {channel && (
          <AppIcon mono={channel.mono} tint={channel.tint} size={40} className={styles.devTile} />
        )}
        <div className={styles.devName}>
          <h2 id={titleId} className={styles.devTitle}>
            {channel?.name ?? ""}
          </h2>
          <div className={styles.devRole}>{t("common.developer")}</div>
        </div>
      </div>
      <p className={styles.devHint}>{t("ideas.devViewHint")}</p>
      <div className={styles.devStats}>
        {stats.map((stat) => (
          <StatTile
            key={stat.label}
            variant="compact"
            value={format.number(stat.value)}
            label={stat.label}
          />
        ))}
      </div>
    </section>
  );
}

/** Four numbered steps in 24px mint circles (prototype lines 1260–1267). */
function HowItWorks() {
  const { t } = useTranslation();
  const format = useFormat();
  const titleId = useId();
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.howTitle}>
        {t("ideas.howItWorks")}
      </h2>
      <ol className={styles.steps}>
        {HOW_STEPS.map((step) => (
          <li key={step.n} className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              {format.number(step.n)}
            </span>
            <div className={styles.stepText}>
              <div className={styles.stepTitle}>{t(step.title)}</div>
              <div className={styles.stepBody}>{t(step.body)}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The user's ideas with their status and "N votes · date"; the rail activates the thank-you
 * when a released idea's bonus is unclaimed and no note is showing (prototype lines 1268–1278).
 */
function YourIdeas({ board }: { board: IdeasBoard }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { go } = useNav();
  const view = useIdeaView();
  const activate = useActivateBonus();
  const [activating, runActivate] = useBusyAction();
  const titleId = useId();
  const showRail =
    !board.bonusClaimed &&
    board.notes.length === 0 &&
    board.mine.some((idea) => idea.status === "released");

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.yourTitle}>
        {t("ideas.yourIdeas")}
      </h2>
      {board.mine.length > 0 ? (
        <ul className={styles.rows}>
          {board.mine.map((idea) => (
            <li key={idea.id} className={styles.rowItem}>
              <button
                type="button"
                className={styles.row}
                onClick={() => go({ to: "idea", ideaId: idea.id })}
              >
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{view.title(idea)}</span>
                  <span className={styles.rowSub}>
                    {`${t("common.votesCount", { count: idea.votes })} · ${format.relative(idea.date)}`}
                  </span>
                </span>
                <StatusPill
                  status={idea.status}
                  label={t(IDEA_STATUS_KEY[idea.status])}
                  className={styles.rowStatus}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{t("ideas.noMyIdeas")}</p>
      )}
      {showRail && (
        <Button
          size="sm"
          tone="progress"
          fullWidth
          className={styles.rail}
          loading={activating}
          onClick={() => void runActivate(() => activate([]))}
        >
          {t("ideas.activateBonus")}
        </Button>
      )}
    </section>
  );
}
