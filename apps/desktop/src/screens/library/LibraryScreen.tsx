// Library — installed apps: tabs (Installed / Favorites / Collections), sort, list/grid, the ⋯
// menu, collections, quick filters and stats (Paparats Prototype.dc.html lines 546–673,
// `renderVals` "// library" 1955–1972 and 2185–2188, 2224).
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { Button } from "@/components/Button";
import { CollectionCard } from "@/components/CollectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { PageBanner } from "@/components/PageBanner";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import { Tabs } from "@/components/Tabs";
import type { LibrarySort, LibraryTab, LibraryView } from "@/domain/apps";
import { pickText } from "@/domain/text";
import { useLocale } from "@/hooks";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { LibraryAppCard, LibraryAppRow } from "./LibraryItems";
import { LibrarySidebar } from "./LibrarySidebar";
import { useLibraryModel, type LibraryEmptyKind, type LibraryModel } from "./useLibraryModel";
import styles from "./LibraryScreen.module.css";

export function LibraryScreen() {
  const { t } = useTranslation();
  const { go } = useNav();
  const model = useLibraryModel();
  // Rendered once the data is in (the navigation skeleton covers the wait), so no empty state
  // or zero count flashes.
  if (!model.ready) return null;
  const browse = () => go({ to: "browse", filters: {} });

  return (
    <div className={styles.screen}>
      <PageBanner
        title={t("nav.library")}
        // The prototype's markup shows the tagline; the count it computes (`libSubtitle`) is unused.
        subtitle={t("library.librarySub")}
        motto={t("common.mottoB")}
        narrowMotto
        actions={
          <Button
            variant="primaryOnImage"
            size="xl"
            leadingIcon={<Icon name="download" size={18} strokeWidth={2.2} />}
            onClick={browse}
          >
            {t("library.installApp")}
          </Button>
        }
      />
      <div className={styles.layout}>
        <div className={styles.main}>
          <LibraryContent model={model} onBrowse={browse} />
        </div>
        <LibrarySidebar model={model} />
      </div>
    </div>
  );
}

