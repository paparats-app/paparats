// `pnpm specta:check` — the gate's bindings drift check (package.json › check, CI): regenerates
// `apps/desktop/src/bindings.ts` exactly as `pnpm specta` does (the `export-bindings` example, then
// Prettier) and fails when the result differs from the file that was there. Needs no git, so it
// also works on a working copy with uncommitted changes. On drift the regenerated file is left in
// place: review it and commit it.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bindings = join(root, "apps", "desktop", "src", "bindings.ts");

const before = readFileSync(bindings, "utf8");

// Argument vector, no shell (the exporter writes the file unformatted).
const result = spawnSync(
  "cargo",
  ["run", "--quiet", "-p", "paparats-desktop", "--example", "export-bindings"],
  { cwd: root, stdio: "inherit", shell: false },
);
if (result.error) {
  console.error(`specta:check: could not start cargo: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`specta:check: export-bindings exited with ${result.status}`);
  process.exit(1);
}

// The same options `prettier --write` would use for this file (.prettierrc.json, .editorconfig).
const options = await prettier.resolveConfig(bindings, { editorconfig: true });
const after = await prettier.format(readFileSync(bindings, "utf8"), {
  ...options,
  filepath: bindings,
});
writeFileSync(bindings, after);

if (after !== before) {
  console.error(
    "specta:check: apps/desktop/src/bindings.ts is out of date with the Rust commands and events.\n" +
      "It has been regenerated; review the change and commit it (or run `pnpm specta`).",
  );
  process.exit(1);
}
console.log("specta:check: apps/desktop/src/bindings.ts is up to date");
