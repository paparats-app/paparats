import { useMemo } from "react";
import { downloadState, installState, type AppInstallState } from "@/domain/apps";
import type { AppId } from "@/services/types";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useAppIndex } from "./useAppIndex";
import { useInstalledIndex } from "./useInstalledIndex";

export type { AppInstallState } from "@/domain/apps";

export interface InstallStateInfo {
  state: AppInstallState;
  /** Download progress 0–100 (0 when not in the queue). */
  progress: number;
  /** Version on this PC; `null` when not installed. */
  installedVersion: string | null;
}

/** Install state of one app: the download queue first, then the library inventory. */
export function useInstallState(appId: AppId): InstallStateInfo {
  const app = useAppIndex().get(appId);
  const installed = useInstalledIndex().get(appId);
  const download = useDownloadsStore((s) => s.items[appId]);

  return useMemo(() => {
    let state: AppInstallState;
    if (download) state = downloadState(download);
    else if (app) state = installState(app, installed);
    else state = installed ? "installed" : "none";
    return {
      state,
      progress: download ? Math.min(100, download.progress) : 0,
      installedVersion: installed?.version ?? null,
    };
  }, [app, installed, download]);
}
