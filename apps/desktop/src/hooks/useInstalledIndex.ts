import { useMemo } from "react";
import { indexInstalled, type InstalledIndex } from "@/domain/apps";
import { useLibrary } from "@/queries";

const EMPTY: InstalledIndex = new Map();

/** Apps installed on this PC by id (empty while the library loads). */
export function useInstalledIndex(): InstalledIndex {
  const library = useLibrary().data;
  return useMemo(() => (library ? indexInstalled(library.installed) : EMPTY), [library]);
}
