import { Minus, Square, X } from "lucide-react";
import { nativeWindow } from "@/platform/window";
import styles from "./WindowControls.module.css";

/** Minimise / maximise / close — the window is frameless, so the app draws its own controls. */
export function WindowControls() {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        aria-label="Minimize"
        className={styles.cell}
        onClick={nativeWindow.minimize}
      >
        <Minus size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="Maximize"
        className={styles.cell}
        onClick={nativeWindow.toggleMaximize}
      >
        <Square size={13} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="Close"
        className={`${styles.cell} ${styles.close}`}
        onClick={nativeWindow.close}
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
