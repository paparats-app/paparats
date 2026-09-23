import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppCard, type AppActionView } from "@/components/AppCard";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { app, CATALOG, channel, iconOf, noop, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

/** AppCard in every action state, the split variant with a channel chip, and the Pro link card. */
export function AppCardsSection() {
  const { t } = useTranslation();
  const { text, format } = useSample();
  const [started, setStarted] = useState(false);
  const cat = (id: string) => t(`categories.items.${app(id).category}.label`);
  const details = { label: t("common.details"), onClick: noop };

  const states: Array<{ id: string; action: AppActionView; progress?: number }> = [
    started
      ? {
          id: "obsidian",
          action: {
            label: `${format.percent(43)} · ${t("common.pause")}`,
            tone: "progress",
            onClick: () => setStarted(false),
          },
          progress: 43,
        }
      : { id: "obsidian", action: { label: t("common.get"), onClick: () => setStarted(true) } },
    { id: "sharex", action: { label: t("common.open") } },
    { id: "vlc", action: { label: t("common.update"), tone: "primary" } },
    {
      id: "powertoys",
      action: { label: `${t("common.installing")}…`, tone: "progress", disabled: true },
      progress: 100,
    },
    { id: "notepadpp", action: { label: t("common.queued"), tone: "quiet", disabled: true } },
    { id: "everything", action: { label: t("common.unavailableOffline"), tone: "muted" } },
  ];

  const foss = channel("fossfriends");
  const channelApps = CATALOG.apps.filter((a) => a.channel !== null).slice(0, 5);
  const proApps = CATALOG.proApps.map(app);

  return (
    <>
      <Specimen
        caption="6-col · secondary (split) · Get → NN% · Pause (click) / Open / Update / Installing… / Queued / Offline"
        wide
      >
        <DesignFrame width={WIDTH.content}>
          <div className={`${styles.grid} ${styles.cols6}`}>
            {states.map(({ id, action, progress }) => {
              const a = app(id);
              return (
                <AppCard
                  key={id}
                  name={a.name}
                  icon={iconOf(a)}
                  tagline={text(a.tagline)}
                  category={cat(id)}
                  action={action}
                  secondary={details}
                  onOpen={noop}
                  progress={progress}
                />
              );
            })}
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen
        caption="5-col · channel chip · single action (no secondary) · proLabel next to chips"
        wide
      >
        <DesignFrame width={WIDTH.browse}>
          <div className={`${styles.grid} ${styles.cols5}`}>
            {channelApps.map((a, i) => {
              const ch = channel(a.channel ?? foss.id);
              return (
                <AppCard
                  key={a.id}
                  name={a.name}
                  icon={iconOf(a)}
                  publisher={i === 0 ? a.publisher : undefined}
                  tagline={text(a.tagline)}
                  category={cat(a.id)}
                  channel={{ name: ch.name, tint: ch.tint }}
                  action={
                    i === 1
                      ? { label: t("common.subscribe") }
                      : { label: t("common.get"), onClick: noop }
                  }
                  proLabel={i === 2 ? t("common.pro") : undefined}
                  onOpen={noop}
                />
              );
            })}
          </div>
        </DesignFrame>
      </Specimen>
      <Specimen caption="link card (no action) · 44px · proLabel pinned bottom-right" wide>
        <DesignFrame width={WIDTH.library}>
          <div className={`${styles.grid} ${styles.cols5}`}>
            {proApps.map((a) => (
              <AppCard
                key={a.id}
                name={a.name}
                icon={iconOf(a)}
                tagline={a.proNote ? text(a.proNote) : undefined}
                proLabel={t("common.pro")}
                onOpen={noop}
              />
            ))}
          </div>
        </DesignFrame>
      </Specimen>
    </>
  );
}
