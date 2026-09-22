import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { IdeaStatus } from "@/services/types";
import type { AppIconSource } from "../AppCard";
import { AppIcon } from "../AppIcon";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import { StatusPill } from "../StatusPill";
import { VoteButton } from "../VoteButton";
import styles from "./IdeaCard.module.css";

/** What the idea is about: an existing app ("For <App>") or a new one ("New app · <Category>"). */
export type IdeaKindView =
  { type: "app"; appName: string; icon: AppIconSource } | { type: "new"; categoryLabel: string };

/** The status line after the pill: 8px dot in the developer's tint + a sentence. */
export interface IdeaDeveloperView {
  /** Per-item data colour (channel or app tint). */
  tint: string;
  /** "Nilesoft is on it" / "Released as Shell 1.9.19" (preformatted). */
  label: string;
}

export const IDEA_STATUS_KEY = {
  open: "ideas.stOpen",
  work: "ideas.stWork",
  released: "ideas.stReleased",
} as const satisfies Record<IdeaStatus, string>;

export interface IdeaCardProps {
  title: string;
  /** Up to ~150 characters (`domain/ideas.excerpt`). */
  excerpt: string;
  votes: number;
  voted: boolean;
  onVote: () => void;
  kind: IdeaKindView;
  status: IdeaStatus;
  developer?: IdeaDeveloperView;
  /** Author name, or "You" for the viewer's own ideas. */
  author: string;
  /** Relative date, preformatted ("3 days ago"). */
  date: string;
  comments: number;
  onOpen: () => void;
  /** Developer view: shows the 30px Take button. */
  onTake?: () => void;
  className?: string;
}

/**
 * Ideas board card — grid `56px 1fr`, gap 16: vote button, title + excerpt, meta row with the kind
 * chip, status pill, developer line and author · date · comments (prototype lines 1229–1245).
 */
export function IdeaCard({
  title,
  excerpt,
  votes,
  voted,
  onVote,
  kind,
  status,
  developer,
  author,
  date,
  comments,
  onOpen,
  onTake,
  className,
}: IdeaCardProps) {
  const { t, i18n } = useTranslation();
  // The whole card opens the idea by mouse; the title button is the keyboard route.
  const onCardClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    onOpen();
  };
  return (
    <article className={cx(styles.card, className)} onClick={onCardClick}>
      <VoteButton votes={votes} voted={voted} onVote={onVote} />
      <div className={styles.main}>
        <div className={styles.head}>
          <div className={styles.text}>
            <h3 className={styles.titleWrap}>
              <button type="button" className={styles.title} onClick={onOpen}>
                {title}
              </button>
            </h3>
            <p className={styles.excerpt}>{excerpt}</p>
          </div>
          {onTake && (
            <Button
              size="xs"
              className={styles.take}
              onClick={(event) => {
                event.stopPropagation();
                onTake();
              }}
            >
              {t("ideas.takeShort")}
            </Button>
          )}
        </div>
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
          <StatusPill status={status} label={t(IDEA_STATUS_KEY[status])} />
          {developer && (
            <span className={styles.developer}>
              <span
                className={styles.devDot}
                style={{ backgroundColor: developer.tint }}
                aria-hidden="true"
              />
              {developer.label}
            </span>
          )}
          <span className={styles.spacer} />
          <span>{t("common.ideaBy", { author })}</span>
          <span aria-hidden="true">·</span>
          <span>{date}</span>
          <span aria-hidden="true">·</span>
          <span className={styles.comments} title={t("ideas.commentsCount", { count: comments })}>
            <Icon name="message-circle" size={13} strokeWidth={2} />
            {new Intl.NumberFormat(i18n.language).format(comments)}
          </span>
        </div>
      </div>
    </article>
  );
}
