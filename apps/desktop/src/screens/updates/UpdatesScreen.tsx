// Updates — pending updates with their release notes, Update all with the batch controls, and the
// side column (Paparats Prototype.dc.html lines 451–545; `renderVals` "// updates").
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/EmptyState";
import { useChannelContext } from "@/hooks";
import { useCatalog, useLibrary } from "@/queries";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { UpdatesAside } from "./UpdatesAside";
import { UpdatesBanner } from "./UpdatesBanner";
import { UpdatesRow } from "./UpdatesRow";
import { useUpdateRows } from "./updateRows";
import styles from "./UpdatesScreen.module.css";

export function UpdatesScreen() {
  const { t } = useTranslation();
  const catalog = useCatalog().data;
  const library = useLibrary().data;
  const { ready: channelsReady } = useChannelContext();
  const rows = useUpdateRows();
  useClearJustUpdatedOnLeave();

  // Wait for everything the rows depend on, so "Everything is up to date" never flashes.
  if (!catalog || !library || !channelsReady) return null;

  return (
    <div className={styles.screen}>
      <UpdatesBanner />
      <div className={styles.columns}>
        <div className={styles.main}>
          {rows.length > 0 ? (
            <ul className={styles.rows} aria-label={t("nav.updates")}>
              {rows.map((app) => (
                <li key={app.id}>
                  <UpdatesRow app={app} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              framed
              icon="check"
              title={t("common.upToDate")}
              hint={t("common.upToDateHint")}
            />
          )}
        </div>
        <UpdatesAside />
      </div>
    </div>
  );
}

/**
 * "Updated just now" lasts until the user leaves the screen (README; decision D7): the markers are
 * cleared when the screen unmounts. `useNav().go()` clears them too; this also covers any other
 * way out. The clear waits a microtask so React's StrictMode remount (dev only) does not wipe the
 * markers of a screen that is still open.
 */
function useClearJustUpdatedOnLeave() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void Promise.resolve().then(() => {
        if (!mounted.current) useDownloadsStore.getState().clearJustUpdated();
      });
    };
  }, []);
}
