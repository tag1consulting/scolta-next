/**
 * Index build runner for both Next content modes.
 *
 * - `static-export`: crawl the rendered HTML in the export dir and index it
 *   (no CMS-specific code — the highest-demand decoupled-Drupal-over-Next case
 *   is covered here for free when the Next site is statically exported).
 * - `content`: collect a registered {@link NextContentSource} (async iterable)
 *   and index it, with unchanged entries flowing through the token cache.
 *
 * Both paths drive the same in-process {@link IndexBuildOrchestrator} from the
 * `scolta` binding, so the emitted index is identical across modes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ContentItem } from "scolta";
import { index as scoltaIndex } from "scolta";
import { collectSource, type EnumeratedContent, type NextContentSource } from "./content-source.js";
import type { NextScoltaConfig } from "./config.js";

const { IndexBuildOrchestrator, BuildIntent, MemoryBudget } = scoltaIndex;

export interface BuildOptions {
  mode?: "fresh" | "resume" | "restart";
  force?: boolean;
  source?: NextContentSource;
  logger?: { info(m: string, ...a: unknown[]): void; warn(m: string, ...a: unknown[]): void; error(m: string, ...a: unknown[]): void };
}

/** Map an export-relative HTML file path to the URL Next serves it at. */
export function exportPathToUrl(relPath: string): string {
  const p = relPath.replace(/\\/g, "/");
  if (p === "index.html") return "/";
  if (p.endsWith("/index.html")) return "/" + p.slice(0, -"/index.html".length) + "/";
  if (p.endsWith(".html")) return "/" + p.slice(0, -".html".length);
  return "/" + p;
}

/** Crawl rendered HTML files under `dir` into ContentItems. */
export function crawlStaticExport(dir: string): ContentItem[] {
  const items: ContentItem[] = [];
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".html")) continue;
      const html = fs.readFileSync(full, "utf-8");
      const rel = path.relative(dir, full);
      const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? rel;
      items.push(
        new ContentItem({ id: rel, title, bodyHtml: html, url: exportPathToUrl(rel), date: "" }),
      );
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return items;
}

/** Run an index build for the configured mode. Returns the StatusReport. */
export async function buildIndex(
  config: NextScoltaConfig,
  opts: BuildOptions = {},
): Promise<scoltaIndex.StatusReport> {
  let items: EnumeratedContent[];
  if (config.source === "content") {
    if (!opts.source) {
      throw new Error(
        "source: 'content' requires a registered NextContentSource passed to buildIndex({ source }).",
      );
    }
    items = await collectSource(opts.source);
  } else {
    items = crawlStaticExport(config.exportDir);
  }

  const orchestrator = new IndexBuildOrchestrator(config.stateDir, config.outputDir, {
    language: config.scolta.language,
  });
  const budget = MemoryBudget.default();
  const mode = opts.mode ?? "fresh";
  const intent =
    mode === "resume"
      ? BuildIntent.resume(budget)
      : mode === "restart"
        ? BuildIntent.restart(items.length, budget)
        : BuildIntent.fresh(items.length, budget);

  return orchestrator.build(intent, items, opts.logger, undefined, opts.force ?? false);
}
