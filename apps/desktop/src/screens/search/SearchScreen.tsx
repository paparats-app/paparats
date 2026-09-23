import { useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { pickByIds, searchApps } from "@/domain/apps";
import { useChannelContext, useLocale, useOffline, useVisibleApps } from "@/hooks";
import { useCatalog, useLibrary } from "@/queries";
import { StoreAppCard } from "@/screens/shared";
import type { App, AppId } from "@/services/types";
import { useUiStore } from "@/stores/useUiStore";
import styles from "./SearchScreen.module.css";

/** Placeholders while "Searching…" (one row, rippling .12s apart). */
const SKELETON_CARDS = [0, 1, 2, 3, 4, 5];
/** "Try one of these": the first featured apps the user can see. */
const SUGGESTION_COUNT = 4;

/**
 * Global search results (prototype lines 152–199; logic `// search` and `setQuery`). The shell
 * renders it instead of the route while the top-bar query is non-blank. Matching runs over name,
 * publisher, tagline, category label and source channel name in the current language.
 */
export function SearchScreen() {
  const { t } = useTranslation();
  const query = useUiStore((s) => s.query).trim();
  const searching = useUiStore((s) => s.searching);
  const offline = useOffline();
  const apps = useVisibleApps();
  const channels = useChannelContext();
  const catalog = useCatalog();
  const libraryPending = useLibrary().isPending;
  const locale = useLocale();
  const titleId = useId();

  const results = useMemo(
    () =>
      searchApps(apps, query, {
        locale,
        categoryLabel: (id) => t(`categories.items.${id}.label`),
        channelName: (id) => channels.byId[id]?.name ?? "",
        sourceOf: channels.sourceOf,
      }),
    [apps, query, locale, t, channels],
  );

  // Until the catalog, channels and library have loaded, "nothing found" would be a guess.
  const loading = catalog.isPending || libraryPending || !channels.ready;
  const busy = !offline && (searching || loading);

  let countLine = "";
  if (!offline) {
    countLine = busy ? t("search.searching") : t("common.appsCount", { count: results.length });
  }

  let body: ReactNode;
  if (offline) body = <OfflineSearch />;
  else if (busy) body = <SearchSkeleton />;
  else if (results.length > 0) {
    body = (
      <div className={styles.grid}>
        {results.map((app) => (
          <StoreAppCard key={app.id} app={app} />
        ))}
      </div>
    );
  } else body = <NoResults apps={apps} featured={catalog.data?.featured} />;

  return (
    <section className={styles.search} aria-labelledby={titleId}>
      <h1 id={titleId} className={styles.title}>
        {t("common.resultsFor", { query })}
      </h1>
      <div className={styles.count} role="status">
        {countLine}
      </div>
      {body}
    </section>
  );
}

function SearchSkeleton() {
  return (
    <div className={styles.grid} aria-busy="true" data-testid="search-skeleton">
      {SKELETON_CARDS.map((i) => (
        <Skeleton key={i} height={150} index={i} />
      ))}
    </div>
  );
}

/** Nothing matched: the logo, a hint, four featured apps to try and a way to Categories. */
function NoResults({ apps, featured }: { apps: readonly App[]; featured?: readonly AppId[] }) {
  const { t } = useTranslation();
  const { go } = useNav();
  const setQuery = useUiStore((s) => s.setQuery);
  const labelId = useId();

  const suggestions = useMemo(
    () => pickByIds(apps, featured ?? []).slice(0, SUGGESTION_COUNT),
    [apps, featured],
  );

  return (
    <EmptyState
      logo
      title={t("common.noResults")}
      hint={t("search.noResultsHint")}
      wideHint
      action={
        <div className={styles.suggest}>
          {suggestions.length > 0 && (
            <>
              <div id={labelId} className={styles.tryLabel}>
                {t("search.tryThese")}
              </div>
              <div className={styles.chips} role="group" aria-labelledby={labelId}>
                {suggestions.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className={styles.chip}
                    // Sets the query without the "Searching…" pause (prototype `a.search`).
                    onClick={() => setQuery(app.name, { skeleton: false })}
                  >
                    <AppIcon mono={app.mono} tint={app.tint} iconUrl={app.iconUrl} size={24} />
                    {app.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <Button
            variant="link"
            size="compact"
            className={styles.categoriesLink}
            trailingIcon={<Icon name="arrow-right" size={14} strokeWidth={2} />}
            onClick={() => go({ to: "categories" })}
          >
            {t("nav.categories")}
          </Button>
        </div>
      }
    />
  );
}

/** Search needs the catalog: offline copy and a way to the Library instead of results. */
function OfflineSearch() {
  const { t } = useTranslation();
  const { go } = useNav();
  return (
    <EmptyState
      icon="wifi-off"
      iconTone="danger"
      title={t("search.offlineSearch")}
      hint={t("search.offlineSearchHint")}
      wideHint
      action={
        <Button variant="secondary" size="md" onClick={() => go({ to: "library" })}>
          {t("nav.library")}
        </Button>
      }
    />
  );
}
