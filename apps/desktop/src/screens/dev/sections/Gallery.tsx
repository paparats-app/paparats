import { useId, type ReactNode } from "react";
import styles from "./Gallery.module.css";

// Layout helpers for the dev gallery. Captions are prop / variant identifiers (monospace),
// not translated UI copy; sample content inside the specimens goes through t().

export function GallerySection({
  sectionId,
  title,
  children,
}: {
  sectionId: string;
  title: string;
  children: ReactNode;
}) {
  // Each section renders once per theme panel, so heading ids must be unique per instance.
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId} data-section={sectionId}>
      <h2 id={headingId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

/** One labelled example. `caption` is an identifier such as `variant="primary"`. */
export function Specimen({
  caption,
  children,
  wide = false,
}: {
  caption: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? `${styles.specimen} ${styles.wide}` : styles.specimen}>
      <div className={styles.caption}>{caption}</div>
      <div className={styles.row}>{children}</div>
    </div>
  );
}

/** Wrapping row of specimens. */
export function SpecimenGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

/** Dark photographic-banner ground for the on-image variants. */
export function OnImage({ children }: { children: ReactNode }) {
  return <div className={styles.onImage}>{children}</div>;
}

/** Vertical stack with the design's 10px aside gap. */
export function Stack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}
