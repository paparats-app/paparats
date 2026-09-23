// The board's left column: tabs with counts, status chips, sort, the "For <App>" filter chip and
// the idea cards or the empty state (Paparats Prototype.dc.html lines 1208–1247).
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { IDEA_STATUS_KEY, IdeaCard } from "@/components/IdeaCard";
import { Select } from "@/components/Select";
import { Tabs } from "@/components/Tabs";
import { IDEA_STATUSES, type IdeaSort, type IdeaTab } from "@/domain/ideas";
import { useFormat } from "@/i18n/format";
import { useIdeaActions } from "@/queries";
import { useIdeaView, useTakeIdea } from "@/screens/shared";
import type { Idea, IdeaStatus } from "@/services/types";
import { useIdeasStore } from "@/stores/useIdeasStore";
import type { IdeasBoard } from "./useIdeasBoard";
import { cx } from "./cx";
import styles from "./IdeasBoardList.module.css";

const TAB_KEY = {
  all: "ideas.tabAllIdeas",
  new: "ideas.tabNewApps",
  app: "ideas.tabExistingApps",
  mine: "ideas.tabMyIdeas",
  myapps: "ideas.tabForMyApps",
  mywork: "ideas.tabMyWork",
} as const satisfies Record<IdeaTab, string>;

/** Status chip dots: open `--text3`, in work `--warn`, released `--mint` (prototype `ideaChips`). */
const DOT_CLASS: Record<IdeaStatus, string | undefined> = {
  open: styles.dotOpen,
  work: styles.dotWork,
  released: styles.dotReleased,
};

export function IdeasBoardList({ board }: { board: IdeasBoard }) {
  const { t } = useTranslation();
  const format = useFormat();
  const panelId = useId();
  const statuses = useIdeasStore((s) => s.statuses);
  const sort = useIdeasStore((s) => s.sort);
  const setTab = useIdeasStore((s) => s.setTab);
  const toggleStatus = useIdeasStore((s) => s.toggleStatus);
  const setSort = useIdeasStore((s) => s.setSort);
  const setAppFilter = useIdeasStore((s) => s.setAppFilter);
  const view = useIdeaView();
  const actions = useCardActions();

  const tabs = board.tabs.map(({ value, count }) => ({
    value,
    label: t(TAB_KEY[value]),
    count: format.number(count),
  }));
  const sorts: ReadonlyArray<{ value: IdeaSort; label: string }> = [
    { value: "top", label: t("ideas.sortTop") },
    { value: "new", label: t("ideas.sortNew") },
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Tabs
          items={tabs}
          value={board.tab}
          onChange={setTab}
          label={t("nav.ideas")}
          panelId={() => panelId}
          className={styles.tabs}
        />
        <div className={styles.toolbarEnd}>
          <div role="group" aria-label={t("ideas.statusFilter")} className={styles.chips}>
            {IDEA_STATUSES.map((status) => {
              const on = statuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  className={cx(styles.chip, on && styles.chipOn)}
                  aria-pressed={on}
                  onClick={() => toggleStatus(status)}
                >
                  <span className={cx(styles.dot, DOT_CLASS[status])} aria-hidden="true" />
                  {t(IDEA_STATUS_KEY[status])}
                </button>
              );
            })}
          </div>
          <Select
            aria-label={t("common.sortBy")}
            value={sort}
            onChange={setSort}
            options={sorts}
            ground="card"
            wrapperClassName={styles.sort}
          />
        </div>
      </div>

      {board.appFilter && (
        <div className={styles.filterRow}>
          <span>{t("ideas.filtersLabel")}</span>
          <button
            type="button"
            className={styles.appChip}
            aria-description={t("ideas.removeFilter")}
            onClick={() => setAppFilter(null)}
          >
            {t("ideas.ideaForApp", { app: board.appFilter.name })}
            <Icon name="x" size={12} strokeWidth={2.4} />
          </button>
        </div>
      )}

      <div
        id={panelId}
        role="tabpanel"
        aria-label={tabs.find((tab) => tab.value === board.tab)?.label}
      >
        {board.list.length > 0 ? (
          <ul className={styles.list}>
            {board.list.map((idea) => (
              <li key={idea.id} className={styles.item}>
                <IdeaCard
                  title={view.title(idea)}
                  excerpt={view.excerpt(idea)}
                  votes={idea.votes}
                  voted={idea.voted}
                  onVote={() => void actions.vote(idea)}
                  kind={view.kind(idea)}
                  status={idea.status}
                  developer={view.developer(idea)}
                  author={view.author(idea)}
                  date={format.relative(idea.date)}
                  comments={idea.comments.length}
                  onOpen={() => actions.open(idea)}
                  onTake={board.canTake(idea) ? () => void actions.take(idea) : undefined}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            framed
            size="md"
            title={t("ideas.noIdeas")}
            hint={t("ideas.noIdeasHint")}
            className={styles.empty}
          />
        )}
      </div>
    </>
  );
}

/** Vote / unvote, open the idea, and Take in the developer view (the channel it acts as). */
function useCardActions() {
  const { go } = useNav();
  const { vote } = useIdeaActions();
  const takeIdea = useTakeIdea();
  return {
    async vote(idea: Idea) {
      try {
        await vote(idea.id);
      } catch {
        // The count stays as it was (no failure copy in the handoff).
      }
    },
    // Someone else took it first, or it failed: the card shows the idea as it is.
    take: (idea: Idea) => takeIdea(idea),
    open(idea: Idea) {
      go({ to: "idea", ideaId: idea.id });
    },
  };
}
