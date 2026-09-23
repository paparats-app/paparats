import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TRUST_KEY } from "@/components/TrustBadge";
import { WarnCallout } from "@/components/WarnCallout";
import { useFormat } from "@/i18n/format";
import type { ChannelInfo } from "@/services/types";
import { HOST_KEY, KIND_KEY } from "@/screens/shared";
import styles from "./ChannelDetails.module.css";

export interface ChannelDetailsProps {
  channel: ChannelInfo;
  subscribed: boolean;
  /** Days the followed channel has been unreachable (0 = answering or not followed). */
  downDays: number;
}

/**
 * The header's right column (prototype lines 1158–1162, rows from `ch.details`): Trust, Type,
 * Author, Address, Files, Review (not for the official catalog), Support, Last sync; community
 * channels add the warning box.
 */
export function ChannelDetails({ channel, subscribed, downDays }: ChannelDetailsProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const headingId = useId();

  let lastSync: string = t("sources.neverSynced");
  if (downDays > 0 && channel.outage) lastSync = format.relative(channel.outage);
  else if (subscribed && channel.synced) lastSync = format.relative(channel.synced);

  const rows: [key: string, label: string, value: string][] = [
    ["trust", t("sources.trust"), t(TRUST_KEY[channel.trust])],
    ["type", t("sources.type"), t(KIND_KEY[channel.kind])],
    ["author", t("sources.author"), channel.author],
    ["address", t("sources.address"), channel.addr],
    ["files", t("sources.hostLabel"), t(HOST_KEY[channel.files])],
  ];
  if (channel.trust !== "official") {
    rows.push([
      "review",
      t("sources.reviewedLabel"),
      channel.reviewed
        ? t("sources.reviewedBy", { date: format.date(channel.reviewed) })
        : t("sources.notReviewed"),
    ]);
  }
  rows.push(
    ["support", t("sources.supportLabel"), channel.support || t("channel.notProvided")],
    ["lastSync", t("sources.lastSync"), lastSync],
  );

  return (
    <aside className={styles.card} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        {t("common.details")}
      </h2>
      <dl className={styles.list}>
        {rows.map(([key, label, value]) => (
          <div key={key} className={styles.row} data-row={key}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
      {channel.trust === "community" && (
        <WarnCallout className={styles.community}>{t("common.trustCommunityHint")}</WarnCallout>
      )}
    </aside>
  );
}
