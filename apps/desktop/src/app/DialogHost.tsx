import { useDialogStore, type DialogState } from "@/stores/useDialogStore";
import { PlanDialog } from "./dialogs/PlanDialog";
import { ReportDialog } from "./dialogs/ReportDialog";

/**
 * Renders the open dialog (`useDialogStore`). The dialogs themselves arrive with the screens that
 * open them: the plan confirmation in M4; add channel, trust confirmation, report, suggest idea
 * and release idea in M5. Until a kind is registered here, opening it shows nothing.
 */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.dialog);
  return dialog ? renderDialog(dialog) : null;
}

function renderDialog(dialog: DialogState) {
  switch (dialog.kind) {
    case "report":
      return <ReportDialog target={dialog.target} />;
    case "plan":
      return <PlanDialog plan={dialog.plan} />;
    case "addChannel":
    case "trustConfirm":
    case "suggestIdea":
    case "releaseIdea":
      return null;
  }
}
