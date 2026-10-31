#!/usr/bin/env node
// Writes the release files next to the NSIS installer the release job built:
//   latest.json  — the updater manifest Tauri reads from releases/latest/download/latest.json
//   SHA256SUMS   — hashes of the installer, its .sig and latest.json
//
// node scripts/release-manifest.mjs --version 1.2.3 --repo paparats-app/paparats \
//   --notes docs/releases/v1.2.3.md --out <dir>
//
// The installer and its minisign signature (createUpdaterArtifacts) are taken from
// target/release/bundle/nsis/. The updater downloads the installer itself from the release.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (pairs, arg, i, all) =>
        arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs,
      [],
    ),
);
for (const key of ["version", "repo", "out"]) {
  if (!args[key]) throw new Error(`--${key} is required`);
}
const { version, repo, out } = args;
const tag = `v${version}`;
const bundle = join(root, "target/release/bundle/nsis");
const installer = readdirSync(bundle).find((f) => f.endsWith(`_${version}_x64-setup.exe`));
if (!installer) throw new Error(`no ${version} installer in ${bundle}`);
const sigPath = join(bundle, `${installer}.sig`);
if (!existsSync(sigPath)) {
  throw new Error(
    `${installer}.sig is missing: build with TAURI_SIGNING_PRIVATE_KEY and the updater config`,
  );
}

// Notes: the release notes file without its heading (the updater shows them as "What's new").
let notes = `Paparats ${version}`;
if (args.notes && existsSync(args.notes)) {
  const text = readFileSync(args.notes, "utf8").replace(/\r\n/g, "\n");
  notes = text.replace(/^#.*\n+/, "").trim();
}

mkdirSync(out, { recursive: true });
// GitHub stores release assets under their file names with spaces turned into dots; keep the
// Tauri name, which has none.
copyFileSync(join(bundle, installer), join(out, installer));
copyFileSync(sigPath, join(out, `${installer}.sig`));

const latest = {
  version,
  notes,
  pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(sigPath, "utf8").trim(),
      url: `https://github.com/${repo}/releases/download/${tag}/${installer}`,
    },
  },
};
writeFileSync(join(out, "latest.json"), JSON.stringify(latest, null, 2) + "\n");

const sums = [installer, `${installer}.sig`, "latest.json"]
  .map(
    (name) =>
      `${createHash("sha256")
        .update(readFileSync(join(out, name)))
        .digest("hex")}  ${name}`,
  )
  .join("\n");
writeFileSync(join(out, "SHA256SUMS"), sums + "\n");
console.log(`release files for ${tag} in ${out}:\n${sums}`);
