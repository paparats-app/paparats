import type { ViewAs } from "@/domain/ideas";
import { useSettingsStore } from "@/stores/useSettingsStore";

export type { ViewAs } from "@/domain/ideas";

/** The developer view (acting as `meta.developerChannel`) needs Developer mode and the toggle. */
export function useViewAs(): ViewAs {
  return useSettingsStore((s) =>
    s.settings.dev && s.settings.viewAsDeveloper ? "developer" : "user",
  );
}
