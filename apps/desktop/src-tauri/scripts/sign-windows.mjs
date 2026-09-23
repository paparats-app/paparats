// Code-signing hook for `pnpm tauri build` (tauri.conf.json › bundle.windows.signCommand): Tauri
// calls it once per binary — the app, the NSIS installer and its uninstaller — with the file path.
//
// Signs with whichever credentials the environment provides, and does nothing without any, so
// local and CI builds without secrets still produce an (unsigned) installer:
//
//   Azure Trusted Signing (trusted-signing-cli on PATH; `cargo install trusted-signing-cli`):
//     AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET   service principal
//     TRUSTED_SIGNING_ENDPOINT   e.g. https://weu.codesigning.azure.net
//     TRUSTED_SIGNING_ACCOUNT    the Trusted Signing account name
//     TRUSTED_SIGNING_PROFILE    the certificate profile name
//
//   A PFX certificate through signtool (Windows SDK):
//     WINDOWS_CERTIFICATE_PFX       path to the .pfx file
//     WINDOWS_CERTIFICATE_PASSWORD  its password
//     WINDOWS_TIMESTAMP_URL         optional, default http://timestamp.digicert.com
//     SIGNTOOL_PATH                 optional, default: the newest signtool.exe in the Windows Kits
//
//   PAPARATS_REQUIRE_SIGNING=1  fail instead of leaving the file unsigned (release pipelines).
//
// A half-configured method (some of its variables set) is an error, never a silent unsigned build.
// Tools are spawned with argument vectors, no shell; secrets are never printed.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";

const DESCRIPTION = "Paparats";
const DEFAULT_TIMESTAMP_URL = "http://timestamp.digicert.com";

const TRUSTED_SIGNING = [
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "TRUSTED_SIGNING_ENDPOINT",
  "TRUSTED_SIGNING_ACCOUNT",
  "TRUSTED_SIGNING_PROFILE",
];
const PFX = ["WINDOWS_CERTIFICATE_PFX", "WINDOWS_CERTIFICATE_PASSWORD"];

/** An environment variable, empty values (unset CI secrets) counting as absent. */
function env(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function fail(message) {
  console.error(`sign-windows: ${message}`);
  process.exit(1);
}

/** Whether a method is fully configured (false: none of its variables is set); exits on a partial set. */
function configured(method, names) {
  const present = names.filter((name) => env(name) !== undefined);
  if (present.length === 0) return false;
  if (present.length < names.length) {
    const missing = names.filter((name) => env(name) === undefined).join(", ");
    fail(`${method} is partly configured; missing ${missing}`);
  }
  return true;
}

function run(tool, args) {
  const result = spawnSync(tool, args, { stdio: "inherit", shell: false });
  if (result.error) fail(`could not start ${basename(tool)}: ${result.error.message}`);
  if (result.status !== 0) fail(`${basename(tool)} exited with ${result.status}`);
}

/** The newest x64 signtool.exe of the installed Windows SDKs. */
function findSigntool() {
  const explicit = env("SIGNTOOL_PATH");
  if (explicit) return explicit;
  const kits = join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Windows Kits",
    "10",
    "bin",
  );
  if (!existsSync(kits)) return "signtool.exe"; // hope it is on PATH
  const versions = readdirSync(kits)
    .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return (pb[i] ?? 0) - (pa[i] ?? 0);
      return 0;
    });
  for (const version of versions) {
    const candidate = join(kits, version, "x64", "signtool.exe");
    if (existsSync(candidate)) return candidate;
  }
  return "signtool.exe";
}

const file = process.argv[2];
if (!file) fail("usage: node sign-windows.mjs <file>");
if (!existsSync(file)) fail(`no such file: ${file}`);
const name = basename(file);

if (configured("Azure Trusted Signing", TRUSTED_SIGNING)) {
  console.log(`sign-windows: ${name} → Azure Trusted Signing`);
  run("trusted-signing-cli", [
    "-e",
    env("TRUSTED_SIGNING_ENDPOINT"),
    "-a",
    env("TRUSTED_SIGNING_ACCOUNT"),
    "-c",
    env("TRUSTED_SIGNING_PROFILE"),
    "-d",
    DESCRIPTION,
    file,
  ]);
} else if (configured("PFX signing", PFX)) {
  console.log(`sign-windows: ${name} → signtool (PFX)`);
  run(findSigntool(), [
    "sign",
    "/fd",
    "SHA256",
    "/td",
    "SHA256",
    "/tr",
    env("WINDOWS_TIMESTAMP_URL") ?? DEFAULT_TIMESTAMP_URL,
    "/d",
    DESCRIPTION,
    "/f",
    env("WINDOWS_CERTIFICATE_PFX"),
    "/p",
    env("WINDOWS_CERTIFICATE_PASSWORD"),
    file,
  ]);
} else if (env("PAPARATS_REQUIRE_SIGNING") === "1") {
  fail(`no signing credentials for ${name} (PAPARATS_REQUIRE_SIGNING=1)`);
} else {
  console.log(`sign-windows: no signing credentials, ${name} stays unsigned`);
}
