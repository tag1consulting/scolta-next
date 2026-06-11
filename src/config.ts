/**
 * Next.js adapter configuration.
 *
 * Wraps the framework-agnostic {@link ScoltaConfig} (scoring/AI/feature flags —
 * the wire contract to scolta.js) and adds Next-specific concerns: content
 * mode, the static-export crawl dir, the public output dirs, and auto-rebuild
 * debounce. Config the developer writes (a `scolta.config.{ts,js}` object or
 * env) is exactly what the adapter reports back (Release Gate family 4).
 */

import { ScoltaConfig } from "scolta";

export type ContentMode = "static-export" | "content";

export interface NextScoltaConfigInit extends Record<string, unknown> {
  /** 'static-export' crawls rendered HTML; 'content' uses registered sources. */
  source?: ContentMode;
  /** Static-export output dir to crawl (Next `output: 'export'` default `out`). */
  exportDir?: string;
  /** Parent dir the `pagefind/` index is written under (served statically). */
  outputDir?: string;
  /** Transient + cross-build state dir for the in-process indexer. */
  stateDir?: string;
  /** Public URL path the vendored scolta assets are served from. */
  assetsPublicPath?: string;
  /** Debounced rebuild on content change (server/hybrid mode only). */
  autoRebuild?: boolean;
  /** Debounce window in milliseconds. */
  autoRebuildDelay?: number;
  /**
   * Expose the full diagnostic payload on GET /health. Default false: every
   * caller gets {"status": ...} only — enough for uptime monitors. There is
   * no user model in a headless stack, so detail is config-gated, not
   * auth-gated; enable it only where the endpoint is not publicly reachable.
   */
  healthDetail?: boolean;
}

export class NextScoltaConfig {
  readonly scolta: ScoltaConfig;
  readonly source: ContentMode;
  readonly exportDir: string;
  readonly outputDir: string;
  readonly stateDir: string;
  readonly assetsPublicPath: string;
  readonly autoRebuild: boolean;
  readonly autoRebuildDelay: number;
  readonly healthDetail: boolean;

  constructor(init: NextScoltaConfigInit = {}) {
    this.scolta = ScoltaConfig.fromObject(init);
    this.source = init.source === "content" ? "content" : "static-export";
    this.exportDir = init.exportDir ?? "out";
    this.outputDir = init.outputDir ?? "public";
    this.stateDir = init.stateDir ?? ".scolta";
    this.assetsPublicPath = init.assetsPublicPath ?? "/scolta";
    this.autoRebuild = init.autoRebuild ?? false;
    this.autoRebuildDelay = init.autoRebuildDelay ?? 2000;
    this.healthDetail = init.healthDetail ?? false;
  }

  static fromObject(init: NextScoltaConfigInit = {}): NextScoltaConfig {
    return new NextScoltaConfig(init);
  }

  /**
   * Read adapter + AI config from environment, overlaid on an explicit object.
   * Honours SCOLTA_API_KEY / SCOLTA_AI_MODEL / SCOLTA_AI_PROVIDER / SCOLTA_AI_BASE_URL.
   * Environment values win over the static config so a deployment can point AI at
   * an explicit provider/key (e.g. SCOLTA_AI_PROVIDER=anthropic + SCOLTA_API_KEY)
   * and skip the Amazee default.
   */
  static fromEnv(init: NextScoltaConfigInit = {}, env: NodeJS.ProcessEnv = process.env): NextScoltaConfig {
    const merged: NextScoltaConfigInit = { ...init };
    if (env["SCOLTA_API_KEY"]) merged["ai_api_key"] = env["SCOLTA_API_KEY"];
    if (env["SCOLTA_AI_MODEL"]) merged["ai_model"] = env["SCOLTA_AI_MODEL"];
    if (env["SCOLTA_AI_PROVIDER"]) merged["ai_provider"] = env["SCOLTA_AI_PROVIDER"];
    if (env["SCOLTA_AI_BASE_URL"]) merged["ai_base_url"] = env["SCOLTA_AI_BASE_URL"];
    return new NextScoltaConfig(merged);
  }

  /** Browser bootstrap object — the SAVED values, reflected to `window.scolta`. */
  toBrowserConfig(): Record<string, unknown> {
    return this.scolta.toBrowserConfig();
  }
}
