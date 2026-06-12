#!/usr/bin/env node
/**
 * `scolta-build` CLI — build the Pagefind index from a Next site.
 *
 * Usage:
 *   npx scolta-build            # fresh build
 *   npx scolta-build --force    # ignore the token cache, re-tokenize all
 *   npx scolta-build --resume   # resume an interrupted build
 *   npx scolta-build --restart  # discard transient state and start over
 *   npx scolta-build assets     # copy vendored runtime assets into public/
 *
 * Config resolution: a `scolta.config.{mjs,js}` in the cwd (default export) is
 * merged under environment variables, mirroring how Laravel reads config + .env.
 * Callable from a `postbuild` script.
 */

import { realpathSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { NextScoltaConfig, type NextScoltaConfigInit } from "./config.js";
import { buildIndex } from "./build.js";
import { copyAssets } from "./assets.js";

async function loadConfigObject(cwd: string): Promise<NextScoltaConfigInit> {
  for (const name of ["scolta.config.mjs", "scolta.config.js"]) {
    const p = path.join(cwd, name);
    try {
      const mod: unknown = await import(pathToFileURL(p).href);
      const m = mod as { default?: unknown; config?: unknown };
      const obj = m.default ?? m.config ?? mod;
      if (obj && typeof obj === "object") return obj as NextScoltaConfigInit;
    } catch {
      // Not present / not importable — fall through to env-only.
    }
  }
  return {};
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const cwd = process.cwd();
  const config = NextScoltaConfig.fromEnv(await loadConfigObject(cwd));

  if (argv[0] === "assets") {
    const publicDir = path.join(cwd, config.outputDir);
    const n = copyAssets(import.meta.url, publicDir, config.assetsPublicPath);
    console.log(`[scolta] Copied ${n} runtime assets into ${path.join(publicDir, config.assetsPublicPath)}`);
    return 0;
  }

  const mode = argv.includes("--resume") ? "resume" : argv.includes("--restart") ? "restart" : "fresh";
  const force = argv.includes("--force");

  const report = await buildIndex(config, { mode, force, logger: console });
  if (report.success) {
    console.log(`[scolta] ${report.toBuildResult().message}`);
    return 0;
  }
  console.error(`[scolta] Build failed: ${report.error}`);
  return 1;
}

/** True when this module is the entry point — symlink-safe (npm `.bin` links). */
function invokedDirectly(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return import.meta.url === pathToFileURL(argv1).href;
  }
}

if (invokedDirectly()) {
  main().then((code) => process.exit(code)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
