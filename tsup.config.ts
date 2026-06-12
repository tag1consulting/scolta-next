import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    "payload/index": "src/payload/index.ts",
  },
  format: ["esm", "cjs"],
  // import.meta.url is empty ({}) in the CJS output without this: the shim
  // derives it from __filename, so the CLI's direct-invoke detection and
  // copyAssets source-dir resolution work under the .cjs entry too. Without
  // it, `node dist/cli.cjs assets` exited 0 as a silent no-op.
  shims: true,
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  external: ["react", "react/jsx-runtime", "next", "payload", "scolta"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
