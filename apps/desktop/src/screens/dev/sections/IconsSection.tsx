import catalog from "@fixtures/catalog.json";
import iconUrl from "@/assets/images/paparats-icon.webp";
import { AppIcon, APP_ICON_SIZES } from "@/components/AppIcon";
import { Icon, ICON_NAMES } from "@/components/Icon";
import { Specimen, SpecimenGrid } from "./Gallery";
import styles from "./sections.module.css";

export function IconsSection() {
  return (
    <>
      <Specimen caption={`ICONS (${ICON_NAMES.length}) · size=20 strokeWidth=1.75`} wide>
        <div className={styles.iconGrid}>
          {ICON_NAMES.map((name) => (
            <div key={name} className={styles.iconCell} title={name}>
              <Icon name={name} />
              <span className={styles.iconName}>{name}</span>
            </div>
          ))}
        </div>
      </Specimen>
      <SpecimenGrid>
        <Specimen caption="size 14 · 16 · 18 · 20 · 26">
          {[14, 16, 18, 20, 26].map((size) => (
            <Icon key={size} name="layout-grid" size={size} />
          ))}
        </Specimen>
        <Specimen caption="strokeWidth 1.75 · 2.2 · 3">
          {[1.75, 2.2, 3].map((stroke) => (
            <Icon key={stroke} name="check" size={20} strokeWidth={stroke} />
          ))}
        </Specimen>
        <Specimen caption='name="unknown" (fallback)'>
          <Icon name="unknown" />
        </Specimen>
      </SpecimenGrid>
    </>
  );
}

const SAMPLE_APPS = catalog.apps.slice(0, APP_ICON_SIZES.length);

export function AppIconSection() {
  return (
    <SpecimenGrid>
      <Specimen caption="size 16 … 96 (monogram on tint)" wide>
        <div className={styles.baselineRow}>
          {APP_ICON_SIZES.filter((size) => size < 140).map((size, i) => {
            const app = SAMPLE_APPS[i] ?? SAMPLE_APPS[0];
            return app ? (
              <div key={size} className={styles.tileCell}>
                <AppIcon mono={app.mono} tint={app.tint} size={size} label={app.name} />
                <span className={styles.iconName}>{size}</span>
              </div>
            ) : null;
          })}
        </div>
      </Specimen>
      <Specimen caption="size=140 floating">
        {SAMPLE_APPS[10] && (
          <AppIcon mono={SAMPLE_APPS[10].mono} tint={SAMPLE_APPS[10].tint} size={140} floating />
        )}
      </Specimen>
      <Specimen caption="iconUrl · iconUrl failing → monogram">
        <AppIcon mono="Pp" tint={SAMPLE_APPS[0]?.tint ?? ""} iconUrl={iconUrl} size={56} />
        <AppIcon
          mono={SAMPLE_APPS[1]?.mono ?? ""}
          tint={SAMPLE_APPS[1]?.tint ?? ""}
          iconUrl="data:image/png;base64,broken"
          size={56}
        />
      </Specimen>
    </SpecimenGrid>
  );
}
