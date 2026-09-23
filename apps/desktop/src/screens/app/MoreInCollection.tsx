import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { SectionHeader } from "@/components/SectionHeader";
import { pickByIds } from "@/domain/apps";
import { pickText } from "@/domain/text";
import { useLocale, useVisibleApps } from "@/hooks";
import { StoreAppCard } from "@/screens/shared";
import type { App, Collection } from "@/services/types";
import styles from "./MoreInCollection.module.css";

/** Cards in the row (the prototype's six-column grid). */
const MAX_APPS = 6;

/**
 * "More in “<collection>”": up to six other visible apps of the first collection that lists this
 * app, and See all → Browse showing that collection (prototype lines 1098–1117).
 */
export function MoreInCollection({
  app,
  collections,
}: {
  app: App;
  collections: readonly Collection[];
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { go } = useNav();
  const visible = useVisibleApps();
  const collection = collections.find((c) => c.apps.includes(app.id));
  if (!collection) return null;
  const apps = pickByIds(
    visible,
    collection.apps.filter((id) => id !== app.id),
  ).slice(0, MAX_APPS);
  if (apps.length === 0) return null;

  const title = `${t("app.moreIn")} ${t("common.q1")}${pickText(collection.title, locale)}${t("common.q2")}`;
  return (
    <>
      <SectionHeader
        title={title}
        actionLabel={t("common.seeAll")}
        onAction={() => go({ to: "browse", filters: { collection: collection.id } })}
        className={styles.header}
      />
      <div className={styles.grid}>
        {apps.map((other) => (
          <StoreAppCard key={other.id} app={other} />
        ))}
      </div>
    </>
  );
}
