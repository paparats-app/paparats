// Profile — the header card with edit mode, the underline tabs (Account, Preferences, Security,
// Devices, Data & Privacy) and the right column: Pro status, usage stats, recent activity
// (Paparats Prototype.dc.html lines 866–966; `renderVals` "// profile" 2030–2039, 2193–2197).
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { PageBanner } from "@/components/PageBanner";
import { Tabs, type TabItem } from "@/components/Tabs";
import type { IconName } from "@/components/Icon";
import { useChannelContext } from "@/hooks";
import { useAccount, useCatalog, useLibrary, usePlatform } from "@/queries";
import { PROFILE_TABS, useProfileStore, type ProfileTab } from "@/stores/useProfileStore";
import { ProfileAside } from "./ProfileAside";
import { ProfileHeaderCard } from "./ProfileHeaderCard";
import {
  AccountPanel,
  DataPanel,
  DevicesPanel,
  PreferencesPanel,
  SecurityPanel,
} from "./ProfilePanels";
import styles from "./ProfileScreen.module.css";

/** Tab icons (the prototype's `profTabs`: user, sliders, shield, monitor, lock). */
const TAB_ICONS: Record<ProfileTab, IconName> = {
  account: "user",
  preferences: "sliders-horizontal",
  security: "shield",
  devices: "monitor",
  data: "lock",
};

export function ProfileScreen() {
  const { t } = useTranslation();
  const panelId = useId();
  const account = useAccount().data;
  const catalog = useCatalog().data;
  const library = useLibrary().data;
  const platform = usePlatform().data;
  const { ready: channelsReady } = useChannelContext();
  const tab = useProfileStore((s) => s.tab);
  const setTab = useProfileStore((s) => s.setTab);

  // Rendered once the data is in (the navigation skeleton covers the wait), so no count, plan or
  // activity row changes a frame later.
  if (!account || !catalog || !library || !platform || !channelsReady) return null;

  const tabLabel: Record<ProfileTab, string> = {
    account: t("common.tabAccount"),
    preferences: t("profile.tabPreferences"),
    security: t("profile.tabSecurity"),
    devices: t("profile.tabDevices"),
    data: t("profile.tabData"),
  };
  const items: Array<TabItem<ProfileTab>> = PROFILE_TABS.map((value) => ({
    value,
    label: tabLabel[value],
    icon: TAB_ICONS[value],
  }));

  return (
    <div className={styles.screen}>
      <PageBanner
        title={t("nav.profile")}
        subtitle={t("profile.profileSub")}
        motto={t("common.mottoC")}
      />
      <div className={styles.columns}>
        <div className={styles.main}>
          <ProfileHeaderCard profile={account.profile} />
          <Tabs
            variant="underline"
            label={t("profile.sections")}
            items={items}
            value={tab}
            onChange={setTab}
            panelId={() => panelId}
            className={styles.tabs}
          />
          <div id={panelId} role="tabpanel" aria-label={tabLabel[tab]}>
            {tab === "account" && <AccountPanel profile={account.profile} />}
            {tab === "preferences" && <PreferencesPanel />}
            {tab === "security" && (
              <SecurityPanel twoFactor={account.twoFactor} devices={account.devices.length} />
            )}
            {tab === "devices" && <DevicesPanel devices={account.devices} />}
            {tab === "data" && <DataPanel />}
          </div>
        </div>
        <ProfileAside account={account} />
      </div>
    </div>
  );
}
