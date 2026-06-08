/**
 * Copy the vendored scolta runtime assets (css/js/wasm/pagefind) from the
 * installed `scolta` package into the Next `public/` tree so they serve
 * statically. Used by the `scolta-build assets` CLI subcommand and the
 * postinstall setup step.
 */

import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";

/** Resolve the installed `scolta` package's `assets` directory. */
export function resolveScoltaAssetsDir(fromUrl: string): string {
  const require = createRequire(fromUrl);
  const pkgJson = require.resolve("scolta/package.json");
  return path.join(path.dirname(pkgJson), "assets");
}

/** Recursively copy `src` into `dest`. */
function copyDir(src: string, dest: string): number {
  let count = 0;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
      count += 1;
    }
  }
  return count;
}

/**
 * Copy `scolta/assets/*` into `{publicDir}{assetsPublicPath}` (e.g.
 * `public/scolta`). Returns the number of files copied.
 */
export function copyAssets(fromUrl: string, publicDir: string, assetsPublicPath: string): number {
  const assetsDir = resolveScoltaAssetsDir(fromUrl);
  const dest = path.join(publicDir, assetsPublicPath.replace(/^\//, ""));
  return copyDir(assetsDir, dest);
}
