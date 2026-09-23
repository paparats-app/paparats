import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ProfileHeader, type ProfileDraft } from "@/components/ProfileHeader";
import { initials } from "@/domain/text";
import { useFormat } from "@/i18n/format";
import { useAccountActions } from "@/queries";
import type { Profile } from "@/services/types";
import { useUiStore } from "@/stores/useUiStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { noteKeyboard } from "./keyboard";

type DraftErrors = Partial<Record<keyof ProfileDraft, string>>;

/**
 * The header card (prototype lines 876–892): identity with "Edit profile", or the Name / Email
 * form. Save writes the profile through the account service and toasts "Profile saved"; Cancel
 * drops the draft. The camera badge does nothing, as in the prototype.
 */
export function ProfileHeaderCard({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { updateProfile } = useAccountActions();
  const notify = useUiStore((s) => s.notify);
  const editing = useProfileStore((s) => s.editing);
  const draft = useProfileStore((s) => s.draft);
  const startEdit = useProfileStore((s) => s.startEdit);
  const setDraft = useProfileStore((s) => s.setDraft);
  const endEdit = useProfileStore((s) => s.endEdit);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const shownMode = useRef(editing);
  const current = draft ?? { name: profile.name, email: profile.email };

  // Keyboard users keep their place: the button they pressed disappears with the mode switch, so
  // focus moves to the Name field (edit) or back to "Edit profile" (view). Mouse users get no
  // focus change, as in the prototype. Only a switch counts, not a mount with the kept mode.
  useLayoutEffect(() => {
    if (shownMode.current === editing) return;
    shownMode.current = editing;
    const { byKeyboard, noteActivation } = useProfileStore.getState();
    if (!byKeyboard) return;
    noteActivation(false);
    (editing ? nameInput.current : editButton.current)?.focus();
  }, [editing]);

  const save = async () => {
    if (saving) return;
    // The account service rejects a blank name or email (D12); say so next to the field instead
    // of sending it.
    const blank: DraftErrors = {
      ...(current.name.trim() === "" && { name: t("profile.nameRequired") }),
      ...(current.email.trim() === "" && { email: t("profile.emailRequired") }),
    };
    setErrors(blank);
    if (blank.name !== undefined || blank.email !== undefined) return;
    setSaving(true);
    try {
      await updateProfile({ name: current.name, email: current.email });
      endEdit();
      notify(t("profile.profileSaved"));
    } catch {
      // No failure copy in the handoff: the form stays open with the draft.
    } finally {
      setSaving(false);
    }
  };

  const onDraftChange = (next: ProfileDraft) => {
    setDraft(next);
    // A field's message goes as soon as that field is edited.
    setErrors((e) => ({
      ...(next.name === current.name && e.name !== undefined && { name: e.name }),
      ...(next.email === current.email && e.email !== undefined && { email: e.email }),
    }));
  };

  return (
    <div onClickCapture={(event) => noteKeyboard(event)}>
      <ProfileHeader
        name={profile.name}
        email={profile.email}
        initials={initials(profile.name)}
        memberSince={format.month(profile.since)}
        editing={editing}
        draft={current}
        onDraftChange={onDraftChange}
        onEdit={() => {
          setErrors({});
          startEdit(profile);
        }}
        onSave={() => void save()}
        onCancel={() => {
          setErrors({});
          endEdit();
        }}
        errors={errors}
        // The prototype's camera badge has no handler.
        onChangePhoto={() => undefined}
        photoLabel={t("profile.changePhoto")}
        editButtonRef={editButton}
        nameInputRef={nameInput}
      />
    </div>
  );
}
