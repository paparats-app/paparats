import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { Modal, ModalIcon } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Field, TextField } from "@/components/TextField";
import { nextVersion } from "@/domain/ideas";
import { useAppIndex, useDeveloperChannel } from "@/hooks";
import { useAccount, useCatalog, useChannels, useIdeaActions, useIdeas } from "@/queries";
import { useIdeaView } from "@/screens/shared";
import type { AppId, Idea } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import styles from "./ReleaseIdeaDialog.module.css";

export interface ReleaseIdeaDialogProps {
  ideaId: string;
}

/**
 * "Release the idea" (prototype lines 1470–1499, logic `openRelease` / `confirmRelease` and
 * `relDlg`): the developer picks the app that implements a new-app idea (an improvement ships in
 * its own app), the version is pre-filled with the app's next patch version and recomputed when the
 * app changes, and the note names who will be notified. Release marks the idea released and toasts
 * "Released · N people notified".
 */
export function ReleaseIdeaDialog({ ideaId }: ReleaseIdeaDialogProps) {
  const ideas = useIdeas().data;
  // The prefill needs the channel's apps and the author's name: wait for them (the idea page has
  // them already, so in practice the dialog opens at once).
  const loaded = [useCatalog().data, useChannels().data, useAccount().data].every(Boolean);
  const idea = ideas?.find((i) => i.id === ideaId);
  const close = useDialogStore((s) => s.close);
  const missing = ideas !== undefined && idea === undefined;
  // Nothing to release (an unknown idea): close instead of showing empty fields.
  useEffect(() => {
    if (missing) close();
  }, [missing, close]);
  return idea && loaded ? <ReleaseForm idea={idea} /> : null;
}

function ReleaseForm({ idea }: { idea: Idea }) {
  const { t } = useTranslation();
  const close = useDialogStore((s) => s.close);
  const notify = useUiStore((s) => s.notify);
  const { release } = useIdeaActions();
  const apps = useAppIndex();
  const dev = useDeveloperChannel();
  const ideaView = useIdeaView();
  // The user's choices; until then the defaults follow the data (the prototype's `openRelease`).
  const [picked, setPicked] = useState<AppId | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);

  const fixed = idea.kind === "app";
  const appId = fixed ? (idea.appId ?? "") : (picked ?? dev.apps[0]?.id ?? "");
  const app = apps.get(appId);
  const version = typed ?? (app ? nextVersion(app.version) : "1.0.0");
  const ready = appId !== "" && version.trim() !== "";

  const pickApp = (id: AppId) => {
    setPicked(id);
    // A new app gets its own next version, as in the prototype (the typed one is dropped).
    setTyped(null);
  };

  const confirm = async () => {
    if (!ready || releasing) return;
    setReleasing(true);
    try {
      const released = await release(idea.id, appId, version.trim());
      close();
      notify(t("idea.releasedMsg", { count: released.votes }));
    } catch {
      // Not released (no failure copy in the handoff): keep the dialog so it can be sent again.
      setReleasing(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      width={480}
      icon={<ModalIcon name="circle-check" />}
      title={t("idea.releaseIdea")}
      subtitle={ideaView.title(idea)}
      footer={
        <>
          <Button onClick={close}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            className={styles.release}
            // Always the full mint button, as in the prototype; with no version (the service
            // refuses a blank one, D12) it is inert.
            aria-disabled={!ready || undefined}
            loading={releasing}
            onClick={() => void confirm()}
          >
            {t("idea.release")}
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        {fixed ? (
          <div className={styles.fixedApp}>
            {app && (
              <AppIcon
                mono={app.mono}
                tint={app.tint}
                iconUrl={app.iconUrl}
                size={36}
                className={styles.tile}
              />
            )}
            <div className={styles.appText}>
              <div className={styles.appName}>{app?.name}</div>
              {app && (
                <div className={styles.appCurrent}>{`${t("common.version")} ${app.version}`}</div>
              )}
            </div>
          </div>
        ) : (
          <Field label={t("idea.releaseApp")} className={styles.appField}>
            {(control) => (
              <Select
                {...control}
                size="lg"
                ground="input"
                fullWidth
                value={appId}
                onChange={pickApp}
                options={dev.apps.map((a) => ({ value: a.id, label: a.name }))}
              />
            )}
          </Field>
        )}
        <TextField
          label={t("idea.releaseVersion")}
          size="lg"
          value={version}
          onChange={(event) => setTyped(event.target.value)}
          fieldClassName={styles.version}
          spellCheck={false}
          autoComplete="off"
        />
        <p className={styles.note}>
          {t("ideas.releaseNote", { author: ideaView.author(idea), count: idea.votes })}
        </p>
      </div>
    </Modal>
  );
}
