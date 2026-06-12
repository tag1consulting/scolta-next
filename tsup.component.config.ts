import { defineConfig } from "tsup";

// The component builds as its own, SECOND tsup pass (see the build script):
// esbuild strips directive prologues, so the "use client" the source carries
// must be re-applied as a banner — and only this entry may carry it. ESM-only,
// matching the import-only "./component" exports condition (App Router client
// components are ESM). A separate sequential pass (not a parallel config
// array) because the main pass's clean would race with this one's output.
export default defineConfig({
  entry: { "component/index": "src/component/index.ts" },
  format: ["esm"],
  banner: { js: '"use client";' },
  dts: true,
  clean: false,
  sourcemap: true,
  target: "node20",
  external: ["react", "react/jsx-runtime", "next", "payload", "scolta"],
  outExtension() {
    return { js: ".js" };
  },
});
