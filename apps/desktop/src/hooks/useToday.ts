import { useServices } from "@/services";
import type { IsoDate } from "@/services/types";

/** Today's date from SystemService (the mock world is anchored at 2026-09-15). */
export function useToday(): IsoDate {
  return useServices().system.today();
}
