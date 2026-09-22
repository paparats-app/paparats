import { useTranslation } from "react-i18next";
import catalog from "@fixtures/catalog.json";
import channels from "@fixtures/channels.json";
import { ActivePill } from "@/components/ActivePill";
import { AppIcon } from "@/components/AppIcon";
import { Chip } from "@/components/Chip";
import { CountPill } from "@/components/CountPill";
import { ProPill } from "@/components/ProPill";
import { StatusPill } from "@/components/StatusPill";
import { TrustBadge } from "@/components/TrustBadge";
import { Specimen, SpecimenGrid } from "./Gallery";

const APP = catalog.apps[0];
const CHANNEL = channels.channels[1];

export function PillsSection() {
  const { t } = useTranslation();
  return (
    <>
      <SpecimenGrid>
        <Specimen caption='CountPill tone="solid" | "soft" | "neutral"'>
          <CountPill value={3} />
          <CountPill value={12} tone="soft" />
          <CountPill value={128} tone="neutral" />
        </Specimen>
        <Specimen caption='ProPill "solid" | "soft" · ActivePill "sm" | "md"'>
          <ProPill label={t("common.pro")} />
          <ProPill label={t("common.pro")} variant="soft" />
          <ActivePill label={t("common.active")} />
          <ActivePill label={t("common.active")} size="md" />
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen caption='Chip tone="neutral" | "mint" | "outline" (dot) · leading · onClick'>
          <Chip>{t("categories.items.productivity.label")}</Chip>
          <Chip tone="mint">{t("common.free")}</Chip>
          {CHANNEL && (
            <Chip tone="outline" dot={CHANNEL.tint}>
              {CHANNEL.name}
            </Chip>
          )}
          {APP && (
            <Chip leading={<AppIcon mono={APP.mono} tint={APP.tint} size={16} />}>{APP.name}</Chip>
          )}
          {CHANNEL && (
            <Chip tone="outline" dot={CHANNEL.tint} onClick={() => {}}>
              {CHANNEL.name}
            </Chip>
          )}
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen caption='StatusPill status="open" | "work" | "released"'>
          <StatusPill status="open" label={t("ideas.stOpen")} />
          <StatusPill status="work" label={t("ideas.stWork")} />
          <StatusPill status="released" label={t("ideas.stReleased")} />
        </Specimen>
        <Specimen caption='TrustBadge level=… size="sm" | "md" | "lg"'>
          <TrustBadge level="official" label={t("sources.trustOfficial")} size="sm" />
          <TrustBadge level="verified" label={t("sources.trustVerified")} />
          <TrustBadge level="community" label={t("sources.trustCommunity")} size="lg" />
        </Specimen>
      </SpecimenGrid>
    </>
  );
}
