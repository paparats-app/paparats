import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { Modal, ModalIcon } from "@/components/Modal";
import { TRUST_KEY, TrustBadge } from "@/components/TrustBadge";
import { useChannelContext, useChannelFollow } from "@/hooks";
import { useChannelMeta } from "@/screens/shared";
import type { ChannelId } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import styles from "./TrustConfirmDialog.module.css";

export interface TrustConfirmDialogProps {
  channelId: ChannelId;
  /**
   * Cancel, Escape or the backdrop. Default: close the dialog. The add-channel dialog passes its
   * own, so Cancel returns to it with the address still typed (the prototype's `cancelTrust`).
   */
  onCancel?: () => void;
}

/**
 * "Add <Channel>?" (prototype lines 1500–1517; logic `subscribeChannel` / `confirmChannel`): the
 * community channel with its trust badge and meta, the warning, Cancel and Add channel. Confirming
 * follows the channel, toasts "Subscribed to <Channel>" and closes every channel dialog.
 */
export function TrustConfirmDialog({ channelId, onCancel }: TrustConfirmDialogProps) {
  const { t } = useTranslation();
  const close = useDialogStore((s) => s.close);
  const channel = useChannelContext().byId[channelId];
  const { meta, ready } = useChannelMeta();
  const follow = useChannelFollow();
  const confirming = useRef(false);

  if (!channel || !ready) return null;
  const cancel = onCancel ?? close;

  const confirm = async () => {
    if (confirming.current) return;
    confirming.current = true;
    // A refused subscription keeps the dialog open without a toast (no failure copy).
    if (await follow.subscribe(channel)) close();
    confirming.current = false;
  };

  return (
    <Modal
      open
      onClose={cancel}
      width={460}
      icon={<ModalIcon name="triangle-alert" tone="warn" />}
      title={t("sources.confirmChannelTitle", { channel: channel.name })}
      footer={
        <>
          <Button onClick={cancel}>{t("common.cancel")}</Button>
          <Button variant="primary" className={styles.confirm} onClick={() => void confirm()}>
            {t("sources.addChannel")}
          </Button>
        </>
      }
    >
      <div className={styles.channel}>
        <AppIcon mono={channel.mono} tint={channel.tint} size={40} className={styles.tile} />
        <div className={styles.text}>
          <div className={styles.nameLine}>
            <span className={styles.name}>{channel.name}</span>
            <TrustBadge level={channel.trust} label={t(TRUST_KEY[channel.trust])} size="sm" />
          </div>
          <div className={styles.meta}>{meta(channel)}</div>
        </div>
      </div>
      <p className={styles.body}>{t("sources.confirmChannelBody")}</p>
    </Modal>
  );
}
