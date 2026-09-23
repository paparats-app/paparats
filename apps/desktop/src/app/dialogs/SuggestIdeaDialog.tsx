import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { Button } from "@/components/Button";
import { Modal, ModalIcon } from "@/components/Modal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import { Field, TextField } from "@/components/TextField";
import { TextArea } from "@/components/TextArea";
import { useAppIndex, useLocale, useVisibleApps } from "@/hooks";
import { useCatalog, useIdeaActions } from "@/queries";
import { isServiceError } from "@/services/errors";
import { IDEA_TITLE_MIN_CHARS } from "@/services/types";
import type { AppId, CategoryId, IdeaKind } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import styles from "./SuggestIdeaDialog.module.css";

/** A new-app idea starts in Utilities (the prototype's default). */
const DEFAULT_CATEGORY: CategoryId = "utilities";
const TITLE_MAX_LENGTH = 80;

export interface SuggestIdeaDialogProps {
  /** Opened from an app page ("Suggest an improvement"): Improve an app, with this app picked. */
  appId?: AppId;
}

/**
 * "Suggest an idea" (prototype lines 1417–1469, logic `openIdeaDialog` / `publishIdea`): New app
 * (with a category) or Improve an app (with the app, visible apps A–Z), title of at least six
 * characters, description. Publish proposes the idea, opens its page and toasts.
 */
export function SuggestIdeaDialog({ appId }: SuggestIdeaDialogProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { go } = useNav();
  const close = useDialogStore((s) => s.close);
  const notify = useUiStore((s) => s.notify);
  const { propose } = useIdeaActions();
  const catalog = useCatalog().data;
  const visible = useVisibleApps();
  const appIndex = useAppIndex();
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<IdeaKind>(appId ? "app" : "new");
  const [pickedApp, setPickedApp] = useState<AppId | null>(null);
  const [category, setCategory] = useState<CategoryId>(DEFAULT_CATEGORY);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Visible apps A–Z; an app page's app is offered even when its channel is not followed.
  const appOptions = useMemo(() => {
    const given = appIndex.get(appId);
    const apps = given && !visible.some((a) => a.id === given.id) ? [...visible, given] : visible;
    const collator = new Intl.Collator(locale);
    return [...apps]
      .sort((a, b) => collator.compare(a.name, b.name))
      .map((a) => ({ value: a.id, label: a.name }));
  }, [appId, appIndex, locale, visible]);
  // Without an app page, the first visible app in catalog order (Obsidian), as the prototype.
  const defaultApp =
    catalog?.apps.find((a) => appOptions.some((o) => o.value === a.id))?.id ??
    appOptions[0]?.value ??
    "";
  const selectedApp = pickedApp ?? appId ?? defaultApp;

  const categoryOptions = (catalog?.categories ?? []).map((c) => ({
    value: c.id,
    label: t(`categories.items.${c.id}.label`),
  }));

  // Any edit clears the title error (the prototype's `setIdeaField`).
  const edit =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setError(false);
    };

  const publish = async (event?: FormEvent) => {
    event?.preventDefault();
    if (publishing) return;
    const trimmed = title.trim();
    if (trimmed.length < IDEA_TITLE_MIN_CHARS) {
      setError(true);
      titleRef.current?.focus();
      return;
    }
    setPublishing(true);
    try {
      const idea = await propose({
        kind,
        appId: kind === "app" ? selectedApp : null,
        category: kind === "new" ? category : null,
        title: trimmed,
        body: body.trim(),
      });
      close();
      go({ to: "idea", ideaId: idea.id });
      notify(t("ideas.ideaPublished"));
    } catch (cause) {
      // Nothing was published: keep the dialog and what was typed.
      setPublishing(false);
      if (isServiceError(cause) && cause.kind === "invalid") setError(true);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      width={560}
      layout="form"
      icon={<ModalIcon name="lightbulb" />}
      title={t("ideas.suggestIdea")}
      closeLabel={t("common.close")}
      initialFocusRef={titleRef}
      footerNote={t("ideas.ideaFooter")}
      footer={
        <div className={styles.actions}>
          <Button onClick={close}>{t("common.cancel")}</Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            className={styles.publish}
            loading={publishing}
          >
            {t("ideas.publish")}
          </Button>
        </div>
      }
    >
      <form id={formId} className={styles.form} noValidate onSubmit={(e) => void publish(e)}>
        <SegmentedControl
          size="md"
          fullWidth
          label={t("ideas.ideaKind")}
          value={kind}
          onChange={edit(setKind)}
          options={[
            { value: "new", label: t("ideas.ideaNew") },
            { value: "app", label: t("ideas.ideaImprove") },
          ]}
        />
        {kind === "app" ? (
          <Field label={t("ideas.whichApp")} className={styles.field}>
            {(control) => (
              <Select
                {...control}
                size="lg"
                ground="input"
                fullWidth
                value={selectedApp}
                onChange={edit(setPickedApp)}
                options={appOptions}
              />
            )}
          </Field>
        ) : (
          <Field label={t("common.category")} className={styles.field}>
            {(control) => (
              <Select
                {...control}
                size="lg"
                ground="input"
                fullWidth
                value={category}
                onChange={edit(setCategory)}
                options={categoryOptions}
              />
            )}
          </Field>
        )}
        <TextField
          ref={titleRef}
          size="lg"
          label={t("ideas.ideaTitle")}
          placeholder={t("ideas.ideaTitlePlaceholder")}
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          onChange={(e) => edit(setTitle)(e.target.value)}
          error={error ? t("ideas.ideaTitleShort") : undefined}
          fieldClassName={styles.field}
        />
        <TextArea
          label={t("ideas.ideaBody")}
          placeholder={t("ideas.ideaBodyPlaceholder")}
          rows={5}
          value={body}
          onChange={(e) => edit(setBody)(e.target.value)}
          fieldClassName={styles.field}
        />
      </form>
    </Modal>
  );
}
