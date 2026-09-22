import accountJson from "@fixtures/account.json";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CommentThread, type CommentView } from "@/components/CommentThread";
import { IdeaCard, type IdeaKindView } from "@/components/IdeaCard";
import { Timeline } from "@/components/Timeline";
import { VoteButton } from "@/components/VoteButton";
import { excerpt } from "@/domain/ideas";
import { initials } from "@/domain/text";
import type { Idea } from "@/services/types";
import { Specimen, SpecimenGrid } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { app, channel, iconOf, IDEAS, noop, TODAY, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

function useIdeaView() {
  const { t } = useTranslation();
  const { text, format } = useSample();
  const kind = (idea: Idea): IdeaKindView =>
    idea.kind === "app" && idea.appId
      ? { type: "app", appName: app(idea.appId).name, icon: iconOf(app(idea.appId)) }
      : {
          type: "new",
          categoryLabel: idea.category ? t(`categories.items.${idea.category}.label`) : "",
        };
  const developer = (idea: Idea) => {
    if (idea.status === "open") return undefined;
    const dev = idea.dev ? channel(idea.dev) : undefined;
    const devName = dev?.name ?? idea.devName ?? "";
    const tint = dev?.tint ?? (idea.appId ? app(idea.appId).tint : "");
    if (idea.status === "work") return { tint, label: t("ideas.onIt", { channel: devName }) };
    const released = idea.releasedAppId ?? idea.appId;
    return {
      tint,
      label: t("ideas.releasedAs", {
        app: released ? app(released).name : devName,
        version: idea.releasedVersion ?? "",
      }),
    };
  };
  const author = (idea: Idea) => (idea.mine ? t("ideas.you") : (idea.author ?? ""));
  return { kind, developer, author, text, format };
}

/** VoteButton sizes and states (click to toggle). */
export function VoteButtonsSection() {
  const [voted, setVoted] = useState(false);
  const votes = 214 + (voted ? 1 : 0);
  return (
    <SpecimenGrid>
      <Specimen caption='size="card" · idle ⇄ voted (click)'>
        <VoteButton votes={votes} voted={voted} onVote={() => setVoted((v) => !v)} />
        <VoteButton votes={96} voted onVote={noop} />
      </Specimen>
      <Specimen caption='size="detail"'>
        <VoteButton size="detail" votes={votes} voted={voted} onVote={() => setVoted((v) => !v)} />
        <VoteButton size="detail" votes={1204} voted onVote={noop} />
      </Specimen>
    </SpecimenGrid>
  );
}

/** Idea cards across kinds and statuses; the developer view adds Take on open ideas. */
export function IdeaCardsSection() {
  const { kind, developer, author, text, format } = useIdeaView();
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const sample = ["clip", "iconpacks", "battery", "ctxmenu"]
    .map((id) => IDEAS.find((i) => i.id === id))
    .filter((i): i is Idea => i !== undefined);
  return (
    <Specimen
      caption="IdeaCard · new / app kind · open / work / released · onTake (developer view)"
      wide
    >
      <DesignFrame width={WIDTH.ideas}>
        <div className={styles.stack}>
          {sample.map((idea) => {
            const voted = votes[idea.id] ?? idea.voted;
            return (
              <IdeaCard
                key={idea.id}
                title={text(idea.title)}
                excerpt={excerpt(text(idea.body))}
                votes={idea.votes + (voted && !idea.voted ? 1 : 0) - (!voted && idea.voted ? 1 : 0)}
                voted={voted}
                onVote={() => setVotes((v) => ({ ...v, [idea.id]: !voted }))}
                kind={kind(idea)}
                status={idea.status}
                developer={developer(idea)}
                author={author(idea)}
                date={format.relative(idea.date)}
                comments={idea.comments.length}
                onOpen={noop}
                onTake={idea.id === "iconpacks" ? noop : undefined}
              />
            );
          })}
        </div>
      </DesignFrame>
    </Specimen>
  );
}

/** Timeline at each status. */
export function TimelineSection() {
  const { t } = useTranslation();
  const { format } = useSample();
  const pending = t("ideas.tlPending");
  const steps = (reached: number) => [
    { label: t("ideas.tlProposed"), detail: `Alena K. · ${format.date("2026-09-04")}` },
    {
      label: t("ideas.tlWork"),
      detail: reached >= 1 ? `Nilesoft · ${format.date("2026-09-08")}` : pending,
    },
    {
      label: t("ideas.tlReleased"),
      detail: reached >= 2 ? `Shell 1.9.15 · ${format.date("2026-09-12")}` : pending,
    },
  ];
  return (
    <Specimen caption="Timeline reached=0 | 1 | 2" wide>
      <DesignFrame width={WIDTH.ideas}>
        <div className={styles.stack}>
          {[0, 1, 2].map((reached) => (
            <Timeline key={reached} steps={steps(reached)} reached={reached} />
          ))}
        </div>
      </DesignFrame>
    </Specimen>
  );
}

/** CommentThread with Developer / Author badges and a working composer (Post appends). */
export function CommentThreadSection() {
  const { text, format } = useSample();
  const me = accountJson.profile.name;
  // A plain and a developer reply from the fixtures (none of them is by an idea's author); what
  // you post here carries the Author badge, as if you had proposed the idea.
  const all = IDEAS.flatMap((idea) => idea.comments.map((comment) => ({ idea, comment })));
  const picks = [
    all.find(({ comment }) => comment.dev === null && !comment.mine),
    all.find(({ comment }) => comment.dev !== null),
  ].filter((pick) => pick !== undefined);
  const initial: CommentView[] = picks.map(({ idea, comment: c }, index) => {
    const dev = c.dev ? channel(c.dev) : undefined;
    const name = c.mine ? me : (c.author ?? dev?.name ?? "");
    return {
      id: String(index),
      author: name,
      initials: dev ? dev.mono : initials(name),
      date: format.date(c.date),
      text: text(c.text),
      badge: dev
        ? { type: "developer", channel: dev.name }
        : c.author === idea.author
          ? { type: "author" }
          : undefined,
      avatarTint: dev?.tint,
    };
  });
  const [comments, setComments] = useState<CommentView[]>(initial);
  const [draft, setDraft] = useState("");
  return (
    <Specimen
      caption="CommentThread · Developer badge · composer (type → Post turns mint; posts get the Author badge) · empty"
      wide
    >
      <DesignFrame width={760}>
        <CommentThread
          comments={comments}
          composer={{
            value: draft,
            onChange: setDraft,
            initials: initials(me),
            onPost: () => {
              setComments((list) => [
                ...list,
                {
                  id: String(list.length),
                  author: me,
                  initials: initials(me),
                  date: format.date(TODAY),
                  text: draft.trim(),
                  badge: { type: "author" },
                },
              ]);
              setDraft("");
            },
          }}
        />
        <CommentThread comments={[]} />
      </DesignFrame>
    </Specimen>
  );
}
