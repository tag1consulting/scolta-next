#!/usr/bin/env node
// Pack-content regression guard.
//
// The `files` field in package.json is itself a fail-closed publish allowlist.
// This script is the regression test that keeps it true: it derives the set of
// legitimate path prefixes FROM THIS REPO'S OWN `files` field (never a generic
// hardcoded list) and asserts that `npm pack --dry-run --json` ships nothing
// outside it. Anything extra is a dist-cruft leak and fails the build with the
// offending path printed.
//
// History: a sibling adapter (scolta-wp) once shipped a 13 MB zip, and WP.org
// flagged dist cruft repeatedly. The cap below is the same defense: measure the
// current good artifact and refuse anything wildly larger.
//
// The fix for any failure lives in package.json's `files` field (and/or
// .npmignore / the build output) — that is where the filter is enforced.

import { execFileSync } from "node:child_process";
import { readFileSync as read } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(read(join(repoRoot, "package.json"), "utf8"));

// Measured unpacked size of the current good artifact: 229689 bytes
// (~0.219 MB), `npm pack --dry-run --json` on 2026-06-14. Cap at ~2x the
// measured value so routine growth passes but a runaway (bundled fixtures,
// a stray vendored binary, the 13 MB-zip class of mistake) trips the guard.
const MAX_UNPACKED_BYTES = 460_000; // ~2x measured 229,689

// Derive the allowlist of packed-path prefixes from `files`. `files` entries
// are bare names ("dist", "README.md"): a directory entry matches that path or
// anything beneath it; a file entry matches exactly. npm ALSO always includes
// package.json regardless of `files`, so it is allowed unconditionally.
const filesField = Array.isArray(pkg.files) ? pkg.files : [];
if (filesField.length === 0) {
  console.error("[pack-guard] package.json has no `files` field; refusing to validate an implicit pack set.");
  process.exit(1);
}
const allowedPrefixes = [...filesField, "package.json"];

function isAllowed(path) {
  return allowedPrefixes.some(
    (entry) => path === entry || path.startsWith(entry + "/"),
  );
}

const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
const meta = JSON.parse(out)[0];
const packed = meta.files.map((f) => f.path);

const leaked = packed.filter((p) => !isAllowed(p));

let failed = false;

if (leaked.length > 0) {
  failed = true;
  console.error(
    `[pack-guard] ${leaked.length} packed path(s) are OUTSIDE the allowlist derived from package.json \`files\` (${JSON.stringify(filesField)}):`,
  );
  for (const p of leaked) console.error(`  LEAKED: ${p}`);
  console.error(
    "[pack-guard] Fix the filter in package.json's `files` field (or stop building these into dist/). That field is the publish allowlist.",
  );
}

if (meta.unpackedSize > MAX_UNPACKED_BYTES) {
  failed = true;
  console.error(
    `[pack-guard] unpacked size ${meta.unpackedSize} bytes exceeds cap ${MAX_UNPACKED_BYTES} bytes (~2x the measured good artifact). Something bloated the package; inspect \`npm pack --dry-run\` and trim dist/ or package.json's \`files\`.`,
  );
}

if (failed) process.exit(1);

console.log(
  `[pack-guard] OK — ${packed.length} files, unpacked ${meta.unpackedSize} bytes (cap ${MAX_UNPACKED_BYTES}). Allowlist: ${allowedPrefixes.join(", ")}`,
);
