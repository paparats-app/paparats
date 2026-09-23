// Profile screen state: the open tab and the header's edit mode with its draft. Kept across
// navigation like the prototype's `profileTab`, `editing` and `draft` (one component state).
import { create } from "zustand";
import type { ProfilePatch } from "@/services/types";

export type ProfileTab = "account" | "preferences" | "security" | "devices" | "data";

export const PROFILE_TABS: readonly ProfileTab[] = [
  "account",
  "preferences",
  "security",
  "devices",
  "data",
];

export interface ProfileState {
  tab: ProfileTab;
  editing: boolean;
  /** The Name / Email being edited; `null` outside edit mode. */
  draft: ProfilePatch | null;
  /**
   * The last click that can switch the header's mode came from the keyboard: after the switch,
   * focus follows (Name field / "Edit profile"), since the pressed button is gone.
   */
  byKeyboard: boolean;
  noteActivation(byKeyboard: boolean): void;
  setTab(tab: ProfileTab): void;
  /** Enters edit mode with a copy of the saved profile (the prototype's `startEdit`). */
  startEdit(profile: ProfilePatch): void;
  setDraft(draft: ProfilePatch): void;
  /** Leaves edit mode and drops the draft (Cancel, and after a successful Save). */
  endEdit(): void;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  tab: "account",
  editing: false,
  draft: null,
  byKeyboard: false,

  noteActivation(byKeyboard) {
    if (get().byKeyboard !== byKeyboard) set({ byKeyboard });
  },
  setTab(tab) {
    set({ tab });
  },
  startEdit(profile) {
    set({ editing: true, draft: { name: profile.name, email: profile.email } });
  },
  setDraft(draft) {
    set({ draft });
  },
  endEdit() {
    set({ editing: false, draft: null });
  },
}));
