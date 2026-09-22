// The one modal dialog on screen (rendered by app/DialogHost).
import { create } from "zustand";
import type { AppId, ChannelId, PlanId, ReportTarget } from "@/services/types";

export type DialogState =
  | { kind: "plan"; plan: Exclude<PlanId, "free"> }
  | { kind: "addChannel" }
  | { kind: "trustConfirm"; channelId: ChannelId }
  | { kind: "report"; target: ReportTarget }
  | { kind: "suggestIdea"; appId?: AppId }
  | { kind: "releaseIdea"; ideaId: string };

export interface DialogStoreState {
  dialog: DialogState | null;
  /** Replaces any open dialog. */
  open(dialog: DialogState): void;
  close(): void;
}

export const useDialogStore = create<DialogStoreState>()((set) => ({
  dialog: null,
  open(dialog) {
    set({ dialog });
  },
  close() {
    set({ dialog: null });
  },
}));
