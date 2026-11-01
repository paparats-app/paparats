// The route table (docs/architecture.md §7): one memory router, the shell layout around every
// screen. Paths are built and parsed only by `navigation.ts`.
import { createMemoryRouter, Navigate, type RouteObject } from "react-router";
import { AppScreen } from "@/screens/app";
import { BrowseScreen } from "@/screens/browse";
import { CategoriesScreen } from "@/screens/categories";
import { ChannelScreen } from "@/screens/channel";
import { HomeScreen } from "@/screens/home";
import { IdeaScreen } from "@/screens/idea";
import { IdeasScreen } from "@/screens/ideas";
import { LibraryScreen } from "@/screens/library";
import { ProfileScreen } from "@/screens/profile";
import { SettingsScreen } from "@/screens/settings";
import { SubscriptionScreen } from "@/screens/subscription";
import { UpdatesScreen } from "@/screens/updates";
import { FeatureGate } from "./FeatureGate";
import { Layout } from "./Layout";

export const ROUTES: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: "home", element: <HomeScreen /> },
      { path: "browse", element: <BrowseScreen /> },
      { path: "categories", element: <CategoriesScreen /> },
      { path: "updates", element: <UpdatesScreen /> },
      { path: "library", element: <LibraryScreen /> },
      {
        path: "ideas",
        element: (
          <FeatureGate feature="ideas">
            <IdeasScreen />
          </FeatureGate>
        ),
      },
      {
        path: "ideas/:ideaId",
        element: (
          <FeatureGate feature="ideas">
            <IdeaScreen />
          </FeatureGate>
        ),
      },
      {
        path: "subscription",
        element: (
          <FeatureGate feature="pro">
            <SubscriptionScreen />
          </FeatureGate>
        ),
      },
      { path: "settings/:section?", element: <SettingsScreen /> },
      {
        path: "profile",
        element: (
          <FeatureGate feature="account">
            <ProfileScreen />
          </FeatureGate>
        ),
      },
      { path: "app/:appId", element: <AppScreen /> },
      {
        path: "channel/:channelId",
        element: (
          <FeatureGate feature="channels">
            <ChannelScreen />
          </FeatureGate>
        ),
      },
      // The component gallery is a developer tool: its own chunk, loaded on first visit.
      {
        path: "dev",
        lazy: async () => ({ Component: (await import("@/screens/dev")).DevScreen }),
      },
      { path: "*", element: <Navigate to="/home" replace /> },
    ],
  },
];

export function createAppRouter(initialEntries: string[] = ["/home"]) {
  return createMemoryRouter(ROUTES, { initialEntries });
}
