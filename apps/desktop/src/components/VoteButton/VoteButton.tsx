import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "@/i18n/format";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./VoteButton.module.css";

export interface VoteButtonProps {
  votes: number;
  voted: boolean;
  onVote: () => void;
  /** `card` 56×56 (idea list) · `detail` 72×76 with an uppercase Vote/Voted label (idea page). */
  size?: "card" | "detail";
  className?: string;
}

/**
 * Upvote toggle: chevron-up + tabular count. Idle `--card2`/`--text`, voted `--mint`/`--ink`
 * (prototype lines 1230 and 1287). Clicks do not bubble to a clickable card.
 */
export function VoteButton({ votes, voted, onVote, size = "card", className }: VoteButtonProps) {
  const { t } = useTranslation();
  const format = useNumberFormat();
  const detail = size === "detail";
  const verb = voted ? t("ideas.voted") : t("ideas.vote");
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onVote();
  };
  return (
    <button
      type="button"
      className={cx(styles.vote, styles[size], voted && styles.voted, className)}
      aria-pressed={voted}
      aria-label={t("common.votesCount", { count: votes })}
      title={verb}
      onClick={onClick}
    >
      <Icon name="chevron-up" size={detail ? 18 : 14} strokeWidth={2.4} />
      <span className={styles.count}>{format.number(votes)}</span>
      {detail && <span className={styles.verb}>{verb}</span>}
    </button>
  );
}
