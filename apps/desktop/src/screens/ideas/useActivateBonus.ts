import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/i18n/format";
import { useAccountActions, useIdeaActions } from "@/queries";
import type { Idea } from "@/services/types";
import { useUiStore } from "@/stores/useUiStore";

/**
 * "Activate 3 months of Pro" (the note's button and the Your ideas rail, prototype
 * `activateBonus`): claims the thank-you, marks the release notes on screen as seen (D16) and
 * toasts "Paparats Pro is active until <date>". A second press while it runs does nothing.
 */
export function useActivateBonus(): (notes: readonly Idea[]) => Promise<void> {
  const { t } = useTranslation();
  const format = useFormat();
  const notify = useUiStore((s) => s.notify);
  const { claimIdeaBonus } = useAccountActions();
  const { dismissReleaseNote } = useIdeaActions();
  const running = useRef(false);

  return useCallback(
    async (notes) => {
      if (running.current) return;
      running.current = true;
      try {
        const account = await claimIdeaBonus();
        // The gift is active either way; a note that could not be dismissed just stays.
        await Promise.allSettled(notes.map((note) => dismissReleaseNote(note.id)));
        const until = account.subscription.giftUntil;
        if (until) notify(t("ideas.bonusActive", { date: format.date(until) }));
      } catch {
        // Nothing was activated (no failure copy in the handoff): the note and the rail stay.
      } finally {
        running.current = false;
      }
    },
    [claimIdeaBonus, dismissReleaseNote, format, notify, t],
  );
}
