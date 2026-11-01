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

/** The project's own pages on GitHub (D68): no Paparats website or domain exists. */
const REPO = "https://github.com/paparats-app/paparats";

/** Website, Documentation, Get support, Report an issue — opened in the default browser. */
export const ABOUT_LINKS: ReadonlyArray<{
  id: "website" | "docs" | "support" | "report";
  url: string;
}> = [
  { id: "website", url: REPO },
  { id: "docs", url: `${REPO}#readme` },
  { id: "support", url: `${REPO}/discussions` },
  { id: "report", url: `${REPO}/issues` },
];

/** Footer: Privacy Policy and the License (Paparats has no terms of service to show). */
export const LEGAL_LINKS: ReadonlyArray<{
  id: "terms" | "privacyPolicy" | "licenses";
  url: string;
}> = [
  { id: "privacyPolicy", url: `${REPO}/blob/main/PRIVACY.md` },
  { id: "licenses", url: `${REPO}/blob/main/LICENSE` },
];
