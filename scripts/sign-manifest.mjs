// Signs a JSON file into a manifest envelope — `{ payload, signature, keyId }` — the format the
// remote catalog verifies (crates/paparats-catalog, M7). Runs the crate's `sign-manifest` binary
// through cargo; every argument is passed through unchanged, as an argument vector (no shell).
//
//   $env:PAPARATS_SIGNING_KEY = (node scripts/sign-manifest.mjs --generate-key)
//   node scripts/sign-manifest.mjs --public-key            # "<keyId>:<base64>" to pin
//   node scripts/sign-manifest.mjs catalog.json --out catalog.signed.json
//   node scripts/sign-manifest.mjs channel.json --self-signed | --unsigned   # community
//
// The key is read from PAPARATS_SIGNING_KEY (32-byte seed, hex or base64), never from an
// argument; PAPARATS_SIGNING_KEY_ID names it (default: the public key's fingerprint).
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  "cargo",
  [
    "run",
    "--quiet",
    "--manifest-path",
    join(root, "Cargo.toml"),
    "--package",
    "paparats-catalog",
    "--bin",
    "sign-manifest",
    "--",
    ...process.argv.slice(2),
  ],
  // The caller's working directory, so relative file arguments mean what they say.
  { stdio: "inherit" },
);
if (result.error) {
  console.error(`sign-manifest: cannot run cargo: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
