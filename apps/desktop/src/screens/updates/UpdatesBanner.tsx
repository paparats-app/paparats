import { useLayoutEffect, useMemo, useRef, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { PageBanner } from "@/components/PageBanner";
import { ProgressBar } from "@/components/ProgressBar";
import { updateSizeMb } from "@/domain/apps";
import { useOffline, useUpdates } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useCatalog } from "@/queries";
import { allPaused, batchProgress, useDownloadsStore } from "@/stores/useDownloadsStore";
import styles from "./UpdatesScreen.module.css";

/**
 * The Updates page banner (prototype lines 452–479): the count line with the total download size,
 * "Update all" — or, while a batch runs, "Updating 2 of 5" with its 6px bar, Pause all / Resume
 * all and Cancel all. A keyboard press on Update all / Cancel all hands the focus to the buttons
 * that replace it (Pause all / Update all).
 */
export function UpdatesBanner() {
  const { t } = useTranslation();
  const format = useFormat();
  const offline = useOffline();
  const { apps, count, totalMb } = useUpdates();
  const manifests = useCatalog().data?.updates;
  const batch = useDownloadsStore((s) => s.batch);
  const items = useDownloadsStore((s) => s.items);
  const progress = useMemo(() => batchProgress(batch, items), [batch, items]);
  const paused = useMemo(() => allPaused(items), [items]);
  const batchActive = progress?.active === true;
  const showUpdateAll = count > 0 && !batchActive && !offline;
  const updateAllRef = useRef<HTMLButtonElement>(null);
  const pauseAllRef = useRef<HTMLButtonElement>(null);
  const handoff = useRef(false);
  // Enter / Space fire the click with `detail` 0: only keyboard users get the focus moved.
  const noteHandoff = (event: MouseEvent<HTMLButtonElement>) => {
    handoff.current = event.detail === 0;
  };
  useLayoutEffect(() => {
    if (!handoff.current) return;
    handoff.current = false;
    (batchActive ? pauseAllRef.current : updateAllRef.current)?.focus();
  }, [batchActive]);

  let line: string;
  if (offline) line = t("common.offlineUpdates");
  else if (count > 0) line = t("updates.updatesAvailable", { count });
  else line = t("common.upToDate");

  const updateAll = (event: MouseEvent<HTMLButtonElement>) => {
    noteHandoff(event);
    void useDownloadsStore.getState().startBatch(
      apps.map((app) => ({
        appId: app.id,
        version: app.version,
        kind: "update" as const,
        sizeMb: updateSizeMb(app, manifests ?? [], true),
      })),
    );
  };

  const togglePauseAll = () => {
    const downloads = useDownloadsStore.getState();
    void (paused ? downloads.resumeAll() : downloads.pauseAll());
  };

  const batchLabel = progress
    ? t("common.updatingProgress", { current: progress.done, total: progress.total })
    : "";

  return (
    <PageBanner
      title={t("nav.updates")}
      subtitle={t("updates.updatesSub")}
      motto={t("common.mottoB")}
      size="lg"
      actionsLayout="column"
      actions={
        <>
          {showUpdateAll && (
            <Button
              ref={updateAllRef}
              variant="primaryOnImage"
              size="xl"
              leadingIcon={<Icon name="download" size={18} strokeWidth={2.2} />}
              onClick={updateAll}
            >
              {t("updates.updateAll")}
            </Button>
          )}
          {batchActive && (
            <div className={styles.batchActions}>
              <Button
                ref={pauseAllRef}
                variant="onImage"
                size="xl"
                className={styles.pauseAll}
                onClick={togglePauseAll}
              >
                {paused ? t("common.resumeAll") : t("common.pauseAll")}
              </Button>
              <Button
                variant="onImage"
                size="xl"
                className={styles.cancelAll}
                onClick={(event) => {
                  noteHandoff(event);
                  void useDownloadsStore.getState().cancelAll();
                }}
              >
                {t("updates.cancelAll")}
              </Button>
            </div>
          )}
        </>
      }
    >
      <div className={styles.countLine}>
        <span className={styles.count}>{line}</span>
        <span className={styles.totalSize}>
          {count > 0 && !offline ? format.size(totalMb) : ""}
        </span>
      </div>
      {batchActive && progress && (
        <div className={styles.batch}>
          <div className={styles.batchMeta}>
            <span>{batchLabel}</span>
            <span>{format.percent(progress.percent)}</span>
          </div>
          <ProgressBar value={progress.percent} height={6} onImage label={batchLabel} />
        </div>
      )}
    </PageBanner>
  );
}
