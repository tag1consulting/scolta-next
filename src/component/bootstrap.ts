/**
 * Pure helper that builds the `window.scolta` bootstrap object from the
 * resolved browser config. Extracted from the component so it is unit-testable
 * without a DOM — it must reflect the SAVED config (Release Gate family 4).
 */

export interface BootstrapOptions {
  /** Public path the vendored assets are served from (default /scolta). */
  assetsPath?: string;
  /** Override the pagefind.js path (default derived from config). */
  pagefindPath?: string;
}

export function buildWindowScolta(
  browserConfig: Record<string, unknown>,
  opts: BootstrapOptions = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...browserConfig };
  if (opts.pagefindPath) {
    result["pagefindPath"] = opts.pagefindPath;
  }
  if (opts.assetsPath) {
    result["wasmPath"] = `${opts.assetsPath.replace(/\/$/, "")}/wasm/`;
  }
  return result;
}
