import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { Button } from "@/components/Button";
import { ChannelRow } from "@/components/ChannelRow";
import { Modal, ModalIcon } from "@/components/Modal";
import { SettingsCard } from "@/components/SettingsRow";
import { Field } from "@/components/TextField";
import { normaliseAddress } from "@/domain/channels";
import { useChannelContext, useChannelFollow } from "@/hooks";
import { useChannelActions } from "@/queries";
import { channelIcon, useChannelMeta } from "@/screens/shared";
import type { ChannelId, ChannelInfo } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { TrustConfirmDialog } from "./TrustConfirmDialog";
import styles from "./AddChannelDialog.module.css";

/**
 * Add channel (prototype lines 1367–1403; logic `lookupChannel`, `subscribeChannel`, lines
 * 1772–1792 and 2209–2214): the address field with Add (Enter submits) and its inline errors, then
 * the catalog of channels not followed yet. A community channel asks for the trust confirmation
 * first; this dialog hides meanwhile and comes back, address and all, when that is cancelled.
 * Subscribing toasts "Subscribed to <Channel>" and closes the dialog.
 */
export function AddChannelDialog() {
  const { t } = useTranslation();
  const close = useDialogStore((s) => s.close);
  const { go } = useNav();
  const ctx = useChannelContext();
  const { meta, ready: metaReady } = useChannelMeta();
  const { lookup } = useChannelActions();
  const follow = useChannelFollow();
  const catalogId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The community channel waiting for the trust confirmation.
  const [pending, setPending] = useState<ChannelId | null>(null);
  const busy = useRef(false);

  // Channels not followed yet, in catalog order (the prototype's `channelCatalog`).
  const catalog = ctx.channels.filter((c) => !ctx.isFollowed(c.id));

  const subscribe = async (channel: ChannelInfo) => {
    if (channel.trust === "community") {
      setPending(channel.id);
      return;
    }
    if (await follow.subscribe(channel)) close();
  };

  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await task();
    } finally {
      busy.current = false;
    }
  };

  const submit = () =>
    run(async () => {
      if (!normaliseAddress(address)) return;
      // A failed lookup says nothing (the handoff has no copy for it).
      const result = await lookup(address).catch(() => null);
      if (!result) return;
      if (result.kind === "notFound") setError(t("sources.notFoundError"));
      else if (result.kind === "alreadySubscribed") setError(t("sources.alreadySubscribed"));
      else await subscribe(result.channel);
    });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const openChannel = (channelId: ChannelId) => {
    close();
    go({ to: "channel", channelId });
  };

  // Nothing until the channels and the catalog have loaded, so the catalog never flashes
  // "You follow every channel" or "0 apps" (they are cached long before anyone opens this).
  if (!ctx.ready || !metaReady) return null;

  return (
    <>
      <Modal
        open={pending === null}
        onClose={close}
        width={560}
        layout="form"
        icon={<ModalIcon name="rss" />}
        title={t("sources.addChannel")}
        closeLabel={t("common.close")}
        initialFocusRef={inputRef}
        className={styles.dialog}
      >
        <div className={styles.content}>
          <Field label={t("sources.channelAddr")} hint={t("sources.channelAddrHint")} error={error}>
            {(control) => (
              <div className={styles.addressRow}>
                <input
                  {...control}
                  ref={inputRef}
                  type="text"
                  className={styles.input}
                  value={address}
                  placeholder={t("sources.channelAddrPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setError(null);
                  }}
                  onKeyDown={onKeyDown}
                />
                <Button
                  variant="primary"
                  size="lg"
                  className={styles.add}
                  onClick={() => void submit()}
                >
                  {t("sources.add")}
                </Button>
              </div>
            )}
          </Field>

          <div className={styles.catalogHead}>
            <div id={catalogId} className={styles.catalogTitle}>
              {t("sources.catalog")}
            </div>
            <div className={styles.catalogCount}>
              {t("sources.channelsCount", { count: catalog.length })}
            </div>
          </div>
          <div role="group" aria-labelledby={catalogId}>
            <SettingsCard className={styles.catalog}>
              {catalog.length > 0 ? (
                catalog.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    variant="catalog"
                    name={channel.name}
                    icon={channelIcon(channel)}
                    trust={channel.trust}
                    meta={meta(channel)}
                    onOpen={() => openChannel(channel.id)}
                    onSubscribe={() => void run(() => subscribe(channel))}
                  />
                ))
              ) : (
                <div className={styles.empty}>{t("sources.catalogEmpty")}</div>
              )}
            </SettingsCard>
          </div>
        </div>
      </Modal>
      {pending !== null && (
        <TrustConfirmDialog channelId={pending} onCancel={() => setPending(null)} />
      )}
    </>
  );
}
