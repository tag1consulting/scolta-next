/**
 * Build smoke test: esbuild strips directive prologues, so "use client" must
 * be re-applied as a tsup banner on the component entry. A directive-less
 * client component fails at runtime in the App Router with an opaque
 * server-component error — guard the artifact itself.
 *
 * Requires `npm run build` to have run (the local gate builds before testing).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

describe("dist directive survival", () => {
  it('dist/component/index.js starts with "use client"', () => {
    const file = path.join(dist, "component", "index.js");
    expect(fs.existsSync(file), "dist missing — run `npm run build` before the test gate").toBe(
      true,
    );
    expect(fs.readFileSync(file, "utf-8").trimStart().startsWith('"use client";')).toBe(true);
  });

  it("the server entry does NOT carry the directive", () => {
    const file = path.join(dist, "index.js");
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, "utf-8").trimStart().startsWith('"use client"')).toBe(false);
  });
});
