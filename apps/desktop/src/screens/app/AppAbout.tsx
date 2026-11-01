import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { pickText } from "@/domain/text";
import { useFeatures, useLocale, useViewAs } from "@/hooks";
import { useAccount, useIdeas } from "@/queries";
import type { App, Idea } from "@/services/types";
import page from "./AppScreen.module.css";
import styles from "./AppAbout.module.css";

/**
 * About: the long description, the Pro features card (Pro apps), the ideas this app grew from and
 * the link to its open ideas (prototype lines 1018–1038). Pro and ideas only when the catalog
 * turns them on (D68).
 */
export function AppAbout({ app }: { app: App }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { go } = useNav();
  const features = useFeatures();
  const allIdeas = useIdeas().data;
  const ideas = features.ideas ? (allIdeas ?? []) : [];
  const origins = ideas.filter(
    (i) =>
      i.status === "released" &&
      (i.kind === "app" ? i.appId === app.id : i.releasedAppId === app.id),
  );
  const openIdeas = ideas.filter(
    (i) => i.kind === "app" && i.appId === app.id && i.status !== "released",
  ).length;

  return (
    <div className={styles.about}>
      <h2 className={`${page.heading} ${styles.heading}`}>{t("app.about")}</h2>
      <p className={styles.long}>{pickText(app.long, locale)}</p>

      {features.pro && app.pro && (
        <Card tone="mint" radius={12} className={styles.pro}>
          <Icon name="crown" size={22} className={styles.proIcon} />
          <div className={styles.proText}>
            <div className={styles.proTitle}>
              {app.proNote
                ? `${t("app.proFeatures")}: ${pickText(app.proNote, locale)}`
                : t("app.proFeatures")}
            </div>
            <div className={styles.proHint}>{t("app.proHint")}</div>
          </div>
          <Button
            variant="primary"
            size="sm"
            className={styles.proButton}
            trailingIcon={<Icon name="arrow-right" size={14} strokeWidth={2.2} />}
            onClick={() => go({ to: "subscription" })}
          >
            {t("common.learnMore")}
          </Button>
        </Card>
      )}

      {origins.length > 0 && (
        <Card radius={12} className={styles.origins}>
          <div className={styles.kicker}>
            <Icon name="lightbulb" size={14} strokeWidth={2.2} />
            {t("app.grewFromIdea")}
          </div>
          {origins.map((idea) => (
            <OriginRow
              key={idea.id}
              idea={idea}
              onOpen={() => go({ to: "idea", ideaId: idea.id })}
            />
          ))}
        </Card>
      )}

      {openIdeas > 0 && (
        <button
          type="button"
          className={styles.ideasLink}
          onClick={() => go({ to: "ideas", appFilter: app.id })}
        >
          <Icon name="lightbulb" size={14} strokeWidth={2} />
          {t("app.ideasForApp", { count: openIdeas })}
          <Icon name="arrow-right" size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

/** "Pin any window on top" + "by Alena K. · 34 votes · Released in 1.8.9" + See the idea. */
function OriginRow({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const viewAs = useViewAs();
  const profileName = useAccount().data?.profile.name;
  // The prototype's `authorOf`: your own idea reads "You" (your name in the developer view).
  const author = idea.mine
    ? viewAs === "developer" && profileName
      ? profileName
      : t("ideas.you")
    : (idea.author ?? "");
  const line = [
    t("common.ideaBy", { author }),
    t("common.votesCount", { count: idea.votes }),
    idea.releasedVersion ? t("app.releasedInVersion", { version: idea.releasedVersion }) : null,
  ].filter((part) => part !== null);

  return (
    <div className={styles.origin}>
      <div className={styles.originText}>
        <div className={styles.originTitle}>{pickText(idea.title, locale)}</div>
        <div className={styles.originLine}>{line.join(" · ")}</div>
      </div>
      <Button
        size="compact"
        className={styles.seeIdea}
        trailingIcon={<Icon name="arrow-right" size={13} strokeWidth={2.2} />}
        onClick={onOpen}
      >
        {t("app.seeIdea")}
      </Button>
    </div>
  );
}
