import { ButtonsSection } from "./ButtonsSection";
import { COMPOSITE_SECTIONS } from "./composites";
import { EmptyStatesSection, NoticesSection, ProgressSection } from "./FeedbackSection";
import { ChoiceSection, TextInputsSection, TogglesSection } from "./FormSection";
import { AppIconSection, IconsSection } from "./IconsSection";
import { CarouselSection, MenusSection, TabsSection } from "./NavigationSection";
import { ModalSection } from "./OverlaysSection";
import { PillsSection } from "./PillsSection";
import { CardsSection, SectionHeadersSection, StatsSection } from "./SurfacesSection";
import type { DevSection } from "./types";

export type { DevSection } from "./types";
export { GallerySection, OnImage, Specimen, SpecimenGrid, Stack } from "./Gallery";

/** The UI primitives (`components/*`), in gallery order. */
export const PRIMITIVE_SECTIONS: readonly DevSection[] = [
  { id: "icon", title: "Icon", Component: IconsSection },
  { id: "app-icon", title: "AppIcon", Component: AppIconSection },
  { id: "button", title: "Button · IconButton · SplitButton", Component: ButtonsSection },
  { id: "toggles", title: "Toggle · Checkbox · RadioGroup", Component: TogglesSection },
  { id: "choice", title: "SegmentedControl · Select", Component: ChoiceSection },
  { id: "text", title: "TextField · TextArea · SearchBox", Component: TextInputsSection },
  {
    id: "pills",
    title: "CountPill · Chip · ProPill · ActivePill · StatusPill · TrustBadge",
    Component: PillsSection,
  },
  { id: "tabs", title: "Tabs", Component: TabsSection },
  { id: "carousel", title: "CarouselDots", Component: CarouselSection },
  { id: "menus", title: "Menu · Popover", Component: MenusSection },
  { id: "modal", title: "Modal", Component: ModalSection },
  { id: "progress", title: "ProgressBar · Skeleton", Component: ProgressSection },
  { id: "notices", title: "Toast · WarnCallout", Component: NoticesSection },
  { id: "empty", title: "EmptyState", Component: EmptyStatesSection },
  { id: "cards", title: "Card", Component: CardsSection },
  { id: "stats", title: "StatTile", Component: StatsSection },
  { id: "section-header", title: "SectionHeader", Component: SectionHeadersSection },
];

/**
 * Everything the dev gallery shows. Composite components (AppCard, AppListItem, …) get their
 * own `sections/<Name>Section.tsx` and are appended here.
 */
export const DEV_SECTIONS: readonly DevSection[] = [...PRIMITIVE_SECTIONS, ...COMPOSITE_SECTIONS];
