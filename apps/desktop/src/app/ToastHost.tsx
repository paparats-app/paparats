import { Toast } from "@/components/Toast";
import { useUiStore } from "@/stores/useUiStore";

/** The one toast on screen (`useUiStore.notify`, 2.8 s). Keyed by id so a new toast re-enters. */
export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  return toast ? <Toast key={toast.id} message={toast.message} /> : null;
}
