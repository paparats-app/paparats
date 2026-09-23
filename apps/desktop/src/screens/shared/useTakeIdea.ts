import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDeveloperChannel } from "@/hooks";
import { useIdeaActions } from "@/queries";
import type { Idea } from "@/services/types";
import { useUiStore } from "@/stores/useUiStore";

/**
 * "Take" in the developer view (the board's cards and the idea page's "Take this idea"): pins the
 * idea to the channel the view acts as and toasts "Pinned to Nilesoft · author notified"
 * (prototype `takeIdea`). Resolves `false` when it was not taken (someone else took it first, or
 * the call failed); the screens then show the idea as it is (no failure copy).
 */
export function useTakeIdea(): (idea: Idea) => Promise<boolean> {
  const { t } = useTranslation();
  const notify = useUiStore((s) => s.notify);
  const { take } = useIdeaActions();
  const developer = useDeveloperChannel();
  const channelName = developer.channel?.name ?? developer.id;

  return useCallback(
    async (idea) => {
      try {
        await take(idea.id, developer.id);
      } catch {
        return false;
      }
      notify(t("idea.tookIdea", { channel: channelName }));
      return true;
    },
    [take, developer.id, channelName, notify, t],
  );
}
