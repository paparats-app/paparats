import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import { TextField } from "../TextField";
import styles from "./ProfileHeader.module.css";

export interface ProfileDraft {
  name: string;
  email: string;
}

export interface ProfileHeaderProps {
  name: string;
  email: string;
  initials: string;
  /** Preformatted month for "Member since {{date}}" ("September 2024"). */
  memberSince: string;
  /** Edit mode: the identity block becomes Name / Email inputs with Save / Cancel. */
  editing: boolean;
  draft: ProfileDraft;
  onDraftChange: (draft: ProfileDraft) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  /** Inline field errors (e.g. an empty name). */
  errors?: Partial<Record<keyof ProfileDraft, string>>;
  /** The 30px camera badge; accessible name via `photoLabel`. */
  onChangePhoto?: () => void;
  photoLabel?: string;
  className?: string;
}

/**
 * Profile header card (padding 24): 96px avatar with a mint camera badge, then either the
 * identity + "Edit profile" or the edit form (prototype lines 876–892).
 */
export function ProfileHeader({
  name,
  email,
  initials,
  memberSince,
  editing,
  draft,
  onDraftChange,
  onEdit,
  onSave,
  onCancel,
  errors,
  onChangePhoto,
  photoLabel,
  className,
}: ProfileHeaderProps) {
  const { t } = useTranslation();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  return (
    <section className={cx(styles.card, className)} aria-label={name}>
      <div className={styles.avatarWrap}>
        <div className={styles.avatar} aria-hidden="true">
          {initials}
        </div>
        {onChangePhoto && (
          <button
            type="button"
            className={styles.camera}
            aria-label={photoLabel}
            title={photoLabel}
            onClick={onChangePhoto}
          >
            <Icon name="camera" size={14} strokeWidth={2.2} />
          </button>
        )}
      </div>
      {editing ? (
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.fields}>
            <TextField
              label={t("profile.name")}
              value={draft.name}
              error={errors?.name}
              autoComplete="name"
              fieldClassName={styles.field}
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            />
            <TextField
              label={t("profile.email")}
              type="email"
              value={draft.email}
              error={errors?.email}
              autoComplete="email"
              fieldClassName={styles.field}
              onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
            />
          </div>
          <div className={styles.formActions}>
            <Button type="submit" variant="primary">
              {t("common.save")}
            </Button>
            <Button onClick={onCancel}>{t("common.cancel")}</Button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.identity}>
            <h2 className={styles.name}>{name}</h2>
            <div className={styles.email}>{email}</div>
            <div className={styles.since}>
              <Icon name="clock" size={15} />
              {t("profile.memberSince", { date: memberSince })}
            </div>
          </div>
          <Button size="field" leadingIcon={<Icon name="pencil" size={15} />} onClick={onEdit}>
            {t("profile.editProfile")}
          </Button>
        </>
      )}
    </section>
  );
}
