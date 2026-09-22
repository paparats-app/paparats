import { useTranslation } from "react-i18next";
import { ActivePill } from "@/components/ActivePill";
import { Card, type CardPadding } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { SectionHeader } from "@/components/SectionHeader";
import { StatTile } from "@/components/StatTile";
import { Specimen, SpecimenGrid, Stack } from "./Gallery";
import styles from "./sections.module.css";

const PADDINGS: CardPadding[] = ["sm", "md", "lg", "xl"];

export function CardsSection() {
  const { t } = useTranslation();
  return (
    <SpecimenGrid>
      {PADDINGS.map((padding) => (
        <Specimen key={padding} caption={`Card padding="${padding}"`}>
          <Card padding={padding}>{t("library.libraryStats")}</Card>
        </Specimen>
      ))}
      <Specimen caption="radius=12 interactive (hover)">
        <Card radius={12} interactive>
          {t("common.collections")}
        </Card>
      </Specimen>
      <Specimen caption='tone="mint" padding="lg" radius=12' wide>
        <Card tone="mint" padding="lg" radius={12}>
          <div className={styles.proHead}>
            <Icon name="crown" className={styles.mintIcon} />
            <span className={styles.proName}>{t("subscription.proActive")}</span>
            <ActivePill label={t("common.active")} size="md" />
          </div>
        </Card>
      </Specimen>
    </SpecimenGrid>
  );
}

export function StatsSection() {
  const { t } = useTranslation();
  return (
    <SpecimenGrid>
      <Specimen caption='StatTile variant="row"'>
        <Card padding="md">
          <div className={styles.statRows}>
            <StatTile icon="package" value="12" label={t("library.installedApps")} />
            <StatTile icon="star" value="3" label={t("library.favorites")} />
            <StatTile icon="layers" value="4" label={t("common.collections")} />
          </div>
        </Card>
      </Specimen>
      <Specimen caption='variant="tile" · "compact"' wide>
        <Stack>
          <div className={styles.statTiles}>
            <StatTile variant="tile" icon="package" value="12" label={t("profile.appsInstalled")} />
            <StatTile
              variant="tile"
              icon="refresh-cw"
              value="48"
              label={t("profile.updatesInstalled")}
            />
            <StatTile variant="tile" icon="clock" value="320" label={t("profile.timeSaved")} />
          </div>
          <div className={styles.statTiles}>
            <StatTile variant="compact" value="2" label={t("ideas.stWork")} />
            <StatTile variant="compact" value="5" label={t("ideas.stReleased")} />
            <StatTile variant="compact" value="9" label={t("ideas.tabForMyApps")} />
          </div>
        </Stack>
      </Specimen>
    </SpecimenGrid>
  );
}

export function SectionHeadersSection() {
  const { t } = useTranslation();
  return (
    <Stack>
      <SectionHeader
        title={t("common.featured")}
        actionLabel={t("common.seeAll")}
        onAction={() => {}}
      />
      <SectionHeader
        size="md"
        title={t("common.newNotable")}
        actionLabel={t("common.seeAll")}
        onAction={() => {}}
      />
      <SectionHeader size="sm" level={3} title={t("app.screenshots")} />
      <SectionHeader title={t("channel.inChannel")} meta="12" />
    </Stack>
  );
}
