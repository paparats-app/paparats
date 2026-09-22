import type { ComponentType } from "react";

/** One block of the dev gallery. Rendered once per theme panel. */
export interface DevSection {
  /** Stable id (anchor + React key). */
  id: string;
  /** Heading: the component name(s) — an identifier, not UI copy. */
  title: string;
  /** Renders every variant/state of the component(s). Holds its own demo state. */
  Component: ComponentType;
}
