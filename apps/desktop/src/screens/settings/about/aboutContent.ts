// Settings › About content: the principles row and the external addresses. Copy lives in i18n
// (`about.principles.<id>`, `about.<linkId>`).
import type { IconName } from "@/components/Icon";

/** The four principles (prototype data `principles`: heart, shield, users, leaf). */
export const PRINCIPLES: ReadonlyArray<{ id: "p1" | "p2" | "p3" | "p4"; icon: IconName }> = [
  { id: "p1", icon: "heart" },
  { id: "p2", icon: "shield" },
  { id: "p3", icon: "users" },
  { id: "p4", icon: "leaf" },
];

/** Website, Documentation, Get support, Report an issue — opened in the default browser. */
export const ABOUT_LINKS: ReadonlyArray<{
  id: "website" | "docs" | "support" | "report";
  url: string;
}> = [
  { id: "website", url: "https://paparats.app/" },
  { id: "docs", url: "https://paparats.app/docs" },
  { id: "support", url: "https://paparats.app/support" },
  { id: "report", url: "https://paparats.app/issues" },
];

/** Footer: Terms of Service, Privacy Policy, Licenses. */
export const LEGAL_LINKS: ReadonlyArray<{
  id: "terms" | "privacyPolicy" | "licenses";
  url: string;
}> = [
  { id: "terms", url: "https://paparats.app/terms" },
  { id: "privacyPolicy", url: "https://paparats.app/privacy" },
  { id: "licenses", url: "https://paparats.app/licenses" },
];
