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

  constructor(init: NextScoltaConfigInit = {}) {
    this.scolta = ScoltaConfig.fromObject(init);
    this.source = init.source === "content" ? "content" : "static-export";
    this.exportDir = init.exportDir ?? "out";
    this.outputDir = init.outputDir ?? "public";
    this.stateDir = init.stateDir ?? ".scolta";
    this.assetsPublicPath = init.assetsPublicPath ?? "/scolta";
    this.autoRebuild = init.autoRebuild ?? false;
    this.autoRebuildDelay = init.autoRebuildDelay ?? 2000;
  }

  static fromObject(init: NextScoltaConfigInit = {}): NextScoltaConfig {
    return new NextScoltaConfig(init);
  }

  /**
   * Read adapter + AI config from environment, merged under an explicit object.
   * Honours SCOLTA_API_KEY / SCOLTA_AI_MODEL / SCOLTA_AI_PROVIDER / SCOLTA_AI_BASE_URL.
   */
  static fromEnv(init: NextScoltaConfigInit = {}, env: NodeJS.ProcessEnv = process.env): NextScoltaConfig {
    const merged: NextScoltaConfigInit = { ...init };
    if (env["SCOLTA_API_KEY"] && merged["ai_api_key"] === undefined) merged["ai_api_key"] = env["SCOLTA_API_KEY"];
    if (env["SCOLTA_AI_MODEL"] && merged["ai_model"] === undefined) merged["ai_model"] = env["SCOLTA_AI_MODEL"];
    if (env["SCOLTA_AI_PROVIDER"] && merged["ai_provider"] === undefined) merged["ai_provider"] = env["SCOLTA_AI_PROVIDER"];
    if (env["SCOLTA_AI_BASE_URL"] && merged["ai_base_url"] === undefined) merged["ai_base_url"] = env["SCOLTA_AI_BASE_URL"];
    return new NextScoltaConfig(merged);
  }

  /** Browser bootstrap object — the SAVED values, reflected to `window.scolta`. */
  toBrowserConfig(): Record<string, unknown> {
    return this.scolta.toBrowserConfig();
  }
}
