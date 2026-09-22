import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, IconButton } from "@/components/Button";
import { CarouselDots } from "@/components/CarouselDots";
import { Menu } from "@/components/Menu";
import { Popover } from "@/components/Popover";
import { Tabs } from "@/components/Tabs";
import { Toggle } from "@/components/Toggle";
import { OnImage, Specimen, SpecimenGrid } from "./Gallery";
import styles from "./sections.module.css";

type LibTab = "installed" | "favorites" | "collections";
type ProfileTab = "account" | "preferences" | "security" | "devices" | "data";

export function TabsSection() {
  const { t } = useTranslation();
  const [lib, setLib] = useState<LibTab>("installed");
  const [profile, setProfile] = useState<ProfileTab>("account");
  return (
    <SpecimenGrid>
      <Specimen caption='Tabs variant="boxed" (count pills)'>
        <Tabs<LibTab>
          label={t("nav.library")}
          value={lib}
          onChange={setLib}
          items={[
            { value: "installed", label: t("library.tabInstalled"), count: 12 },
            { value: "favorites", label: t("library.tabFavorites"), count: 3 },
            { value: "collections", label: t("library.tabCollections"), count: 4 },
          ]}
        />
      </Specimen>
      <Specimen caption='variant="underline" (icons, one disabled)' wide>
        {/* The five profile tabs need the Profile screen's width; a narrow panel scrolls. */}
        <div className={styles.scrollX}>
          <Tabs<ProfileTab>
            variant="underline"
            label={t("nav.profile")}
            value={profile}
            onChange={setProfile}
            items={[
              { value: "account", label: t("common.tabAccount"), icon: "user" },
              {
                value: "preferences",
                label: t("profile.tabPreferences"),
                icon: "sliders-horizontal",
              },
              { value: "security", label: t("profile.tabSecurity"), icon: "shield" },
              { value: "devices", label: t("profile.tabDevices"), icon: "monitor", disabled: true },
              { value: "data", label: t("profile.tabData"), icon: "lock" },
            ]}
          />
        </div>
      </Specimen>
    </SpecimenGrid>
  );
}

export function CarouselSection() {
  const { t } = useTranslation();
  const [slide, setSlide] = useState(0);
  const [hero, setHero] = useState(1);
  const dotLabel = (count: number) => (i: number) =>
    t("common.slideOf", { index: i + 1, total: count });
  return (
    <SpecimenGrid>
      <Specimen caption="CarouselDots">
        <CarouselDots
          count={3}
          index={slide}
          onSelect={setSlide}
          label={t("app.screenshots")}
          dotLabel={dotLabel(3)}
        />
      </Specimen>
      <Specimen caption="onImage">
        <OnImage>
          <CarouselDots
            count={4}
            index={hero}
            onSelect={setHero}
            label={t("app.screenshots")}
            dotLabel={dotLabel(4)}
            onImage
          />
        </OnImage>
      </Specimen>
    </SpecimenGrid>
  );
}

export function MenusSection() {
  const { t } = useTranslation();
  const [favorite, setFavorite] = useState(false);
  const [auto, setAuto] = useState(true);
  return (
    <SpecimenGrid>
      <Specimen caption='Menu align="start" (keyboard: ↓ ↑ Home End Esc)'>
        <div className={styles.menuHost}>
          <Menu
            align="start"
            label={t("common.moreActions")}
            items={[
              {
                id: "fav",
                label: favorite ? t("common.removeFavorite") : t("common.addFavorite"),
                icon: "star",
                onSelect: () => setFavorite((f) => !f),
              },
              { id: "folder", label: t("library.openFolder"), icon: "folder", onSelect: () => {} },
              { id: "div", type: "divider" },
              {
                id: "uninstall",
                label: t("library.uninstall"),
                icon: "trash-2",
                destructive: true,
                onSelect: () => {},
              },
            ]}
            renderTrigger={(props) => (
              <IconButton {...props} icon="ellipsis" label={t("common.moreActions")} />
            )}
          />
        </div>
      </Specimen>
      <Specimen caption='Popover align="start"'>
        <div className={styles.menuHost}>
          <Popover
            label={t("updates.autoUpdates")}
            align="start"
            renderTrigger={(props) => (
              <Button {...props} size="sm" trailingIcon="chevron-down">
                {t("updates.autoUpdates")}
              </Button>
            )}
          >
            <div className={styles.popoverBody}>
              <span>{t("updates.autoUpdatesHint")}</span>
              <Toggle checked={auto} onChange={setAuto} label={t("updates.autoUpdates")} />
            </div>
          </Popover>
        </div>
      </Specimen>
    </SpecimenGrid>
  );
}
