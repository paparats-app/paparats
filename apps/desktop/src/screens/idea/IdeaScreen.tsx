import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { EmptyState } from "@/components/EmptyState";
import { Timeline } from "@/components/Timeline";
import { useAccount, useCatalog, useChannels, useIdeas } from "@/queries";
import { BackLink } from "@/screens/shared";
import type { Idea } from "@/services/types";
import { IdeaDiscussion } from "./IdeaDiscussion";
import { IdeaHeader } from "./IdeaHeader";
import { useIdeaDetail } from "./ideaDetail";
import styles from "./IdeaScreen.module.css";

/**
 * Idea page (`/ideas/:ideaId`, prototype lines 1284–1349): the header with the vote button, the
 * idea and its status card, the Proposed · In work · Released timeline and the discussion. In the
 * developer view the status card takes the idea or opens the release dialog.
 */
export function IdeaScreen() {
  const { ideaId = "" } = useParams();
  const ideas = useIdeas().data;
  const catalog = useCatalog().data;
  const channels = useChannels().data;
  const account = useAccount().data;
  // The navigation skeleton covers the first frames while the data loads (no half-drawn names).
  if (!ideas || !catalog || !channels || !account) return null;
  const idea = ideas.find((i) => i.id === ideaId);
  // Keyed by id: another idea starts with an empty comment box (the prototype's `commentText: ''`).
  return idea ? <IdeaPage key={idea.id} idea={idea} /> : <IdeaNotFound />;
}

function IdeaNotFound() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <BackLink label={t("nav.ideas")} />
      <EmptyState icon="lightbulb" title={t("idea.notFound")} hint={t("idea.notFoundHint")} />
    </div>
  );
}

function IdeaPage({ idea }: { idea: Idea }) {
  const { t } = useTranslation();
  const detail = useIdeaDetail(idea);
  return (
    <div className={styles.page}>
      <BackLink label={t("nav.ideas")} />
      <IdeaHeader idea={idea} detail={detail} />
      <Timeline
        className={styles.timeline}
        steps={detail.timeline}
        reached={detail.reached}
        label={t("idea.progress")}
      />
      <IdeaDiscussion idea={idea} detail={detail} />
    </div>
  );
}
