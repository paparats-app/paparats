// One-off helper: assigns every prototype string key (`strings.en.*` in
// design_handoff_paparats_store/paparats-proto-data.js) to an i18n namespace, based on which part
// of the prototype uses it. Writes apps/desktop/src/i18n/keymap.json { protoKey: "ns.key" }.
// Keys used by several screens go to `common`. Re-run only when the prototype changes.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hand = join(root, "design_handoff_paparats_store");
const D = await import(pathToFileURL(join(hand, "paparats-proto-data.js")).href);
const html = readFileSync(join(hand, "Paparats Prototype.dc.html"), "utf8").split("\n");
const dataLines = readFileSync(join(hand, "paparats-proto-data.js"), "utf8").split("\n");

// [firstLine, lastLine, namespace] — 1-based, inclusive. null = do not attribute.
const REGIONS = [
  [40, 58, null],
  [59, 151, "shell"],
  [152, 199, "search"],
  [200, 279, "home"],
  [280, 412, "browse"],
  [413, 450, "categories"],
  [451, 545, "updates"],
  [546, 673, "library"],
  [674, 746, "subscription"],
  [747, 796, "settings"],
  [797, 822, "about"],
  [823, 865, "sources"],
  [866, 966, "profile"],
  [967, 1118, "app"],
  [1119, 1183, "channel"],
  [1184, 1283, "ideas"],
  [1284, 1349, "idea"],
  [1350, 1354, "shell"],
  [1355, 1366, "subscription"],
  [1367, 1403, "sources"],
  [1404, 1416, "report"],
  [1417, 1469, "ideas"],
  [1470, 1499, "idea"],
  [1500, 1517, "sources"],
  [1518, 1625, "firstLaunch"],
  [1626, 1836, null],
  [1837, 1897, "common"],
  [1898, 1904, "search"],
  [1905, 1913, "home"],
  [1914, 1933, "browse"],
  [1934, 1937, "categories"],
  [1938, 1954, "updates"],
  [1955, 1973, "library"],
  [1974, 1986, "subscription"],
  [1987, 2003, "settings"],
  [2004, 2025, "sources"],
  [2026, 2029, "report"],
  [2030, 2039, "profile"],
  [2040, 2096, "ideas"],
  [2097, 2103, "shell"],
  [2104, 2138, "app"],
  [2139, 2157, "firstLaunch"],
  [2158, 2231, null],
];
const nsOfLine = (n) => (REGIONS.find(([a, b]) => n >= a && n <= b) ?? [0, 0, null])[2];

const keys = Object.keys(D.strings.en);
const uses = Object.fromEntries(keys.map((k) => [k, new Set()]));
const re = /\bt\.([A-Za-z0-9_]+)|\b(?:f|msg)\('([A-Za-z0-9_]+)'/g;
html.forEach((line, i) => {
  const ns = nsOfLine(i + 1);
  if (!ns) return;
  for (const m of line.matchAll(re)) {
    const k = m[1] ?? m[2];
    if (uses[k]) uses[k].add(ns);
  }
});
// Dynamic lookups in the prototype (t[p.badge], t[p.period], t[k] for about links, how1T…).
const DYNAMIC = {
  mostPopular: "subscription",
  save18: "subscription",
  perMonth: "subscription",
  perYear: "subscription",
  forever: "subscription",
  website: "about",
  docs: "about",
  support: "about",
  report: "about",
};
for (const [k, ns] of Object.entries(DYNAMIC)) if (uses[k]) uses[k].add(ns);
for (const k of keys) if (/^how\d[TB]$/.test(k)) uses[k].add("ideas");

// Fallback for keys used only in unattributed code: the namespace most used on the same line
// of the strings object (lines are grouped by screen).
const enStart = dataLines.findIndex((l) => /^\s{2}en: \{/.test(l));
const enEnd = dataLines.findIndex((l, i) => i > enStart && /^\s{2}\},?$/.test(l));
const lineOfKey = {};
for (let i = enStart; i < enEnd; i++)
  for (const m of dataLines[i].matchAll(/(?:^|[\s,{])([A-Za-z0-9_]+): /g))
    if (uses[m[1]] && !(m[1] in lineOfKey)) lineOfKey[m[1]] = i;

const assign = {};
for (const k of keys)
  if (uses[k].size === 1) assign[k] = [...uses[k]][0];
  else if (uses[k].size > 1) assign[k] = "common";
for (const k of keys) {
  if (assign[k]) continue;
  const peers = keys.filter((p) => lineOfKey[p] === lineOfKey[k] && assign[p] && uses[p].size > 0);
  const tally = {};
  for (const p of peers) tally[assign[p]] = (tally[assign[p]] ?? 0) + 1;
  assign[k] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "common";
}

// Hand corrections: navigation labels get their own namespace; generic words go to common.
const OVERRIDES = {
  home: "nav",
  browse: "nav",
  categories: "nav",
  updates: "nav",
  library: "nav",
  ideas: "nav",
  subscription: "nav",
  settings: "nav",
  profile: "nav",
  pro: "common",
  all: "common",
  save: "common",
  installed: "common",
  free: "common",
  searching: "search",
  hours: "profile",
};
Object.assign(assign, OVERRIDES);

const map = Object.fromEntries(keys.map((k) => [k, `${assign[k]}.${k}`]));
const out = join(root, "apps/desktop/src/i18n/keymap.json");
writeFileSync(out, JSON.stringify(map, null, 2) + "\n");
const byNs = {};
for (const k of keys) (byNs[assign[k]] ??= []).push(k);
for (const [ns, ks] of Object.entries(byNs).sort())
  console.log(`${ns} (${ks.length}): ${ks.join(" ")}`);

// Catalog scaffold: apps/desktop/src/i18n/locales/<lang>/<ns>.ts. Plain strings are copied;
// function-valued strings (plurals, interpolation) are left as "TODO" with the original source
// in a comment, to be converted to i18next interpolation / plural keys by hand.
// Run with --scaffold; existing files are never overwritten.
if (process.argv.includes("--scaffold")) {
  const { mkdirSync, existsSync } = await import("node:fs");
  for (const lang of ["en", "be", "ru"]) {
    const dir = join(root, "apps/desktop/src/i18n/locales", lang);
    mkdirSync(dir, { recursive: true });
    for (const [ns, ks] of Object.entries(byNs)) {
      const file = join(dir, `${ns}.ts`);
      if (existsSync(file)) {
        console.log(`skip existing ${lang}/${ns}.ts`);
        continue;
      }
      const body = ks
        .map((k) => {
          const v = D.strings[lang][k];
          if (typeof v === "function")
            return `  // TODO(i18n): ${v.toString().split("\n").join(" ")}\n  ${k}: "TODO",`;
          return `  ${k}: ${JSON.stringify(v)},`;
        })
        .join("\n");
      const text =
        lang === "en"
          ? `export const ${ns} = {\n${body}\n};\n`
          : `import type { ${ns} as En } from "../en/${ns}";\nimport type { LocaleCatalog } from "../../types";\n\nexport const ${ns}: LocaleCatalog<typeof En> = {\n${body}\n};\n`;
      writeFileSync(file, text);
    }
  }
}
