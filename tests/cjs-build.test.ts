/**
 * CJS build smoke tests — the dual-format bundle's require()/direct-invoke
 * path.
 *
 * Without tsup's import.meta shim, every `import.meta.url` compiles to a
 * property of an EMPTY object in the CJS output: `node dist/cli.cjs assets`
 * exited 0 as a silent no-op (the direct-invoke check compared undefined to
 * the argv URL), and a programmatic main() threw from copyAssets's
 * createRequire(undefined). So the behavioural test asserts REAL work
 * products (files actually copied), never just "no exception" — and the
 * artifact test pins the shim itself, independent of the installed binding.
 *
 * Requires `npm run build` first (the local/CI gate builds before testing).
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const require = createRequire(import.meta.url);

// The CLI requires the `scolta` binding at module load, and scolta 1.0.0's
// own CJS entry crashes at require() (fixed in scolta 1.0.1 — the same
// import.meta-in-CJS defect, in the binding). The end-to-end CJS run can only
// work once the installed binding is >= 1.0.1; until the dependency floor
// rises, the behavioural test states its precondition instead of failing on
// the binding's bug. The artifact test below covers this package's own shim
// unconditionally.
const scoltaVersion = (require("scolta/package.json") as { version: string }).version;
const [maj = 0, min = 0, pat = 0] = scoltaVersion.split(".").map(Number);
const scoltaCjsWorks = maj > 1 || (maj === 1 && (min > 0 || pat >= 1));

describe("CJS artifact carries the import.meta shim", () => {
  it("dist/cli.cjs is shimmed (no empty import_meta object on the invoke path)", () => {
    const file = path.join(dist, "cli.cjs");
    expect(fs.existsSync(file), "dist missing — run `npm run build` first").toBe(true);
    const text = fs.readFileSync(file, "utf-8");
    expect(text).toContain("getImportMetaUrl"); // tsup's shim
    expect(text).not.toMatch(/var import_meta\d* = \{\};/); // the broken lowering
  });
});

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
  it.skipIf(entry === "cli.cjs" && !scoltaCjsWorks)(
    "detects direct invocation and copies the vendored assets",
    () => {
      const { dir, stdout, status } = runCli(entry);
      try {
        // The unshimmed CJS build exited 0 with NO output and NO files —
        // assert the work product, not the exit code.
        expect(stdout).toContain("Copied");
        expect(fs.existsSync(path.join(dir, "public", "scolta", "js", "scolta.js"))).toBe(true);
        expect(status).toBe(0);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
