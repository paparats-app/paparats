import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { cx } from "../internal/cx";
import { TextArea } from "../TextArea";
import styles from "./CommentThread.module.css";

export interface CommentView {
  id: string;
  author: string;
  initials: string;
  /** Preformatted date. */
  date: string;
  text: string;
  /** "Developer · <Channel>" (mint) or "Author" (neutral) badge after the name. */
  badge?: { type: "developer"; channel: string } | { type: "author" };
  /** Developer comments sit on the channel tint with light initials (per-item data colour). */
  avatarTint?: string;
}

export interface CommentComposer {
  value: string;
  onChange: (value: string) => void;
  onPost: () => void;
  initials: string;
  avatarTint?: string;
  /** "Add to the discussion…" by default. */
  placeholder?: string;
}

export interface CommentThreadProps {
  comments: readonly CommentView[];
  /** The reply box under the thread. */
  composer?: CommentComposer;
  /** "No comments yet. Start the discussion." by default. */
  emptyText?: string;
  className?: string;
}

function Avatar({ initials, tint }: { initials: string; tint?: string }) {
  return (
    <span
      className={cx(styles.avatar, tint !== undefined && styles.avatarTinted)}
      style={tint !== undefined ? ({ "--tint": tint } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/**
 * Idea discussion: rows separated by 1px `--line` (34px initials avatar, author, badge, date,
 * text) and the composer — textarea + Post, mint once there is text (prototype lines 1328–1344).
 */
export function CommentThread({ comments, composer, emptyText, className }: CommentThreadProps) {
  const { t } = useTranslation();
  const canPost = composer !== undefined && composer.value.trim() !== "";
  return (
    <div className={cx(styles.thread, className)}>
      {comments.length > 0 ? (
        <ul className={styles.list}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.comment}>
              <Avatar initials={comment.initials} tint={comment.avatarTint} />
              <div className={styles.body}>
                <div className={styles.head}>
                  <span className={styles.author}>{comment.author}</span>
                  {comment.badge?.type === "developer" && (
                    <span className={cx(styles.badge, styles.badgeDev)}>
                      {`${t("common.developer")} · ${comment.badge.channel}`}
                    </span>
                  )}
                  {comment.badge?.type === "author" && (
                    <span className={styles.badge}>{t("idea.authorBadge")}</span>
                  )}
                  <span className={styles.date}>{comment.date}</span>
                </div>
                <div className={styles.text}>{comment.text}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>{emptyText ?? t("idea.noComments")}</div>
      )}
      {composer && (
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            if (canPost) composer.onPost();
          }}
        >
          <Avatar initials={composer.initials} tint={composer.avatarTint} />
          <div className={styles.compose}>
            <TextArea
              rows={3}
              value={composer.value}
              placeholder={composer.placeholder ?? t("idea.commentPlaceholder")}
              aria-label={composer.placeholder ?? t("idea.commentPlaceholder")}
              onChange={(event) => composer.onChange(event.target.value)}
            />
            <div className={styles.postRow}>
              <Button
                type="submit"
                size="sm"
                variant={canPost ? "primary" : "secondary"}
                tone={canPost ? "default" : "muted"}
                disabled={!canPost}
                className={styles.post}
              >
                {t("idea.post")}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
