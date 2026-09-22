import { useState } from "react";
import { useTranslation } from "react-i18next";
import account from "@fixtures/account.json";
import catalog from "@fixtures/catalog.json";
import { Checkbox } from "@/components/Checkbox";
import { RadioGroup } from "@/components/Radio";
import { SearchBox } from "@/components/SearchBox";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import { TextArea } from "@/components/TextArea";
import { TextField } from "@/components/TextField";
import { Toggle, ToggleTrack } from "@/components/Toggle";
import { Specimen, SpecimenGrid, Stack } from "./Gallery";
import styles from "./sections.module.css";

type Sort = "featured" | "newest" | "name" | "size";
type Theme = "light" | "dark" | "system";
type View = "list" | "grid";
type Kind = "new" | "app";

export function TogglesSection() {
  const { t } = useTranslation();
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [cats, setCats] = useState<string[]>(["productivity"]);
  const [sort, setSort] = useState<Sort>("featured");
  return (
    <SpecimenGrid>
      <Specimen caption="Toggle on · off · disabled · ToggleTrack sm">
        <Toggle checked={on} onChange={setOn} label={t("updates.autoUpdates")} />
        <Toggle checked={off} onChange={setOff} label={t("common.off")} />
        <Toggle checked disabled onChange={() => {}} label={t("sources.alwaysOn")} />
        <Toggle checked={false} disabled onChange={() => {}} label={t("common.off")} />
        <ToggleTrack checked size="sm" />
        <ToggleTrack checked={false} size="sm" />
      </Specimen>
      <Specimen caption="Checkbox (interactive · disabled checked)">
        <div className={styles.filterList}>
          {(["productivity", "development", "design"] as const).map((id) => (
            <Checkbox
              key={id}
              label={t(`categories.items.${id}.label`)}
              checked={cats.includes(id)}
              onChange={(checked) =>
                setCats((current) => (checked ? [...current, id] : current.filter((c) => c !== id)))
              }
            />
          ))}
          <Checkbox checked disabled onChange={() => {}} label={t("browse.priceFree")} />
        </div>
      </Specimen>
      <Specimen caption="RadioGroup">
        <div className={styles.filterList}>
          <RadioGroup<Sort>
            name="dev-sort"
            label={t("common.sortBy")}
            value={sort}
            onChange={setSort}
            options={[
              { value: "featured", label: t("browse.sortFeatured") },
              { value: "newest", label: t("browse.sortNewest") },
              { value: "name", label: t("common.sortName") },
              { value: "size", label: t("common.sortSize"), disabled: true },
            ]}
          />
        </div>
      </Specimen>
    </SpecimenGrid>
  );
}

export function ChoiceSection() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>("dark");
  const [view, setView] = useState<View>("list");
  const [kind, setKind] = useState<Kind>("new");
  const [sort, setSort] = useState("recent");
  return (
    <>
      <SpecimenGrid>
        <Specimen caption='SegmentedControl size="sm" ground="bg"'>
          <SegmentedControl<Theme>
            label={t("settings.theme")}
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: t("common.themeLight") },
              { value: "dark", label: t("common.themeDark") },
              { value: "system", label: t("common.themeSystem") },
            ]}
          />
        </Specimen>
        <Specimen caption='icon-only ground="card"'>
          <SegmentedControl<View>
            label={t("common.sortBy")}
            ground="card"
            value={view}
            onChange={setView}
            options={[
              { value: "list", icon: "list", ariaLabel: t("library.listView") },
              { value: "grid", icon: "layout-grid", ariaLabel: t("library.gridView") },
            ]}
          />
        </Specimen>
        <Specimen caption='size="md" fullWidth' wide>
          <SegmentedControl<Kind>
            label={t("ideas.suggestIdea")}
            size="md"
            fullWidth
            value={kind}
            onChange={setKind}
            options={[
              { value: "new", label: t("ideas.ideaNew") },
              { value: "app", label: t("ideas.ideaImprove") },
            ]}
          />
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen caption='Select size="sm" ground="bg" | "card" · disabled'>
          <Select
            aria-label={t("common.sortBy")}
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: t("library.sortRecent") },
              { value: "name", label: t("common.sortName") },
              { value: "size", label: t("common.sortSize") },
            ]}
          />
          <Select
            aria-label={t("common.sortBy")}
            ground="card"
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: t("library.sortRecent") },
              { value: "name", label: t("common.sortName") },
              { value: "size", label: t("common.sortSize") },
            ]}
          />
          <Select
            aria-label={t("common.sortBy")}
            disabled
            value="recent"
            onChange={() => {}}
            options={[{ value: "recent", label: t("library.sortRecent") }]}
          />
        </Specimen>
        <Specimen caption='Select size="lg" ground="input" fullWidth' wide>
          <Select
            aria-label={t("common.category")}
            size="lg"
            ground="input"
            fullWidth
            value="design"
            onChange={() => {}}
            options={[
              { value: "design", label: t("categories.items.design.label") },
              { value: "media", label: t("categories.items.media.label") },
            ]}
          />
        </Specimen>
      </SpecimenGrid>
    </>
  );
}

export function TextInputsSection() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState("");
  return (
    <>
      <SpecimenGrid>
        <Specimen caption='TextField size="md" · label' wide>
          <div className={styles.twoCols}>
            <TextField label={t("profile.name")} defaultValue={account.profile.name} />
            <TextField
              label={t("profile.email")}
              type="email"
              defaultValue={account.profile.email}
            />
          </div>
        </Specimen>
        <Specimen caption='size="lg" · hint' wide>
          <TextField
            size="lg"
            label={t("sources.channelAddr")}
            hint={t("sources.channelAddrHint")}
            placeholder={t("sources.channelAddrPlaceholder")}
          />
        </Specimen>
        <Specimen caption="error (type ≥ 6 chars to clear) · disabled · mono" wide>
          <Stack>
            <TextField
              size="lg"
              label={t("ideas.ideaTitle")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={title.trim().length < 6 ? t("ideas.ideaTitleShort") : undefined}
            />
            <div className={styles.twoCols}>
              <TextField
                aria-label={t("profile.name")}
                disabled
                defaultValue={account.profile.name}
              />
              <TextField
                aria-label={t("common.version")}
                mono
                defaultValue={catalog.apps[0]?.version}
              />
            </div>
          </Stack>
        </Specimen>
        <Specimen caption="TextArea" wide>
          <TextArea
            label={t("ideas.ideaBody")}
            placeholder={t("ideas.ideaBodyPlaceholder")}
            rows={3}
          />
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen caption='SearchBox variant="topbar"' wide>
          <SearchBox
            label={t("shell.search")}
            placeholder={t("shell.search")}
            value={query}
            onValueChange={setQuery}
          />
        </Specimen>
        <Specimen caption='variant="compact"'>
          <div className={styles.filterPanel}>
            <SearchBox
              variant="compact"
              label={t("browse.searchFilters")}
              placeholder={t("browse.searchFilters")}
              value={filter}
              onValueChange={setFilter}
            />
          </div>
        </Specimen>
      </SpecimenGrid>
    </>
  );
}
