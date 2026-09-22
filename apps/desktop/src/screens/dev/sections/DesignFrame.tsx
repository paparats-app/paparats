import type { ReactNode } from "react";
import styles from "./composites.module.css";

/**
 * Renders a composite at the width it has in the real screen (e.g. 1136 = the content column at
 * 1440×920); the theme panel scrolls it horizontally when narrower. The scroller clips, so
 * `room` reserves space below for popovers (the library row's ⋯ menu).
 */
export function DesignFrame({
  width,
  room = 0,
  children,
}: {
  width: number;
  room?: number;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame} style={room > 0 ? { paddingBottom: room } : undefined}>
      <div className={styles.frameInner} style={{ width }}>
        {children}
      </div>
    </div>
  );
}
