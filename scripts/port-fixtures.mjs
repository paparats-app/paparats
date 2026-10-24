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

// How the real inventory (M7, crates/paparats-inventory) recognises each app on a PC — the
// `AppDetection` rules of paparats-core. Not in the prototype. `displayNames` are compared with the
// Uninstall entry's DisplayName after trailing versions and architecture tags are stripped
// ("7-Zip 25.01 (x64)" → "7-Zip"); `publisher` (a substring of the Publisher value) guards generic
// names; `productCodes` are Uninstall key names known to be stable across releases (NSIS/Inno ids,
// Steam app keys); `msixFamilyNames` are Microsoft Store / sideloaded MSIX package families.
const DETECTION = {
  obsidian: { displayNames: ["Obsidian"] },
  sharex: {
    displayNames: ["ShareX"],
    msixFamilyNames: ["19568ShareX.ShareX_egrzcvs15399j"],
  },
  vlc: { displayNames: ["VLC media player"], productCodes: ["VLC media player"] },
  powertoys: {
    displayNameRegex: "^PowerToys(?: \\(Preview\\))?(?: (?:x64|arm64))?$",
    publisher: "Microsoft",
  },
  notepadpp: { displayNames: ["Notepad++"], productCodes: ["Notepad++"] },
  everything: {
    displayNames: ["Everything"],
    publisher: "voidtools",
    productCodes: ["Everything"],
  },
  vscode: {
    displayNameRegex: "^Microsoft Visual Studio Code(?: \\(User\\))?$",
    publisher: "Microsoft",
    // Inno Setup ids of the x64 system and user installers.
    productCodes: [
      "{EA457B21-F73E-494C-ACAB-524FDE069978}_is1",
      "{771FD6B0-FA20-440A-A002-3B3BAC16DC50}_is1",
    ],
  },
  files: {
    displayNames: ["Files"],
    publisher: "Files Community",
    msixFamilyNames: ["49306atecsolution.FilesUWP_et10x9a9vyk8t", "Files_1y0xx7n9077q4"],
  },
  flow: { displayNames: ["Flow Launcher"] },
  localsend: { displayNames: ["LocalSend"] },
  krita: { displayNames: ["Krita"] },
  rustdesk: { displayNames: ["RustDesk"] },
  sevenzip: { displayNames: ["7-Zip"], productCodes: ["7-Zip"] },
  obs: { displayNames: ["OBS Studio"], productCodes: ["OBS Studio"] },
  keepassxc: { displayNames: ["KeePassXC"] },
  audacity: { displayNames: ["Audacity"], productCodes: ["Audacity_is1"] },
  bitwarden: {
    displayNames: ["Bitwarden"],
    msixFamilyNames: ["8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy"],
  },
  inkscape: { displayNames: ["Inkscape"] },
  flux: { displayNames: ["f.lux"] },
  anki: { displayNames: ["Anki"] },
  stellarium: { displayNames: ["Stellarium"] },
  mindustry: { displayNames: ["Mindustry"], productCodes: ["Steam App 1127400"] },
  joplin: { displayNames: ["Joplin"] },
  ditto: { displayNames: ["Ditto"] },
  supertuxkart: { displayNames: ["SuperTuxKart"] },
  shell: { displayNames: ["Kvetka Shell"] },
  czkawka: { displayNames: ["Czkawka"] },
  imageglass: { displayNames: ["ImageGlass"] },
  rufus: { displayNames: ["Rufus"] },
  vitrazhtweaker: { displayNames: ["Vitrazh Tweaker"] },
  mpv: { displayNames: ["mpv"] },
  slounik: { displayNames: ["Слоўнік", "Slounik"] },
};
// Every field is on the wire, like the Rust type serialises it.
const detection = (id) => {
  const d = DETECTION[id];
  if (!d) throw new Error(`no detection rules for ${id}`);
  return {
    displayNames: d.displayNames ?? [],
    displayNameRegex: d.displayNameRegex ?? null,
    publisher: d.publisher ?? null,
    productCodes: d.productCodes ?? [],
    msixFamilyNames: d.msixFamilyNames ?? [],
  };
};

// The download manifest (`Package`) of an update in the mock world: installed by the simulated
// strategy, so no URL, hash or signer (M7 real strategies take these from signed channel
// manifests). The version is the app's catalog version; the size is the update download (MiB).
const simulatedPackage = (appId, mb) => {
  const app = D.apps.find((a) => a.id === appId);
  if (!app) throw new Error(`update for unknown app ${appId}`);
  return {
    appId,
    version: app.version,
    url: null,
    sha256: null,
    sizeBytes: Math.round(mb * 1048576),
    strategy: { kind: "simulated" },
    signer: null,
  };
};

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
      detection: detection(a.id),
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
    package: simulatedPackage(appId, u.mb),
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
// the Kvetka channel; a released idea's author gets Pro until TODAY + 3 months.
const meta = { today: D.TODAY, developerChannel: "kvetka", ideaBonusUntil: "2026-12-15" };

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
