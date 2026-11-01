#!/usr/bin/env node
// Checks an update the way the client's updater does before installing it: the minisign
// signature from `latest.json` against the public key built into the installed version
// (`plugins.updater.pubkey` in its tauri.conf.json).
//
//   node scripts/verify-update.mjs --file <installer> --signature <base64 from latest.json>
//                                  --pubkey <base64 pubkey>
//
// Exits 0 when the signature and its trusted comment verify, 1 otherwise.
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  if (at < 0 || !process.argv[at + 1]) {
    console.error(`verify-update: --${name} is required`);
    process.exit(2);
  }
  return process.argv[at + 1];
}

const fromBase64 = (text) => Buffer.from(text.trim(), "base64");
const lines = (buffer) => buffer.toString("utf8").split(/\r?\n/);

// The public key: base64 of "untrusted comment: …\n<base64: 'Ed' | key id (8) | key (32)>".
const keyBytes = fromBase64(lines(fromBase64(arg("pubkey")))[1]);
const keyId = keyBytes.subarray(2, 10);
const key = createPublicKey({
  key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), keyBytes.subarray(10, 42)]),
  format: "der",
  type: "spki",
});

// The signature: base64 of four lines — untrusted comment, signature, trusted comment, global
// signature over the signature and the trusted comment.
const [, sigLine, trustedLine, globalLine] = lines(fromBase64(arg("signature")));
const sig = fromBase64(sigLine);
const algorithm = sig.subarray(0, 2).toString("latin1");
if (!sig.subarray(2, 10).equals(keyId)) {
  console.error("verify-update: signed with a different key");
  process.exit(1);
}
const file = readFileSync(arg("file"));
// "ED": the file is pre-hashed with BLAKE2b-512 (minisign's default); "Ed": the file itself.
const message = algorithm === "ED" ? createHash("blake2b512").update(file).digest() : file;
const signature = sig.subarray(10, 74);
if (!verify(null, message, key, signature)) {
  console.error("verify-update: the file's signature does not verify");
  process.exit(1);
}
const trusted = trustedLine.replace(/^trusted comment: /, "");
if (!verify(null, Buffer.concat([signature, Buffer.from(trusted)]), key, fromBase64(globalLine))) {
  console.error("verify-update: the trusted comment's signature does not verify");
  process.exit(1);
}
console.log(`verify-update: ok (key ${keyId.toString("hex")}, ${trusted})`);
