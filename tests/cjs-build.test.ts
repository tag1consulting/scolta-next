/**
 * CJS build smoke tests — the dual-format bundle's require()/direct-invoke
 * path.
 *
 * Without tsup's import.meta shim, every `import.meta.url` compiles to a
 * property of an EMPTY object in the CJS output: `node dist/cli.cjs assets`
 * exited 0 as a silent no-op (the direct-invoke check compared undefined to
 * the argv URL), and a programmatic main() threw from copyAssets's
 * createRequire(undefined). So these tests assert REAL behaviour (the CLI
 * actually runs, files actually copied), never just "no exception".
 *
 * Requires `npm run build` first (the local/CI gate builds before testing).
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

function runCli(entry: string): { dir: string; stdout: string; status: number | null } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scolta-next-cli-"));
  const result = spawnSync(process.execPath, [path.join(dist, entry), "assets"], {
    cwd: dir,
    encoding: "utf-8",
    timeout: 30_000,
  });
  return { dir, stdout: result.stdout, status: result.status };
}

describe.each([["cli.cjs"], ["cli.js"]])("scolta-build assets via dist/%s", (entry) => {
  it("detects direct invocation and copies the vendored assets", () => {
    expect(fs.existsSync(path.join(dist, entry)), "dist missing — run `npm run build` first").toBe(
      true,
    );
    const { dir, stdout, status } = runCli(entry);
    try {
      // The unshimmed CJS build exited 0 with NO output and NO files — assert
      // the work product, not the exit code.
      expect(stdout).toContain("Copied");
      expect(fs.existsSync(path.join(dir, "public", "scolta", "js", "scolta.js"))).toBe(true);
      expect(status).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
