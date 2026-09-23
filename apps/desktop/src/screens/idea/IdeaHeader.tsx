import { useTranslation } from "react-i18next";
import { AppIcon } from "@/components/AppIcon";
import { Chip } from "@/components/Chip";
import { StatusPill } from "@/components/StatusPill";
import { VoteButton } from "@/components/VoteButton";
import { useIdeaActions } from "@/queries";
import type { Idea } from "@/services/types";
import { IdeaStatusCard } from "./IdeaStatusCard";
import type { IdeaDetailView } from "./ideaDetail";
import styles from "./IdeaHeader.module.css";

export interface IdeaHeaderProps {
  idea: Idea;
  detail: IdeaDetailView;
}

/**
 * Header grid `72px minmax(0,1fr) 300px` (lines 1286–1315): the 72×76 vote button; the kind chip,
 * status pill, author and date; the title and body; the status card.
 */
export function IdeaHeader({ idea, detail }: IdeaHeaderProps) {
  const { t } = useTranslation();
  const { vote } = useIdeaActions();
  const { kind } = detail;
  return (
    <header className={styles.header}>
      <VoteButton
        size="detail"
        votes={idea.votes}
        voted={idea.voted}
        onVote={() => void vote(idea.id).catch(() => undefined)}
      />
      <div className={styles.main}>
        <div className={styles.meta}>
          {kind.type === "app" ? (
            <Chip
              leading={
                <AppIcon
                  mono={kind.icon.mono}
                  tint={kind.icon.tint}
                  iconUrl={kind.icon.iconUrl}
                  size={16}
                />
              }
            >
              {t("ideas.ideaForApp", { app: kind.appName })}
            </Chip>
          ) : (
            <Chip>{t("ideas.ideaNewIn", { category: kind.categoryLabel })}</Chip>
          )}
          <StatusPill status={idea.status} label={detail.statusLabel} />
          <span>{t("common.ideaBy", { author: detail.author })}</span>
          <span aria-hidden="true">·</span>
          <span>{detail.date}</span>
        </div>
        <h1 className={styles.title}>{detail.title}</h1>
        <p className={styles.body}>{detail.body}</p>
      </div>
      <IdeaStatusCard idea={idea} detail={detail} />
    </header>
  );
}
