import { useTranslation } from "react-i18next";
import { CATEGORY_PHOTOS, CategoryCard, CategoryChip } from "@/components/CategoryCard";
import { CollectionCard } from "@/components/CollectionCard";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { CATALOG, LIBRARY, noop, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

/** Category photo tiles, compact category chips and both collection card variants. */
export function CategoriesSection() {
  const { t } = useTranslation();
  const { text } = useSample();
  const count = (n: number) => t("common.appsCount", { count: n });
  return (
    <>
      <Specimen caption="CategoryCard (Categories, 3-col) · hover border --line2" wide>
        <DesignFrame width={WIDTH.content}>
          <div className={`${styles.grid} ${styles.cols3}`}>
            {CATALOG.categories.slice(0, 6).map((c) => (
              <CategoryCard
                key={c.id}
                label={t(`categories.items.${c.id}.label`)}
                description={t(`categories.items.${c.id}.desc`)}
                countLabel={count(c.catalogCount)}
                icon={c.icon}
                photo={CATEGORY_PHOTOS[c.id]}
                onClick={noop}
              />
            ))}
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen caption="CategoryChip (Browse › Top categories, 6-col)" wide>
        <DesignFrame width={WIDTH.browse}>
          <div className={`${styles.grid} ${styles.cols6}`}>
            {CATALOG.categories.slice(0, 6).map((c) => (
              <CategoryChip
                key={c.id}
                label={t(`categories.items.${c.id}.label`)}
                countLabel={count(c.catalogCount)}
                icon={c.icon}
                onClick={noop}
              />
            ))}
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen caption='CollectionCard variant="store" (Home, 4-col) · "library" (2-col)' wide>
        <DesignFrame width={WIDTH.content}>
          <div className={styles.stack}>
            <div className={`${styles.grid} ${styles.cols4}`}>
              {CATALOG.collections.map((c) => (
                <CollectionCard
                  key={c.id}
                  icon={c.icon}
                  title={text(c.title)}
                  subtitle={text(c.sub)}
                  onClick={noop}
                />
              ))}
            </div>
            <div className={`${styles.grid} ${styles.cols2}`} style={{ width: WIDTH.library }}>
              {LIBRARY.collections.map((c) => (
                <CollectionCard
                  key={c.id}
                  variant="library"
                  icon={c.icon}
                  title={text(c.label)}
                  subtitle={count(c.apps?.length ?? LIBRARY.installed.length)}
                  onClick={noop}
                />
              ))}
            </div>
          </div>
        </DesignFrame>
      </Specimen>
    </>
  );
}
