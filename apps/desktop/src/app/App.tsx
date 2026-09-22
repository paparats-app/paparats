import { WindowControls } from "./WindowControls";
import styles from "./App.module.css";

/** M0 placeholder shell: drag strip + window controls. Replaced by the real shell in M1. */
export function App() {
  return (
    <div className={styles.frame}>
      <div className={styles.drag} data-tauri-drag-region />
      <WindowControls />
      <main className={styles.main}>
        <h1>Paparats</h1>
      </main>
    </div>
  );
}
