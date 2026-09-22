import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./ScreenshotViewer.module.css";

/** One block of an abstract placeholder frame, in % of the frame; `o` = opacity, `r` = radius px. */
export interface ShotRect {
  x: number;
  y: number;
  w: number;
  h: number;
  o: number;
  r: number;
}

/** A frame: its placeholder blocks, or a real image once the catalog ships screenshots. */
export type Shot = readonly ShotRect[] | { src: string };

/**
 * The prototype's four abstract frames (`Component.SHOTS`, line 1643): window chrome, lists,
 * text and a dialog. Placeholders until the catalog carries imagery.
 */
export const PLACEHOLDER_SHOTS: readonly (readonly ShotRect[])[] = [
  [
    { x: 0, y: 0, w: 100, h: 9, o: 0.14, r: 0 },
    { x: 0, y: 9, w: 22, h: 91, o: 0.07, r: 0 },
    { x: 26, y: 16, w: 44, h: 5, o: 0.22, r: 3 },
    { x: 26, y: 26, w: 70, h: 30, o: 0.1, r: 6 },
    { x: 26, y: 61, w: 33, h: 30, o: 0.1, r: 6 },
    { x: 63, y: 61, w: 33, h: 30, o: 0.1, r: 6 },
  ],
  [
    { x: 0, y: 0, w: 100, h: 9, o: 0.14, r: 0 },
    { x: 8, y: 18, w: 84, h: 9, o: 0.1, r: 4 },
    { x: 8, y: 31, w: 84, h: 9, o: 0.1, r: 4 },
    { x: 8, y: 44, w: 84, h: 9, o: 0.1, r: 4 },
    { x: 8, y: 57, w: 84, h: 9, o: 0.1, r: 4 },
    { x: 8, y: 70, w: 60, h: 9, o: 0.1, r: 4 },
    { x: 72, y: 84, w: 20, h: 9, o: 0.3, r: 4 },
  ],
  [
    { x: 0, y: 0, w: 100, h: 9, o: 0.14, r: 0 },
    { x: 6, y: 18, w: 40, h: 3, o: 0.3, r: 2 },
    { x: 6, y: 26, w: 60, h: 3, o: 0.18, r: 2 },
    { x: 6, y: 34, w: 50, h: 3, o: 0.18, r: 2 },
    { x: 6, y: 42, w: 70, h: 3, o: 0.18, r: 2 },
    { x: 6, y: 50, w: 35, h: 3, o: 0.3, r: 2 },
    { x: 6, y: 58, w: 64, h: 3, o: 0.18, r: 2 },
    { x: 6, y: 66, w: 56, h: 3, o: 0.18, r: 2 },
    { x: 6, y: 74, w: 44, h: 3, o: 0.18, r: 2 },
  ],
  [
    { x: 0, y: 0, w: 100, h: 9, o: 0.08, r: 0 },
    { x: 0, y: 9, w: 22, h: 91, o: 0.04, r: 0 },
    { x: 30, y: 24, w: 40, h: 52, o: 0.14, r: 8 },
    { x: 36, y: 32, w: 28, h: 5, o: 0.3, r: 3 },
    { x: 36, y: 42, w: 28, h: 16, o: 0.12, r: 4 },
    { x: 36, y: 63, w: 12, h: 7, o: 0.35, r: 4 },
    { x: 50, y: 63, w: 12, h: 7, o: 0.14, r: 4 },
  ],
];

export interface ScreenshotViewerProps {
  shots: readonly Shot[];
  index: number;
  onIndexChange: (index: number) => void;
  /** The app tint (data colour) behind placeholder frames. */
  tint: string;
  /** Accessible names of the arrows (translated by the caller). */
  previousLabel: string;
  nextLabel: string;
  className?: string;
}

function Frame({ shot }: { shot: Shot }) {
  if ("src" in shot)
    return <img className={styles.image} src={shot.src} alt="" draggable={false} />;
  return (
    <>
      {shot.map((rect, i) => (
        <span
          key={i}
          className={styles.rect}
          style={{
            left: `${rect.x}%`,
            top: `${rect.y}%`,
            width: `${rect.w}%`,
            height: `${rect.h}%`,
            borderRadius: rect.r,
            opacity: rect.o,
          }}
        />
      ))}
    </>
  );
}

/**
 * App page screenshots: a 400px main frame with prev/next and a "Screenshot N" label, then a
 * row of 168×100 thumbnails (prototype lines 1000–1014).
 */
export function ScreenshotViewer({
  shots,
  index,
  onIndexChange,
  tint,
  previousLabel,
  nextLabel,
  className,
}: ScreenshotViewerProps) {
  const { t } = useTranslation();
  const count = shots.length;
  const current = shots[Math.min(Math.max(index, 0), count - 1)];
  const step = (delta: number) => onIndexChange((index + delta + count) % count);
  const label = t("app.shotLabel", { index: index + 1 });
  return (
    <div className={cx(styles.viewer, className)} style={{ "--tint": tint } as CSSProperties}>
      <figure className={styles.main}>
        {current && <Frame shot={current} />}
        <figcaption className={styles.label}>{label}</figcaption>
        {count > 1 && (
          <>
            <button
              type="button"
              className={cx(styles.nav, styles.prev)}
              aria-label={previousLabel}
              onClick={() => step(-1)}
            >
              <Icon name="chevron-left" size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={cx(styles.nav, styles.next)}
              aria-label={nextLabel}
              onClick={() => step(1)}
            >
              <Icon name="chevron-right" size={16} strokeWidth={2} />
            </button>
          </>
        )}
      </figure>
      {count > 1 && (
        <div className={styles.thumbs}>
          {shots.map((shot, i) => (
            <button
              key={i}
              type="button"
              className={cx(styles.thumb, i === index && styles.thumbOn)}
              aria-label={t("app.shotLabel", { index: i + 1 })}
              aria-current={i === index ? "true" : undefined}
              onClick={() => onIndexChange(i)}
            >
              <Frame shot={shot} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
