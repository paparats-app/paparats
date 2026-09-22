import { cx } from "../internal/cx";
import styles from "./Timeline.module.css";

export interface TimelineStep {
  /** "Proposed" / "In work" / "Released". */
  label: string;
  /** "Alena K. · 4 September 2026" or "Not yet". */
  detail: string;
}

export interface TimelineProps {
  steps: readonly TimelineStep[];
  /** Index of the latest reached step (0 = proposed). Steps up to it are filled mint. */
  reached: number;
  /** Accessible name of the list (e.g. the idea status). */
  label?: string;
  className?: string;
}

/**
 * Idea progress: equal columns with 14px dots (mint when reached, `--card2` + `--line2` border
 * otherwise), 2px connectors, 13.5px/600 labels and 12.5px `--text3` details (lines 1317–1325).
 */
export function Timeline({ steps, reached, label, className }: TimelineProps) {
  return (
    <ol
      className={cx(styles.timeline, className)}
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const done = index <= reached;
        return (
          <li
            key={`${index}:${step.label}`}
            className={cx(styles.step, done && styles.done)}
            aria-current={index === reached ? "step" : undefined}
          >
            <div className={styles.track} aria-hidden="true">
              <span className={styles.dot} />
              {index < steps.length - 1 && (
                <span className={cx(styles.connector, index < reached && styles.connectorDone)} />
              )}
            </div>
            <div className={styles.label}>{step.label}</div>
            <div className={styles.detail}>{step.detail}</div>
          </li>
        );
      })}
    </ol>
  );
}
