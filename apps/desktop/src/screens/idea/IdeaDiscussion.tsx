import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommentThread } from "@/components/CommentThread";
import { DEVELOPER_CHANNEL_ID, useViewAs } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useIdeaActions } from "@/queries";
import type { Idea, IdeaActor } from "@/services/types";
import type { IdeaDetailView } from "./ideaDetail";
import styles from "./IdeaDiscussion.module.css";

export interface IdeaDiscussionProps {
  idea: Idea;
  detail: IdeaDetailView;
}

/**
 * "Discussion N" (lines 1326–1346): the comments and the composer. The user posts as themselves;
 * the developer view posts as the channel (its author's name and the Developer badge).
 */
export function IdeaDiscussion({ idea, detail }: IdeaDiscussionProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const view = useViewAs();
  const { comment } = useIdeaActions();
  const headingId = useId();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const post = async () => {
    const trimmed = text.trim();
    if (trimmed === "" || posting) return;
    const actor: IdeaActor =
      view === "developer"
        ? { kind: "developer", channelId: DEVELOPER_CHANNEL_ID }
        : { kind: "user" };
    setPosting(true);
    try {
      await comment(idea.id, trimmed, actor);
      setText("");
    } catch {
      // Not posted (no failure copy in the handoff): keep the text so it can be sent again.
    } finally {
      setPosting(false);
    }
  };

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {t("idea.discussion")}{" "}
        <span className={styles.count}>{format.number(idea.comments.length)}</span>
      </h2>
      <CommentThread
        comments={detail.comments}
        composer={{
          value: text,
          onChange: setText,
          onPost: () => void post(),
          posting,
          initials: detail.composer.initials,
          avatarTint: detail.composer.tint,
        }}
      />
    </section>
  );
}
