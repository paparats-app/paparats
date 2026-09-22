import { DEV_SECTIONS, GallerySection } from "./sections";
import styles from "./DevScreen.module.css";

export type GalleryTheme = "dark" | "light";

const THEMES: readonly GalleryTheme[] = ["dark", "light"];

/**
 * Component gallery (`/dev`): every primitive in all variants and states, rendered twice side
 * by side under `data-theme="dark"` and `data-theme="light"`. Each panel keeps its own demo state.
 */
export function DevScreen() {
  return (
    <div className={styles.panels}>
      {THEMES.map((theme) => (
        <ThemePanel key={theme} theme={theme} />
      ))}
    </div>
  );
}

function ThemePanel({ theme }: { theme: GalleryTheme }) {
  return (
    <section className={styles.panel} data-theme={theme} aria-label={`data-theme="${theme}"`}>
      <div className={styles.panelHead}>{`data-theme="${theme}"`}</div>
      {DEV_SECTIONS.map(({ id, title, Component }) => (
        <GallerySection key={id} sectionId={id} title={title}>
          <Component />
        </GallerySection>
      ))}
    </section>
  );
}
