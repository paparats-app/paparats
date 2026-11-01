#!/usr/bin/env node
// Downloads the official catalog's signed manifests from GitHub Pages into
// `apps/desktop/src-tauri/catalog-snapshot/`. The client builds them in and seeds an empty cache
// with them, so a first start without a network still shows a verified catalog (D68). The files
// are verified by the client like anything it fetches; this script only copies bytes.
//
//   node scripts/catalog-snapshot.mjs [--base-url <url>]
//
// The release workflow runs it before building, so every release ships the latest catalog.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["channels.json", "catalog.json", "platform.json", "official.json"];
const DEFAULT_BASE = "https://paparats-app.github.io/catalog/v1/";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps", "desktop", "src-tauri", "catalog-snapshot");

const at = process.argv.indexOf("--base-url");
let base = at > 0 ? process.argv[at + 1] : DEFAULT_BASE;
if (!base.endsWith("/")) base += "/";

await mkdir(out, { recursive: true });
for (const name of FILES) {
  const response = await fetch(new URL(name, base));
  if (!response.ok) {
    console.error(`catalog-snapshot: ${name}: HTTP ${response.status}`);
    process.exit(1);
  }
  const body = Buffer.from(await response.arrayBuffer());
  const envelope = JSON.parse(body.toString("utf8"));
  if (typeof envelope.payload !== "string" || typeof envelope.signature !== "string") {
    console.error(`catalog-snapshot: ${name} is not a signed envelope`);
    process.exit(1);
  }
  await writeFile(join(out, name), body);
  console.log(`catalog-snapshot: ${name} (${body.length} bytes, key ${envelope.keyId})`);
}
