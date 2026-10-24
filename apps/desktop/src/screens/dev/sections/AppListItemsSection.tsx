import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppActionView } from "@/components/AppCard";
import {
  CompactUpdatedRow,
  LibraryGridCard,
  LibraryRow,
  NotableCard,
  NotableRow,
  UpdateRow,
} from "@/components/AppListItem";
import type { App } from "@/services/types";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { app, CATALOG, channel, iconOf, LIBRARY, noop, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

function installedVersion(id: string): string {
  return LIBRARY.installed.find((i) => i.appId === id)?.version ?? app(id).version;
}

/** Library list/grid, update rows, compact "Recently updated" rows and the notable variants. */
export function AppListItemsSection() {
  const { t } = useTranslation();
  const { text, pick, format } = useSample();
  const [favorites, setFavorites] = useState<readonly string[]>(LIBRARY.favorites);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ vscode: true });
  const cat = (a: App) => t(`categories.items.${a.category}.label`);
  const tag2 = (a: App) =>
    a.pro ? t("common.pro") : a.portable ? t("common.portable") : a.license;
  const toggleFavorite = (id: string) =>
    setFavorites((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const manifest = (id: string) => CATALOG.updates.find((u) => u.appId === id);
  const pct = format.percent(43);
  const downloading: AppActionView = {
    label: `${pct} · ${t("common.pause")}`,
    tone: "progress",
  };

  const libraryRows: Array<{
    a: App;
    action: AppActionView;
    sub: string;
    mint?: boolean;
    progress?: number;
    status?: string;
  }> = [
    {
      a: app("vscode"),
      action: { label: t("common.update"), tone: "primary" },
      sub: `${t("common.update")} → ${app("vscode").version}`,
      mint: true,
    },
    {
      a: app("obsidian"),
      action: { label: t("common.open") },
      sub: t("common.updatedRel", { when: format.relative("2026-09-14") }),
    },
    {
      a: app("flow"),
      action: downloading,
      sub: t("common.ofSize", { downloaded: format.size(12), size: format.size(28) }),
      status: `${t("common.downloading")}… ${pct}`,
      progress: 43,
    },
  ];

  const updates = ["vscode", "obsidian", "flow"].map(app);

  return (
    <>
      <Specimen
        caption="LibraryRow · favorite star · Update → x (mint) · downloading + 2px bar · ⋯ menu"
        wide
      >
        <DesignFrame width={WIDTH.library} room={130}>
          <div className={styles.stack6}>
            {libraryRows.map(({ a, action, sub, mint, progress, status }) => (
              <LibraryRow
                key={a.id}
                name={a.name}
                icon={iconOf(a)}
                tagline={text(a.tagline)}
                favorite={favorites.includes(a.id)}
                tags={[cat(a), tag2(a)]}
                status={status ?? installedVersion(a.id)}
                statusSub={sub}
                statusTone={mint ? "mint" : "default"}
                action={action}
                progress={progress}
                onOpen={noop}
                onToggleFavorite={() => toggleFavorite(a.id)}
                onOpenFolder={noop}
                onUninstall={noop}
                moreLabel={t("common.moreActions")}
              />
            ))}
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen caption="LibraryGridCard (4-col) · favourite toggle (click)" wide>
        <DesignFrame width={WIDTH.library}>
          <div className={`${styles.grid} ${styles.cols4}`}>
            {libraryRows
              .concat({ a: app("sevenzip"), action: { label: t("common.open") }, sub: "" })
              .map(({ a, action, progress }) => (
                <LibraryGridCard
                  key={a.id}
                  name={a.name}
                  icon={iconOf(a)}
                  subtitle={`${installedVersion(a.id)} · ${format.relative("2026-09-12")}`}
                  action={action}
                  favorite={favorites.includes(a.id)}
                  onToggleFavorite={() => toggleFavorite(a.id)}
                  progress={progress}
                  onOpen={noop}
                />
              ))}
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen caption="UpdateRow · expanded (click chevron) · downloading + 3px bar · done" wide>
        <DesignFrame width={WIDTH.updates}>
          <div className={styles.stack}>
            {updates.map((a, i) => {
              const info = manifest(a.id);
              return (
                <UpdateRow
                  key={a.id}
                  name={a.name}
                  icon={iconOf(a)}
                  channel={
                    i === 1
                      ? { name: channel("kvetka").name, tint: channel("kvetka").tint }
                      : undefined
                  }
                  versionLine={
                    i === 2
                      ? `${t("common.downloading")}… ${pct} · ${t("common.ofSize", { downloaded: format.size(12), size: format.size(28) })}`
                      : `${installedVersion(a.id)} → ${a.version}`
                  }
                  sizeLabel={format.size(info?.downloadMb ?? a.sizeMb)}
                  action={i === 2 ? downloading : { label: t("common.update"), tone: "primary" }}
                  progress={i === 2 ? 43 : undefined}
                  expanded={expanded[a.id] ?? false}
                  onToggleExpanded={() => setExpanded((e) => ({ ...e, [a.id]: !e[a.id] }))}
                  notes={info ? pick(info.notes) : []}
                  onOpen={noop}
                />
              );
            })}
            <UpdateRow
              name={app("sharex").name}
              icon={iconOf(app("sharex"))}
              versionLine={app("sharex").version}
              sizeLabel={format.size(app("sharex").sizeMb)}
              action={{ label: t("common.update"), tone: "primary" }}
              done
              expanded={false}
              onToggleExpanded={noop}
              notes={[]}
            />
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen caption="CompactUpdatedRow (Home, 3-col)" wide>
        <DesignFrame width={WIDTH.content}>
          <div className={`${styles.grid} ${styles.cols3}`}>
            {["sharex", "vscode", "obsidian"].map(app).map((a, i) => (
              <CompactUpdatedRow
                key={a.id}
                name={a.name}
                icon={iconOf(a)}
                version={a.version}
                updated={t("common.updatedRel", { when: format.relative(a.updated) })}
                action={
                  i === 1
                    ? { label: t("common.update"), tone: "primary" }
                    : { label: t("common.get") }
                }
                onOpen={noop}
              />
            ))}
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen caption="NotableRow (Browse, 2-col) · NotableCard (Home, 4-col)" wide>
        <DesignFrame width={WIDTH.content}>
          <div className={styles.stack}>
            <div className={`${styles.grid} ${styles.cols2}`}>
              {CATALOG.notable
                .slice(0, 2)
                .map(app)
                .map((a) => (
                  <NotableRow
                    key={a.id}
                    name={a.name}
                    icon={iconOf(a)}
                    tagline={text(a.tagline)}
                    category={cat(a)}
                    channel={
                      a.channel
                        ? { name: channel(a.channel).name, tint: channel(a.channel).tint }
                        : undefined
                    }
                    action={{ label: t("common.get"), onClick: noop }}
                    onOpen={noop}
                  />
                ))}
            </div>
            <div className={`${styles.grid} ${styles.cols4}`}>
              {CATALOG.notable.map(app).map((a) => (
                <NotableCard
                  key={a.id}
                  name={a.name}
                  icon={iconOf(a)}
                  tagline={text(a.tagline)}
                  onOpen={noop}
                />
              ))}
            </div>
          </div>
        </DesignFrame>
      </Specimen>
    </>
  );
}
