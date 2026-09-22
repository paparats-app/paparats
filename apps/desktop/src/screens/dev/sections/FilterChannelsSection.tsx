import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChannelRow } from "@/components/ChannelRow";
import {
  FilterCheckOption,
  FilterGroup,
  FilterPanel,
  FilterRadioOptions,
} from "@/components/FilterPanel";
import { SettingsCard } from "@/components/SettingsRow";
import { downDays } from "@/domain/channels";
import type { CategoryId, ChannelInfo } from "@/services/types";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { CATALOG, CHANNELS, iconOf, noop, TODAY, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

type Sort = "featured" | "newest" | "name" | "size";

/** The Browse filter panel with live demo state (search, checkboxes, sort). */
export function FilterPanelSection() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [cats, setCats] = useState<readonly CategoryId[]>(["utilities"]);
  const [pro, setPro] = useState(false);
  const [portable, setPortable] = useState(false);
  const [sources, setSources] = useState<readonly string[]>([]);
  const [sort, setSort] = useState<Sort>("featured");
  // Unique per theme panel so the two galleries' native radio groups stay apart.
  const sortName = useId();
  const toggle = <T,>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const label = (id: CategoryId) => t(`categories.items.${id}.label`);
  const shown = CATALOG.categories.filter((c) =>
    label(c.id).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const followed = CHANNELS.filter((c) => ["paparats", "nilesoft", "fossfriends"].includes(c.id));
  return (
    <Specimen caption="FilterPanel › FilterGroup · FilterCheckOption (disabled, dot + count) · FilterRadioOptions">
      <DesignFrame width={220}>
        <FilterPanel
          sticky={false}
          onClearAll={() => {
            setCats([]);
            setPro(false);
            setPortable(false);
            setSources([]);
            setSort("featured");
          }}
          search={{ value: query, onChange: setQuery }}
        >
          <FilterGroup label={t("common.category")}>
            {shown.map((c) => (
              <FilterCheckOption
                key={c.id}
                label={label(c.id)}
                checked={cats.includes(c.id)}
                onChange={() => setCats((list) => toggle(list, c.id))}
              />
            ))}
          </FilterGroup>
          <FilterGroup label={t("browse.price")}>
            <FilterCheckOption label={t("browse.priceFree")} checked disabled onChange={noop} />
            <FilterCheckOption label={t("browse.pricePro")} checked={pro} onChange={setPro} />
          </FilterGroup>
          <FilterGroup label={t("browse.platform")}>
            <FilterCheckOption label={t("browse.platWindows")} checked disabled onChange={noop} />
            <FilterCheckOption
              label={t("browse.platPortable")}
              checked={portable}
              onChange={setPortable}
            />
          </FilterGroup>
          <FilterGroup label={t("common.source")}>
            {followed.map((c) => (
              <FilterCheckOption
                key={c.id}
                label={c.name}
                dot={c.tint}
                count={String(
                  CATALOG.apps.filter((a) => (a.channel ?? "paparats") === c.id).length,
                )}
                checked={sources.includes(c.id)}
                onChange={() => setSources((list) => toggle(list, c.id))}
              />
            ))}
          </FilterGroup>
          <FilterGroup label={t("common.sortBy")}>
            <FilterRadioOptions<Sort>
              name={sortName}
              value={sort}
              onChange={setSort}
              options={[
                { value: "featured", label: t("browse.sortFeatured") },
                { value: "newest", label: t("browse.sortNewest") },
                { value: "name", label: t("common.sortName") },
                { value: "size", label: t("common.sortSize") },
              ]}
            />
          </FilterGroup>
        </FilterPanel>
      </DesignFrame>
    </Specimen>
  );
}

const KIND_KEY = {
  catalog: "sources.kindCatalog",
  developer: "sources.kindDeveloper",
  curated: "sources.kindCurated",
} as const;

/** Sources list rows (official, verified, community + stale callout, paused) and catalog rows. */
export function ChannelRowsSection() {
  const { t } = useTranslation();
  const { format } = useSample();
  const [paused, setPaused] = useState<Record<string, boolean>>({ winaero: true });
  const [acknowledged, setAcknowledged] = useState(false);
  const meta = (c: ChannelInfo) =>
    [
      t(KIND_KEY[c.kind]),
      t("sources.byAuthor", { author: c.author }),
      t("common.appsCount", {
        count: CATALOG.apps.filter((a) => (a.channel ?? "paparats") === c.id).length,
      }),
    ].join(" · ");
  const list = CHANNELS.filter((c) =>
    ["paparats", "nilesoft", "fossfriends", "winaero"].includes(c.id),
  );
  const catalog = CHANNELS.filter((c) => ["mpvbuilds", "bysoft"].includes(c.id));
  return (
    <Specimen
      caption='ChannelRow (settings) · official / enabled / paused / unreachable + stale · variant="catalog"'
      wide
    >
      <DesignFrame width={WIDTH.settings}>
        <div className={styles.stack}>
          <SettingsCard>
            {list.map((c) => {
              const down = c.outage ? downDays(c, TODAY) : 0;
              const official = c.trust === "official";
              return (
                <ChannelRow
                  key={c.id}
                  name={c.name}
                  icon={iconOf(c)}
                  trust={c.trust}
                  meta={meta(c)}
                  syncText={
                    down > 0
                      ? t("sources.unreachableFor", { count: down })
                      : c.synced
                        ? t("sources.syncedRel", { when: format.relative(c.synced) })
                        : t("sources.neverSynced")
                  }
                  unreachable={down > 0}
                  official={official}
                  enabled={!paused[c.id]}
                  onEnabledChange={(on) => setPaused((p) => ({ ...p, [c.id]: !on }))}
                  onOpen={noop}
                  stale={
                    down >= 14 && !acknowledged
                      ? {
                          title: t("sources.staleTitle", { channel: c.name, count: down }),
                          onKeep: () => setAcknowledged(true),
                          onUnsubscribe: () => setAcknowledged(true),
                        }
                      : undefined
                  }
                />
              );
            })}
          </SettingsCard>
          <SettingsCard>
            {catalog.map((c) => (
              <ChannelRow
                key={c.id}
                variant="catalog"
                name={c.name}
                icon={iconOf(c)}
                trust={c.trust}
                meta={meta(c)}
                onOpen={noop}
                onSubscribe={noop}
              />
            ))}
          </SettingsCard>
        </div>
      </DesignFrame>
    </Specimen>
  );
}
