import { AppCardsSection } from "./AppCardsSection";
import { AppListItemsSection } from "./AppListItemsSection";
import { ScreenshotSection, RatingsSection } from "./AppPageSection";
import { CategoriesSection } from "./CategoriesSection";
import { ChannelRowsSection, FilterPanelSection } from "./FilterChannelsSection";
import { HeroesSection } from "./HeroesSection";
import {
  CommentThreadSection,
  IdeaCardsSection,
  TimelineSection,
  VoteButtonsSection,
} from "./IdeasSection";
import { ProfileHeaderSection, SettingsRowsSection } from "./ProfileSettingsSection";
import { SubscriptionSection } from "./SubscriptionSection";
import type { DevSection } from "./types";

/** The composite components (`components/*` built from the primitives), in gallery order. */
export const COMPOSITE_SECTIONS: readonly DevSection[] = [
  { id: "app-card", title: "AppCard", Component: AppCardsSection },
  {
    id: "app-list-item",
    title:
      "AppListItem · LibraryRow · LibraryGridCard · UpdateRow · CompactUpdatedRow · NotableRow · NotableCard",
    Component: AppListItemsSection,
  },
  {
    id: "category-collection",
    title: "CategoryCard · CategoryChip · CollectionCard",
    Component: CategoriesSection,
  },
  {
    id: "heroes",
    title: "HomeHero · FeaturedHero · PageBanner · PromoCard",
    Component: HeroesSection,
  },
  {
    id: "subscription-plan",
    title: "SubscriptionPlan · BenefitStrip",
    Component: SubscriptionSection,
  },
  { id: "profile-header", title: "ProfileHeader", Component: ProfileHeaderSection },
  { id: "settings-row", title: "SettingsRow · SettingsCard", Component: SettingsRowsSection },
  { id: "filter-panel", title: "FilterPanel", Component: FilterPanelSection },
  { id: "channel-row", title: "ChannelRow", Component: ChannelRowsSection },
  { id: "vote-button", title: "VoteButton", Component: VoteButtonsSection },
  { id: "idea-card", title: "IdeaCard", Component: IdeaCardsSection },
  { id: "timeline", title: "Timeline", Component: TimelineSection },
  { id: "comment-thread", title: "CommentThread", Component: CommentThreadSection },
  { id: "screenshot-viewer", title: "ScreenshotViewer", Component: ScreenshotSection },
  { id: "ratings", title: "RatingSummary · ReviewCard", Component: RatingsSection },
];
