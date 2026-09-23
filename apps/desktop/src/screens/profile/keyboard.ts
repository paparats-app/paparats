import type { MouseEvent } from "react";
import { useProfileStore } from "@/stores/useProfileStore";

/** Records how a click was made: keyboard activation (Enter / Space) fires it with `detail` 0. */
export function noteKeyboard(event: MouseEvent): void {
  useProfileStore.getState().noteActivation(event.detail === 0);
}
