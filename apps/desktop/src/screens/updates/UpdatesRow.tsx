import { useNav } from "@/app/navigation";
import { UpdateRow } from "@/components/AppListItem";
import { isBusy, manifestOf } from "@/domain/apps";
import { pickLocalized } from "@/domain/text";
import { useAppAction, useInstallState, useLocale } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useCatalog } from "@/queries";
import { toActionView, useDownloadStatus, useStoreAppView } from "@/screens/shared";
import type { App } from "@/services/types";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useUpdatesStore } from "@/stores/useUpdatesStore";

const NO_NOTES: readonly string[] = [];

/**
 * One row of the Updates list (prototype lines 484–502, `updateRows`): the version step, the live
 * download line while busy or the new version once "Updated just now", the manifest size, the
 * app's action, the 3px progress bar and the expandable "What's new".
 */
export function UpdatesRow({ app }: { app: App }) {
  const format = useFormat();
  const locale = useLocale();
  const { go } = useNav();
  const view = useStoreAppView(app);
  const action = useAppAction(app);
  const { installedVersion } = useInstallState(app.id);
  const catalog = useCatalog().data;
  const justUpdated = useDownloadsStore((s) => s.justUpdated[app.id] === true);
  const expanded = useUpdatesStore((s) => s.expanded[app.id] === true);
  const toggleExpanded = useUpdatesStore((s) => s.toggleExpanded);

  const manifest = manifestOf(catalog?.updates ?? [], app.id);
  const sizeMb = manifest?.downloadMb ?? app.sizeMb;
  const done = justUpdated && action.state === "installed";
  const busy = isBusy(action.state);
  const status = useDownloadStatus(app, action.state, action.progress, sizeMb);

  let versionLine: string;
  if (status) {
    versionLine = status.text;
  } else if (done) {
    versionLine = app.version;
  } else {
    versionLine = `${installedVersion ?? ""} → ${app.version}`;
  }

  let notes = NO_NOTES;
  if (manifest) notes = pickLocalized(manifest.notes, locale);
  else if (catalog) notes = pickLocalized(catalog.genericNotes, locale);

  const open = () => go({ to: "app", appId: app.id });

  return (
    <UpdateRow
      name={app.name}
      icon={view.icon}
      channel={view.channel}
      versionLine={versionLine}
      sizeLabel={format.size(sizeMb)}
      action={toActionView(action)}
      done={done}
      progress={busy ? action.progress : undefined}
      expanded={expanded}
      onToggleExpanded={() => toggleExpanded(app.id)}
      notes={notes}
      onOpen={open}
    />
  );
}
