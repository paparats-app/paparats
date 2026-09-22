import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import channels from "@fixtures/channels.json";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ProgressBar } from "@/components/ProgressBar";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { WarnCallout } from "@/components/WarnCallout";
import { OnImage, Specimen, SpecimenGrid, Stack } from "./Gallery";
import styles from "./sections.module.css";

const STALE_CHANNEL = channels.channels[2]?.name ?? "";

export function ProgressSection() {
  const { t } = useTranslation();
  return (
    <SpecimenGrid>
      <Specimen caption="ProgressBar height=2 · 3 · 4 · 6" wide>
        <Stack>
          <ProgressBar value={25} height={2} label={t("common.downloading")} />
          <ProgressBar value={43} height={3} label={t("common.downloading")} />
          <ProgressBar value={68} height={4} label={t("common.downloading")} />
          <ProgressBar value={90} height={6} label={t("common.downloading")} />
        </Stack>
      </Specimen>
      <Specimen caption="onImage height=6" wide>
        <OnImage>
          <ProgressBar value={43} height={6} onImage label={t("common.downloading")} />
        </OnImage>
      </Specimen>
      <Specimen caption="Skeleton (cards stagger .12s · wide .2s · static title bars)" wide>
        <Stack>
          <Skeleton height={18} width={180} radius={6} animated={false} />
          <div className={styles.skeletonCards}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={148} index={i} />
            ))}
          </div>
          <Skeleton height={18} width={140} radius={6} animated={false} />
          <div className={styles.skeletonWide}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={96} index={i} stagger={0.2} />
            ))}
          </div>
        </Stack>
      </Specimen>
    </SpecimenGrid>
  );
}

export function NoticesSection() {
  const { t } = useTranslation();
  const [toastKey, setToastKey] = useState(0);

  // The real ToastHost dismisses after 2.8s; the gallery mimics it.
  useEffect(() => {
    if (toastKey === 0) return;
    const timer = setTimeout(() => setToastKey(0), 2800);
    return () => clearTimeout(timer);
  }, [toastKey]);

  return (
    <>
      <SpecimenGrid>
        <Specimen caption="Toast floating={false} · floating (click)">
          <Toast message={t("updates.allUpdated")} floating={false} />
          <Button size="sm" onClick={() => setToastKey((k) => k + 1)}>
            {t("subscription.confirm")}
          </Button>
          {toastKey > 0 && <Toast key={toastKey} message={t("subscription.planConfirmed")} />}
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen caption='WarnCallout size="sm" · actions' wide>
          <WarnCallout
            title={t("sources.staleTitle", { channel: STALE_CHANNEL, count: 16 })}
            actions={[
              { label: t("common.keepChannel"), onClick: () => {} },
              { label: t("common.unsubscribe"), onClick: () => {}, destructive: true },
            ]}
          >
            {t("common.staleBody")}
          </WarnCallout>
        </Specimen>
        <Specimen caption='size="md" · actions' wide>
          <WarnCallout
            size="md"
            title={t("sources.staleTitle", { channel: STALE_CHANNEL, count: 1 })}
            actions={[
              { label: t("common.keepChannel"), onClick: () => {} },
              { label: t("common.unsubscribe"), onClick: () => {}, destructive: true },
            ]}
          >
            {t("common.staleBody")}
          </WarnCallout>
        </Specimen>
        <Specimen caption="note only" wide>
          <WarnCallout>{t("common.trustCommunityHint")}</WarnCallout>
        </Specimen>
      </SpecimenGrid>
    </>
  );
}

export function EmptyStatesSection() {
  const { t } = useTranslation();
  return (
    <SpecimenGrid>
      <Specimen caption='EmptyState icon="check" framed' wide>
        <EmptyState
          icon="check"
          framed
          title={t("common.upToDate")}
          hint={t("common.upToDateHint")}
        />
      </Specimen>
      <Specimen caption='logo size="lg" (search)' wide>
        <EmptyState logo title={t("common.noResults")} hint={t("search.noResultsHint")} />
      </Specimen>
      <Specimen caption='iconTone="danger" · action' wide>
        <EmptyState
          icon="wifi-off"
          iconTone="danger"
          title={t("search.offlineSearch")}
          hint={t("search.offlineSearchHint")}
          action={<Button>{t("nav.library")}</Button>}
        />
      </Specimen>
      <Specimen caption='logo size="md" framed · action' wide>
        <EmptyState
          logo
          framed
          size="md"
          title={t("library.emptyLibrary")}
          hint={t("library.emptyLibraryHint")}
          action={<Button variant="primary">{t("library.browseApps")}</Button>}
        />
      </Specimen>
    </SpecimenGrid>
  );
}
