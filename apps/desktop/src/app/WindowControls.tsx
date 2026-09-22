import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/Icon";
import { nativeWindow } from "@/platform/window";
import styles from "./WindowControls.module.css";

/**
 * Minimise / maximise (restore) / close — the window is frameless, so the app draws its own
 * controls (prototype lines 95–99): three 46×32 cells in the top-right corner.
 */
export function WindowControls() {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      void nativeWindow.isMaximized().then((value) => {
        if (alive) setMaximized(value);
      });
    };
    sync();
    const unsubscribe = nativeWindow.onResized(sync);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.cell}
        aria-label={t("shell.minimize")}
        onClick={nativeWindow.minimize}
      >
        <Icon name="minus" size={10} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className={styles.cell}
        aria-label={maximized ? t("shell.restore") : t("shell.maximize")}
        onClick={nativeWindow.toggleMaximize}
      >
        <Icon name={maximized ? "copy" : "square"} size={10} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className={`${styles.cell} ${styles.close}`}
        aria-label={t("shell.close")}
        onClick={nativeWindow.close}
      >
        <Icon name="x" size={10} strokeWidth={2.2} />
      </button>
    </div>
  );
}
