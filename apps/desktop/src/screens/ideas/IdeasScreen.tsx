// Ideas board — banner with Suggest an idea (and the developer-view pill), the released-idea
// note, tabs / status chips / sort, the app filter chip, idea cards and the right column
// (Paparats Prototype.dc.html lines 1184–1283, `renderVals` "// ideas" 2040–2079, 2201–2206).
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { AppIcon } from "@/components/AppIcon";
import { Button, IconButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { PageBanner } from "@/components/PageBanner";
import { useDialogStore } from "@/stores/useDialogStore";
import { useIdeaActions } from "@/queries";
import { useIdeaView } from "@/screens/shared";
import type { Idea } from "@/services/types";
import { IdeasAside } from "./IdeasAside";
import { IdeasBoardList } from "./IdeasBoardList";
import { useActivateBonus } from "./useActivateBonus";
import { useIdeasBoard, type IdeasBoard } from "./useIdeasBoard";
import styles from "./IdeasScreen.module.css";

export function IdeasScreen() {
  const { t } = useTranslation();
  const board = useIdeasBoard();
  const openDialog = useDialogStore((s) => s.open);
  // Rendered once the data is in (the navigation skeleton covers the wait), so no empty state
  // or zero count flashes.
  if (!board.ready) return null;
  const note = board.notes[0];

  return (
    <div className={styles.screen}>
      <PageBanner
        title={t("nav.ideas")}
        subtitle={t("ideas.ideasSub")}
        actions={
          <div className={styles.bannerActions}>
            {board.view === "developer" && <DeveloperPill board={board} />}
            <Button
              variant="primaryOnImage"
              size="xl"
              leadingIcon={<Icon name="lightbulb" size={18} strokeWidth={2.2} />}
              onClick={() => openDialog({ kind: "suggestIdea" })}
            >
              {t("ideas.suggestIdea")}
            </Button>
          </div>
        }
      />
      {note && <ReleaseNote note={note} notes={board.notes} />}
      <div className={styles.layout}>
        <div className={styles.main}>
          <IdeasBoardList board={board} />
        </div>
        <IdeasAside board={board} />
      </div>
    </div>
  );
}

/** "Developer view · Nilesoft" with the channel's 22px tile (prototype line 1190). */
function DeveloperPill({ board }: { board: IdeasBoard }) {
  const { t } = useTranslation();
  const channel = board.developer.channel;
  return (
    <div className={styles.devPill}>
      {channel && <AppIcon mono={channel.mono} tint={channel.tint} size={22} />}
      {t("ideas.devView", { channel: channel?.name ?? "" })}
    </div>
  );
}

/**
 * "Your idea became an app" (prototype lines 1195–1205): the app, Open <App>, Activate 3 months
 * of Pro (dismisses every note on screen, like the prototype) and ×.
 */
function ReleaseNote({ note, notes }: { note: Idea; notes: readonly Idea[] }) {
  const { t } = useTranslation();
  const { go } = useNav();
  const view = useIdeaView();
  const activate = useActivateBonus();
  const { dismissReleaseNote } = useIdeaActions();
  const titleId = useId();
  const app = view.releasedApp(note);
  const appName = app?.name ?? "";

  const dismiss = async () => {
    try {
      await dismissReleaseNote(note.id);
    } catch {
      // The note stays (no failure copy in the handoff).
    }
  };

  return (
    <Card
      as="section"
      padding="md"
      radius={12}
      tone="mint"
      className={styles.note}
      aria-labelledby={titleId}
    >
      <AppIcon
        mono={app?.mono ?? ""}
        tint={app?.tint ?? "var(--mint)"}
        iconUrl={app?.iconUrl}
        size={44}
        className={styles.noteTile}
      />
      <div className={styles.noteText}>
        <h2 id={titleId} className={styles.noteTitle}>
          {t("ideas.ideaReleasedTitle")}
        </h2>
        <p className={styles.noteBody}>
          {t("ideas.ideaReleasedBody", {
            title: view.title(note),
            app: appName,
            channel: view.developerName(note),
          })}
        </p>
      </div>
      <div className={styles.noteActions}>
        {app && (
          <Button className={styles.noteOpen} onClick={() => go({ to: "app", appId: app.id })}>
            {t("ideas.openAppBtn", { app: appName })}
          </Button>
        )}
        <Button
          variant="primary"
          className={styles.noteActivate}
          leadingIcon={<Icon name="crown" size={14} strokeWidth={2.2} />}
          onClick={() => void activate(notes)}
        >
          {t("ideas.activateBonus")}
        </Button>
        <IconButton
          icon="x"
          label={t("ideas.dismissNote")}
          iconSize={16}
          iconStrokeWidth={2}
          className={styles.noteDismiss}
          onClick={() => void dismiss()}
        />
      </div>
    </Card>
  );
}
