import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router";
import { EmptyState } from "@/components/EmptyState";
import { PLACEHOLDER_SHOTS, ScreenshotViewer } from "@/components/ScreenshotViewer";
import { useAppIndex, useFeatures } from "@/hooks";
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
 * Back returns to the section the page was opened from. An app from the real catalog has no
 * screenshots yet (the demo's are placeholders), and reviews show only when the catalog turns
 * them on (D68).
 */
export function AppScreen() {
  const { appId = "" } = useParams();
  const { key: visit } = useLocation();
  const catalog = useCatalog().data;
  const app = useAppIndex().get(appId);
  // The navigation skeleton covers the first frames while the catalog loads.
  if (!catalog) return null;
  // Keyed by the visit (every navigation is a new location key): each opening of an app page,
  // the same app included, starts on its first screenshot, no rating and two versions, as the
  // prototype's go() resets shot, myRating and showAllVersions on every navigation.
  return app ? <AppPage key={`${app.id}:${visit}`} app={app} catalog={catalog} /> : <AppNotFound />;
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
  const features = useFeatures();
  const placeholderShots = !app.source;
  return (
    <div className={styles.page}>
      <BackLink label={t("common.back")} />
      <AppHeader app={app} />

      {placeholderShots && (
        <>
          <h2 className={`${styles.heading} ${styles.shotsHeading}`}>{t("app.screenshots")}</h2>
          <ScreenshotViewer
            shots={PLACEHOLDER_SHOTS}
            index={shot}
            onIndexChange={setShot}
            tint={app.tint}
            previousLabel={t("common.previous")}
            nextLabel={t("common.next")}
          />
        </>
      )}

      <div className={styles.columns}>
        <AppAbout app={app} />
        <AppDetails app={app} />
      </div>

      {features.reviews && <AppReviews app={app} reviewPool={catalog.reviewPool} />}
      <VersionHistory app={app} catalog={catalog} />
      <MoreInCollection app={app} collections={catalog.collections} />
    </div>
  );
}
