// Facts about an app's GitHub project (`App.source`, written by the catalog bot): its age and the
// names of its "Support the author" links.
import type { IsoDate } from "@/services/types";

export type ProjectAge =
  { unit: "new" } | { unit: "months"; count: number } | { unit: "years"; count: number };

function parts(iso: IsoDate): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Whole months from `since` to `today`: under a month "new", under a year months, then years. */
export function projectAge(since: IsoDate, today: IsoDate): ProjectAge {
  const from = parts(since);
  const to = parts(today);
  if (!from || !to) return { unit: "new" };
  const months = (to[0] - from[0]) * 12 + (to[1] - from[1]) - (to[2] < from[2] ? 1 : 0);
  if (months < 1) return { unit: "new" };
  if (months < 12) return { unit: "months", count: months };
  return { unit: "years", count: Math.floor(months / 12) };
}

const FUNDING_SITES: ReadonlyArray<readonly [host: string, name: string]> = [
  ["github.com", "GitHub Sponsors"],
  ["patreon.com", "Patreon"],
  ["ko-fi.com", "Ko-fi"],
  ["opencollective.com", "Open Collective"],
  ["liberapay.com", "Liberapay"],
  ["buymeacoffee.com", "Buy Me a Coffee"],
  ["paypal.me", "PayPal"],
  ["paypal.com", "PayPal"],
  ["polar.sh", "Polar"],
  ["thanks.dev", "thanks.dev"],
];

/** A funding link's service name ("Patreon"), or its host for any other site. */
export function fundingName(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url;
  }
  return FUNDING_SITES.find(([site]) => host === site)?.[1] ?? host;
}

/** `https://github.com/<owner/name>`. */
export function repoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}