/** Toolbar, then the collection cards, or the (breadcrumb +) list / grid / empty state. */
function LibraryContent({ model, onBrowse }: { model: LibraryModel; onBrowse: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const panelId = useId();
  const sortId = useId();
  const tab = useLibraryStore((s) => s.tab);
  const sort = useLibraryStore((s) => s.sort);
  const view = useLibraryStore((s) => s.view);
  const setTab = useLibraryStore((s) => s.setTab);
  const setSort = useLibraryStore((s) => s.setSort);
  const setView = useLibraryStore((s) => s.setView);
  const openCollection = useLibraryStore((s) => s.openCollection);
  const closeCollection = useLibraryStore((s) => s.closeCollection);

  const tabs: ReadonlyArray<{ value: LibraryTab; label: string; count: number }> = [
    { value: "installed", label: t("library.tabInstalled"), count: model.counts.installed },
    { value: "favorites", label: t("library.tabFavorites"), count: model.counts.favorites },
    {
      value: "collections",
      label: t("library.tabCollections"),
      count: model.counts.collectionsTab,
    },
  ];
  const sorts: ReadonlyArray<{ value: LibrarySort; label: string }> = [
    { value: "recent", label: t("library.sortRecent") },
    { value: "name", label: t("common.sortName") },
    { value: "size", label: t("common.sortSize") },
  ];
  const views: ReadonlyArray<{
    value: LibraryView;
    icon: "list" | "layout-grid";
    ariaLabel: string;
  }> = [
    { value: "list", icon: "list", ariaLabel: t("library.listView") },
    { value: "grid", icon: "layout-grid", ariaLabel: t("library.gridView") },
  ];
  const tabLabel = tabs.find((item) => item.value === tab)?.label ?? "";
  const open = model.openCollection;

  return (
    <>
      <div className={styles.toolbar}>
        <Tabs
          items={tabs}
          value={tab}
          onChange={setTab}
          // Like the prototype, the current tab also resets: Installed drops the quick filter,
          // Collections closes the open collection.
          onReselect={setTab}
          label={t("nav.library")}
          panelId={() => panelId}
          className={styles.tabs}
        />
        <div className={styles.toolbarEnd}>
          <label htmlFor={sortId} className={styles.sortLabel}>
            {t("common.sortBy")}
          </label>
          <Select id={sortId} value={sort} onChange={setSort} options={sorts} ground="card" />
          <SegmentedControl
            options={views}
            value={view}
            onChange={setView}
            label={t("library.viewAs")}
            ground="card"
            iconStrokeWidth={2}
          />
        </div>
      </div>

      <div id={panelId} role="tabpanel" aria-label={tabLabel}>
        {model.showCollectionCards ? (
          model.collections.length > 0 && (
            <ul className={styles.collections} aria-label={t("common.collections")}>
              {model.collections.map((collection) => (
                <li key={collection.id} className={styles.cell}>
                  <CollectionCard
                    variant="library"
                    icon={collection.icon}
                    title={pickText(collection.label, locale)}
                    subtitle={t("common.appsCount", { count: model.collectionCount(collection) })}
                    onClick={() => openCollection(collection.id)}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            {open && (
              <nav className={styles.crumbs} aria-label={t("library.tabCollections")}>
                <button type="button" className={styles.crumbBack} onClick={closeCollection}>
                  <Icon name="chevron-left" size={14} strokeWidth={2} />
                  {t("library.backToCollections")}
                </button>
                <span className={styles.crumbSep} aria-hidden="true">
                  /
                </span>
                <span className={styles.crumbTitle} aria-current="page">
                  {pickText(open.label, locale)}
                </span>
              </nav>
            )}
            <LibraryList model={model} view={view} label={tabLabel} />
          </>
        )}
        {model.empty && <LibraryEmpty kind={model.empty} onBrowse={onBrowse} />}
      </div>
    </>
  );
}

function LibraryList({
  model,
  view,
  label,
}: {
  model: LibraryModel;
  view: LibraryView;
  label: string;
}) {
  if (model.list.length === 0) return null;
  return view === "list" ? (
    <ul className={styles.rows} aria-label={label}>
      {model.list.map((app) => (
        <li key={app.id} className={styles.cell}>
          <LibraryAppRow app={app} />
        </li>
      ))}
    </ul>
  ) : (
    <ul className={styles.grid} aria-label={label}>
      {model.list.map((app) => (
        <li key={app.id} className={styles.cell}>
          <LibraryAppCard app={app} />
        </li>
      ))}
    </ul>
  );
}

/** Empty states (the prototype's `libEmpty`, line 1967): the Paparats mark, title, hint, CTA. */
function LibraryEmpty({ kind, onBrowse }: { kind: LibraryEmptyKind; onBrowse: () => void }) {
  const { t } = useTranslation();
  let title: string;
  let hint = "";
  switch (kind) {
    case "favorites":
      title = t("library.noFavorites");
      hint = t("library.noFavoritesHint");
      break;
    case "downloads":
      title = t("library.noDownloads");
      hint = t("library.noDownloadsHint");
      break;
    case "updates":
      title = t("common.upToDate");
      hint = t("common.upToDateHint");
      break;
    case "collection":
      title = t("common.noResults");
      break;
    case "library":
      title = t("library.emptyLibrary");
      hint = t("library.emptyLibraryHint");
      break;
  }
  return (
    <EmptyState
      size="md"
      framed
      logo
      title={title}
      hint={<span className={styles.emptyHint}>{hint}</span>}
      action={
        kind === "library" ? (
          <Button variant="primary" size="md" onClick={onBrowse}>
            {t("library.browseApps")}
          </Button>
        ) : undefined
      }
    />
  );
}
