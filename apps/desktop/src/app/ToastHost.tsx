import { Toast } from "@/components/Toast";
import { useUiStore } from "@/stores/useUiStore";

/**
 * The one toast on screen (`useUiStore.notify`, 2.8 s). Keyed by id so a new toast re-enters.
 * The polite live region stays mounted while toasts come and go — a region inserted together
 * with its text is not reliably announced — and the floating toast inside it is fixed to the
 * content column, so the empty region takes no room.
 */
export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {toast && <Toast key={toast.id} message={toast.message} live={false} />}
    </div>
  );
}
