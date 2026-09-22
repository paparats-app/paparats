// Ports the prototype's content (design_handoff_paparats_store/paparats-proto-data.js) into the
// mock data set under fixtures/*.json, in the wire format of the paparats-core types
// (camelCase, see crates/paparats-core/src/model). UI copy (`strings`, settings schema, category
// labels, plan copy, benefits, principles) goes to the i18n catalogs instead, not here.
//
//   node scripts/port-fixtures.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const D = await import(
  pathToFileURL(join(root, "design_handoff_paparats_store/paparats-proto-data.js")).href
);

// Prototype icon names → lucide-react kebab-case names.
const ICON = {
  grid: "layout-grid",
  gamepad: "gamepad-2",
  graduation: "graduation-cap",
  sliders: "sliders-horizontal",
};
const icon = (n) => ICON[n] ?? n;
// Optional fields are always present on the wire (`null` when absent): the Rust types serialise
// `Option<T>` as `T | null`, and the fixtures mirror that exactly.
const nulls = (o) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === undefined ? null : v]));

const catalog = {
  apps: D.apps.map((a) =>
    nulls({
      id: a.id,
      name: a.name,
      publisher: a.publisher,
      category: a.cat,
      tint: a.tint,
      mono: a.mono,
      version: a.version,
      sizeMb: a.sizeMB,
      updated: a.updated,
      license: a.license,
      portable: a.portable,
      pro: a.pro,
      proNote: a.proNote,
      tagline: a.tagline,
      long: a.long,
      channel: a.channel,
      alsoIn: a.alsoIn ?? [],
      iconUrl: null,
    }),
  ),
  categories: D.categories.map((c) => ({
    id: c.id,
    catalogCount: c.catalog,
    icon: icon(c.icon),
    hue: c.hue,
  })),
  collections: D.collections.map((c) => ({
    id: c.id,
    icon: icon(c.icon),
    title: c.title,
    sub: c.sub,
    apps: c.apps,
  })),
  heroSlides: D.heroSlides.map((s) => ({
    kicker: s.kicker,
    title1: s.title1,
    title2: s.title2,
    body: s.body,
    cta: s.cta,
    quote: s.quote,
    target: s.go ?? "browse",
  })),
  browseHeroes: D.browseHeroes.map((h) => ({
    appId: h.appId,
    title1: h.title1,
    title2: h.title2,
    body: h.body,
    note: h.note,
  })),
  featured: D.featured,
  notable: D.notable,
  proApps: D.proApps,
  updates: Object.entries(D.updateInfo).map(([appId, u]) => ({
    appId,
    downloadMb: u.mb,
    notes: u.notes,
  })),
  genericNotes: D.genericNotes,
  reviewPool: D.reviewPool,
};

const channels = {
  channels: D.channels.map((c) =>
    nulls({
      id: c.id,
      name: c.name,
      kind: c.kind,
      trust: c.trust,
      author: c.author,
      addr: c.addr,
      handle: c.handle,
      tint: c.tint,
      mono: c.mono,
      subscribers: c.subscribers,
      synced: c.synced,
      files: c.files,
      support: c.support,
      desc: c.desc,
      reviewed: c.reviewed,
      outage: c.outage,
    }),
  ),
  subscriptions: D.subscribedChannels.map((channelId) => ({
    channelId,
    paused: false,
    staleAcknowledged: false,
  })),
};

const ideas = {
  ideas: D.ideas.map((i) =>
    nulls({
      id: i.id,
      kind: i.kind,
      category: i.cat,
      appId: i.appId,
      author: i.author,
      mine: !!i.mine,
      date: i.date,
      votes: i.votes,
      voted: !!i.voted,
      status: i.status,
      title: i.title,
      body: i.body,
      comments: (i.comments ?? []).map((c) =>
        nulls({ author: c.author, dev: c.dev, mine: !!c.mine, date: c.date, text: c.text }),
      ),
      dev: i.dev,
      devName: i.devName,
      takenAt: i.takenAt,
      releasedAt: i.releasedAt,
      releasedAppId: i.releasedAppId,
      releasedVersion: i.releasedVersion,
      releaseNoteDismissed: false,
    }),
  ),
};

const plusNumber = (s) => Number(String(s).replace(/[^0-9]/g, ""));
const account = {
  signedIn: true,
  profile: {
    name: D.profile.name,
    email: D.profile.email,
    since: D.profile.since,
    country: D.profile.country,
    timezone: D.profile.timezone,
  },
  devices: D.devices.map((d, i) => ({
    id: `dev-${i + 1}`,
    name: d.name,
    os: d.os,
    lastActive: d.last,
    current: d.current,
  })),
  activity: D.activity.map((a) => ({
    kind: a.type,
    appId: a.appId,
    version: a.version,
    date: a.date,
  })),
  usage: { updatesInstalled: D.stats.updatesInstalled, timeSavedHours: D.stats.timeSavedHours },
  subscription: { plan: "free", renewsOn: null, giftUntil: null },
  twoFactor: true,
};

const platform = {
  platformStats: {
    developers: plusNumber(D.stats.devs),
    apps: plusNumber(D.stats.apps),
    proMembers: plusNumber(D.stats.members),
  },
  plans: D.plans.map((p) =>
    nulls({
      id: p.id,
      amount: Number(String(p.price.en).replace(/[^0-9.]/g, "")),
      currency: "USD",
      period: { forever: "forever", perMonth: "month", perYear: "year" }[p.period],
      badge: p.badge,
      featureCount: p.features.length,
    }),
  ),
  about: { version: D.about.version, build: D.about.build },
};

const library = {
  installed: Object.entries(D.installed).map(([appId, v]) => ({
    appId,
    version: v.version,
    lastUsed: v.lastUsed,
  })),
  favorites: D.favorites,
  collections: D.libraryCollections.map((c) => ({
    id: c.id,
    icon: icon(c.icon),
    label: c.label,
    apps: c.apps,
  })),
};

// Constants of the mock world: the prototype is anchored at TODAY; the developer view acts as
// the Nilesoft channel; a released idea's author gets Pro until TODAY + 3 months.
const meta = { today: D.TODAY, developerChannel: "nilesoft", ideaBonusUntil: "2026-12-15" };

const out = join(root, "fixtures");
mkdirSync(out, { recursive: true });
const files = {
  "catalog.json": catalog,
  "channels.json": channels,
  "ideas.json": ideas,
  "account.json": account,
  "platform.json": platform,
  "library.json": library,
  "meta.json": meta,
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(out, name), JSON.stringify(data, null, 2) + "\n");
  console.log(`fixtures/${name}`);
}
