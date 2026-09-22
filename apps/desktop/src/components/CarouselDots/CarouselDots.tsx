import { cx } from "../internal/cx";
import styles from "./CarouselDots.module.css";

export interface CarouselDotsProps {
  count: number;
  /** Active slide. */
  index: number;
  onSelect: (index: number) => void;
  /** Accessible name of the group (e.g. "Featured slides"). */
  label: string;
  /** Accessible name of one dot (e.g. i => `Slide ${i + 1} of 4`), translated by the caller. */
  dotLabel: (index: number) => string;
  /** On photographic heroes: idle dots in `--dot-idle`. */
  onImage?: boolean;
  className?: string;
}

/** Carousel position: 6px dots, the active one 18px `--mint`, width eased over `--dur-dots`. */
export function CarouselDots({
  count,
  index,
  onSelect,
  label,
  dotLabel,
  onImage = false,
  className,
}: CarouselDotsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(styles.dots, onImage && styles.onImage, className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={dotLabel(i)}
          aria-current={i === index ? "true" : undefined}
          className={cx(styles.dot, i === index && styles.active)}
          onClick={() => {
            if (i !== index) onSelect(i);
          }}
        />
      ))}
    </div>
  );
}
