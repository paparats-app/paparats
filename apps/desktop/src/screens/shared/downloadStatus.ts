// What an app in the download queue says about its download: the prototype's `dlLine` and
// `dlSize` (README v2 "Downloads"). One place for the app page's status line, the Updates rows
// and the Library rows and grid cards.
import { useTranslation } from "react-i18next";
import type { AppInstallState } from "@/domain/apps";
import { useFormat, type Format } from "@/i18n/format";
import type { App } from "@/services/types";
import { useDownloadsStore } from "@/stores/useDownloadsStore";

export interface DownloadStatus {
  /** "Downloading… 43%", "Paused · 43%", "Queued" or "Installing…". */
  line: string;
  /** "12 MB of 87 MB" while downloading or paused; `null` when queued or installing. */
  size: string | null;
  /**
   * The one-line form (the prototype's `[dlLine, dlSize].join(' · ')`): "Downloading… 43% · 12 MB
   * of 87 MB", "Paused · 43% · 12 MB of 87 MB", else `line`.
   */
  text: string;
}

/** The copy a status needs, already translated (keeps this free of i18next's types). */
export interface DownloadStatusCopy {
  queued: string;
  installing: string;
  paused: string;
  downloading: string;
  /** "12 MB of 87 MB" from the formatted sizes. */
  ofSize(downloaded: string, size: string): string;
}

/** The status of a download in `state`; `null` when the app is not in the download queue. */
export function downloadStatus(
  state: AppInstallState,
  progress: number,
  sizeMb: number,
  copy: DownloadStatusCopy,
  format: Format,
): DownloadStatus | null {
  const percent = format.percent(Math.min(100, progress));
  const size = () =>
    copy.ofSize(
      format.size(Math.round((sizeMb * Math.min(100, progress)) / 100)),
      format.size(sizeMb),
    );
  switch (state) {
    case "queued":
      return { line: copy.queued, size: null, text: copy.queued };
    case "installing":
      return { line: copy.installing, size: null, text: copy.installing };
    case "paused":
    case "downloading": {
      // A paused download is still "downloading" in the prototype, so it keeps its size too.
      const line =
        state === "paused" ? `${copy.paused} · ${percent}` : `${copy.downloading}… ${percent}`;
      const received = size();
      return { line, size: received, text: `${line} · ${received}` };
    }
    default:
      return null;
  }
}

/**
 * `downloadStatus` for `app` in the current language. The size is the queued item's (an update
 * downloads its manifest's size), else `fallbackMb` (default: the full install size).
 */
export function useDownloadStatus(
  app: App,
  state: AppInstallState,
  progress: number,
  fallbackMb: number = app.sizeMb,
): DownloadStatus | null {
  const { t } = useTranslation();
  const format = useFormat();
  const sizeMb = useDownloadsStore((s) => s.items[app.id]?.sizeMb) ?? fallbackMb;
  return downloadStatus(
    state,
    progress,
    sizeMb,
    {
      queued: t("common.queued"),
      installing: t("common.installingNow"),
      paused: t("common.paused"),
      downloading: t("common.downloading"),
      ofSize: (downloaded, size) => t("common.ofSize", { downloaded, size }),
    },
    format,
  );
}
