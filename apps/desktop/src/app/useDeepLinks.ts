// `paparats://app/<id>` and `paparats://channel/<id>` (docs/decisions.md › Windows integration):
// the core parses the link, brings the window forward and hands the page over — the one that
// started the app included — and the shell navigates there like any other `go()`. Mounted once by
// the shell layout.
import { useEffect, useRef } from "react";
import { nativeShell, type DeepLinkTarget } from "@/platform/shell";
import { useDialogStore } from "@/stores/useDialogStore";
import { useFirstLaunchStore, type FirstLaunchPhase } from "@/stores/useFirstLaunchStore";
import { useNav, type NavTarget } from "./navigation";

/** Where a link goes. */
export function deepLinkNavTarget(target: DeepLinkTarget): NavTarget {
  return target.kind === "app"
    ? { to: "app", appId: target.id }
    : { to: "channel", channelId: target.id };
}

/** The first-launch scene covers the shell (until its exit starts). */
const sceneCovers = (phase: FirstLaunchPhase | null) => phase !== null && phase !== "done";

export function useDeepLinks(): void {
  const { go } = useNav();
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);

  useEffect(() => {
    const open = (target: DeepLinkTarget) => {
      // The page the link names replaces whatever was open, dialogs included.
      useDialogStore.getState().close();
      goRef.current(deepLinkNavTarget(target));
    };
    // A link that arrives while the first-launch scene plays (a fresh install opened from a link)
    // waits for the onboarding: the page opens as the scene's exit begins, after its own hand-over
    // to Home (docs/decisions.md D50). The latest link wins.
    let waiting: DeepLinkTarget | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopWatching = useFirstLaunchStore.subscribe((state, previous) => {
      if (!waiting || !sceneCovers(previous.phase) || sceneCovers(state.phase)) return;
      const target = waiting;
      waiting = null;
      timer = setTimeout(() => open(target), 0);
    });
    const stopListening = nativeShell.onDeepLink((target) => {
      if (sceneCovers(useFirstLaunchStore.getState().phase)) waiting = target;
      else open(target);
    });
    return () => {
      stopListening();
      stopWatching();
      clearTimeout(timer);
    };
  }, []);
}
