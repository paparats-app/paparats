import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Modal, ModalIcon } from "@/components/Modal";
import { TextArea } from "@/components/TextArea";
import { useAppIndex, useChannelContext } from "@/hooks";
import { useChannelActions } from "@/queries";
import type { ReportTarget } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import styles from "./ReportDialog.module.css";

export interface ReportDialogProps {
  /** The app (or only the channel) the problem is about, and the channel that routes it. */
  target: ReportTarget;
}

/**
 * "Report a problem with <App or Channel>" (prototype lines 1404–1416, logic `openReport` /
 * `sendReport`): the report goes to the channel author with a copy to Paparats, or to the
 * Paparats team for the official catalog. Send is always enabled, as in the prototype: a blank
 * report is sent too (the text is trimmed).
 */
export function ReportDialog({ target }: ReportDialogProps) {
  const { t } = useTranslation();
  const close = useDialogStore((s) => s.close);
  const notify = useUiStore((s) => s.notify);
  const { report } = useChannelActions();
  const app = useAppIndex().get(target.appId);
  const channel = useChannelContext().byId[target.channelId];
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const name = app?.name ?? channel?.name ?? "";
  const route =
    !channel || channel.trust === "official"
      ? t("report.reportRouteOfficial")
      : t("report.reportRoute", { author: channel.author, channel: channel.name });

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      const receipt = await report(target, text.trim());
      close();
      notify(
        receipt.kind === "author"
          ? t("report.reportSent", { channel: receipt.channelName })
          : t("report.reportSentOfficial"),
      );
    } catch {
      // Nothing was sent: keep the dialog and the text so the user can try again.
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      width={460}
      icon={<ModalIcon name="flag" tone="neutral" />}
      title={t("report.reportTitle", { name })}
      footer={
        <>
          <Button onClick={close}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            className={styles.send}
            loading={sending}
            onClick={() => void send()}
          >
            {t("report.send")}
          </Button>
        </>
      }
    >
      <p>{route}</p>
      <TextArea
        aria-label={t("report.reportPlaceholder")}
        placeholder={t("report.reportPlaceholder")}
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        fieldClassName={styles.field}
      />
    </Modal>
  );
}
