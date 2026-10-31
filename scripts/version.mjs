#!/usr/bin/env node
// The app version lives in three files that must agree: Cargo.toml ([workspace.package]),
// apps/desktop/package.json and apps/desktop/src-tauri/tauri.conf.json.
//
//   node scripts/version.mjs            prints the version (fails if the files disagree)
//   node scripts/version.mjs check 1.2.3   fails unless all three are 1.2.3 (the release job)
//   node scripts/version.mjs set 1.2.3     writes 1.2.3 into all three; then run
//                                          `cargo update --workspace --offline` for Cargo.lock
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  cargo: join(root, "Cargo.toml"),
  pkg: join(root, "apps/desktop/package.json"),
  tauri: join(root, "apps/desktop/src-tauri/tauri.conf.json"),
};
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const CARGO_VERSION = /(\[workspace\.package\][^[]*?\nversion = ")([^"]+)(")/;

function read() {
  const cargo = readFileSync(files.cargo, "utf8").match(CARGO_VERSION)?.[2];
  const pkg = JSON.parse(readFileSync(files.pkg, "utf8")).version;
  const tauri = JSON.parse(readFileSync(files.tauri, "utf8")).version;
  return { cargo, pkg, tauri };
}

function agreed() {
  const v = read();
  const distinct = new Set(Object.values(v));
  if (distinct.size !== 1) {
    console.error(`versions disagree: ${JSON.stringify(v)}`);
    process.exit(1);
  }
  return v.cargo;
}

function replaceJsonVersion(path, version) {
  const text = readFileSync(path, "utf8");
  const next = text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
  if (next === text && !text.includes(`"version": "${version}"`)) {
    throw new Error(`no "version" field in ${path}`);
  }
  writeFileSync(path, next);
}

const [command, version] = process.argv.slice(2);
if (!command) {
  console.log(agreed());
} else if (command === "check") {
  if (!SEMVER.test(version ?? "")) throw new Error(`not a version: ${version}`);
  const current = agreed();
  if (current !== version) {
    console.error(`the files say ${current}, the release is ${version}`);
    process.exit(1);
  }
  console.log(`version ${version} ok`);
} else if (command === "set") {
  if (!SEMVER.test(version ?? "")) throw new Error(`not a version: ${version}`);
  const cargo = readFileSync(files.cargo, "utf8");
  if (!CARGO_VERSION.test(cargo)) throw new Error("no [workspace.package] version in Cargo.toml");
  writeFileSync(files.cargo, cargo.replace(CARGO_VERSION, `$1${version}$3`));
  replaceJsonVersion(files.pkg, version);
  replaceJsonVersion(files.tauri, version);
  console.log(`set ${version}: ${Object.values(files).join(", ")}`);
} else {
  console.error("usage: node scripts/version.mjs [check <version> | set <version>]");
  process.exit(2);
}
