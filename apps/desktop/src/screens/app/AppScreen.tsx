import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { EmptyState } from "@/components/EmptyState";
import { PLACEHOLDER_SHOTS, ScreenshotViewer } from "@/components/ScreenshotViewer";
import { useAppIndex } from "@/hooks";
import { useCatalog } from "@/queries";
import { BackLink } from "@/screens/shared";
import type { App, Catalog } from "@/services/types";
import { AppAbout } from "./AppAbout";
import { AppDetails } from "./AppDetails";
import { AppHeader } from "./AppHeader";
import { AppReviews } from "./AppReviews";
import { MoreInCollection } from "./MoreInCollection";
import { VersionHistory } from "./VersionHistory";
import styles from "./AppScreen.module.css";

/**
 * App detail page (`/app/:appId`, prototype lines 967–1118): header with the primary action,
 * screenshots, about + details, ratings and reviews, version history and "More in “…”".
 * Back returns to the section the page was opened from.
 */
export function AppScreen() {
  const { appId = "" } = useParams();
  const catalog = useCatalog().data;
  const app = useAppIndex().get(appId);
  // The navigation skeleton covers the first frames while the catalog loads.
  if (!catalog) return null;
  // Keyed by id: opening another app from "More in" starts on its first screenshot, no rating
  // and two versions (the prototype resets these on every navigation).
  return app ? <AppPage key={app.id} app={app} catalog={catalog} /> : <AppNotFound />;
}

function AppNotFound() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <BackLink label={t("common.back")} />
      <EmptyState icon="package" title={t("app.notFound")} hint={t("app.notFoundHint")} />
    </div>
  );
}

function AppPage({ app, catalog }: { app: App; catalog: Catalog }) {
  const { t } = useTranslation();
  const [shot, setShot] = useState(0);
  return (
    <div className={styles.page}>
      <BackLink label={t("common.back")} />
      <AppHeader app={app} />

      <h2 className={`${styles.heading} ${styles.shotsHeading}`}>{t("app.screenshots")}</h2>
      <ScreenshotViewer
        shots={PLACEHOLDER_SHOTS}
        index={shot}
        onIndexChange={setShot}
        tint={app.tint}
        previousLabel={t("common.previous")}
        nextLabel={t("common.next")}
      />

      <div className={styles.columns}>
        <AppAbout app={app} />
        <AppDetails app={app} />
      </div>

      <AppReviews app={app} reviewPool={catalog.reviewPool} />
      <VersionHistory app={app} catalog={catalog} />
      <MoreInCollection app={app} collections={catalog.collections} />
    </div>
  );
}
