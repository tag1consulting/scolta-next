/**
 * resolveScoltaAssetsDir must prefer the `scolta` installed in the consuming
 * project (cwd where `scolta-build` runs), not the copy nested inside this
 * adapter package's own node_modules — those can be different versions, and
 * resolving the adapter-nested one serves stale runtime assets.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveScoltaAssetsDir } from "../src/assets.js";

let tmp: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scolta-next-assets-"));
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("resolveScoltaAssetsDir", () => {
  it("resolves the project's scolta (cwd), not the adapter-nested copy", () => {
    // Fake consuming project: its own node_modules/scolta with a sentinel asset.
    const projectScolta = path.join(tmp, "node_modules", "scolta");
    fs.mkdirSync(path.join(projectScolta, "assets", "wasm"), { recursive: true });
    fs.writeFileSync(
      path.join(projectScolta, "package.json"),
      JSON.stringify({ name: "scolta", version: "0.0.0-test" }),
    );
    const sentinel = path.join(projectScolta, "assets", "wasm", "SENTINEL");
    fs.writeFileSync(sentinel, "sentinel");

    process.chdir(tmp);

    // Pass the test module's own URL as the "adapter" base — it is NOT under
    // the temp project, so only cwd-first resolution can find the sentinel.
    const resolved = resolveScoltaAssetsDir(import.meta.url);

    // require.resolve returns a realpath; compare realpaths (macOS /var symlink).
    expect(fs.realpathSync(resolved)).toBe(
      fs.realpathSync(path.join(projectScolta, "assets")),
    );
    expect(fs.existsSync(path.join(resolved, "wasm", "SENTINEL"))).toBe(true);
  });
});
