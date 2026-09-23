import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import {
  FilterCheckOption,
  FilterGroup,
  FilterPanel,
  FilterRadioOptions,
} from "@/components/FilterPanel";
import type { BrowseSort } from "@/domain/apps";
import { useChannelContext, useVisibleApps } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useCatalog } from "@/queries";
import { selectBrowseFilters, useBrowseStore, type BrowseState } from "@/stores/useBrowseStore";

const ALWAYS_ON = () => undefined;

const selectActions = (s: BrowseState) => ({
  clearAll: s.clearAll,
  setFilterQuery: s.setFilterQuery,
  toggleCategory: s.toggleCategory,
  togglePro: s.togglePro,
  togglePortable: s.togglePortable,
  toggleSource: s.toggleSource,
  setSort: s.setSort,
});

/**
 * The sticky filter panel (prototype lines 371–409): "Search filters…" narrows the category list;
 * Category, Price, Platform, Source (only with more than one active channel) and Sort by. Every
 * change leaves an open collection (the store does that).
 */
export function BrowseFilterPanel() {
  const { t } = useTranslation();
  const format = useFormat();
  const sortName = useId();
  const categories = useCatalog().data?.categories;
  const apps = useVisibleApps();
  const ctx = useChannelContext();
  const filters = useBrowseStore(useShallow(selectBrowseFilters));
  const filterQuery = useBrowseStore((s) => s.filterQuery);
  const actions = useBrowseStore(useShallow(selectActions));

  const query = filterQuery.trim().toLowerCase();
  const shownCategories = (categories ?? [])
    .map((c) => ({ id: c.id, label: t(`categories.items.${c.id}.label`) }))
    .filter((c) => !query || c.label.toLowerCase().includes(query));

  // Followed, switched-on channels with the number of visible apps each one is the source of.
  const sources = useMemo(
    () =>
      ctx.channels
        .filter((channel) => ctx.isActive(channel.id))
        .map((channel) => ({
          channel,
          count: apps.filter((app) => ctx.sourceOf(app) === channel.id).length,
        })),
    [ctx, apps],
  );

  const sortOptions: ReadonlyArray<{ value: BrowseSort; label: string }> = [
    { value: "featured", label: t("browse.sortFeatured") },
    { value: "newest", label: t("browse.sortNewest") },
    { value: "name", label: t("common.sortName") },
    { value: "size", label: t("common.sortSize") },
  ];

  return (
    <FilterPanel
      onClearAll={actions.clearAll}
      search={{ value: filterQuery, onChange: actions.setFilterQuery }}
    >
      <FilterGroup label={t("common.category")}>
        {shownCategories.map((c) => (
          <FilterCheckOption
            key={c.id}
            label={c.label}
            checked={filters.categories.includes(c.id)}
            onChange={() => actions.toggleCategory(c.id)}
          />
        ))}
      </FilterGroup>
      <FilterGroup label={t("browse.price")}>
        <FilterCheckOption label={t("browse.priceFree")} checked disabled onChange={ALWAYS_ON} />
        <FilterCheckOption
          label={t("browse.pricePro")}
          checked={filters.pro}
          onChange={() => actions.togglePro()}
        />
      </FilterGroup>
      <FilterGroup label={t("browse.platform")}>
        <FilterCheckOption label={t("browse.platWindows")} checked disabled onChange={ALWAYS_ON} />
        <FilterCheckOption
          label={t("browse.platPortable")}
          checked={filters.portable}
          onChange={() => actions.togglePortable()}
        />
      </FilterGroup>
      {sources.length > 1 && (
        <FilterGroup label={t("common.source")}>
          {sources.map(({ channel, count }) => (
            <FilterCheckOption
              key={channel.id}
              label={channel.name}
              dot={channel.tint}
              count={format.number(count)}
              checked={filters.sources.includes(channel.id)}
              onChange={() => actions.toggleSource(channel.id)}
            />
          ))}
        </FilterGroup>
      )}
      <FilterGroup label={t("common.sortBy")}>
        <FilterRadioOptions<BrowseSort>
          name={sortName}
          value={filters.sort}
          onChange={actions.setSort}
          options={sortOptions}
        />
      </FilterGroup>
    </FilterPanel>
  );
}
