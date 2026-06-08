/**
 * Ready-made Next.js App Router Route Handlers for the AI endpoints.
 *
 * Thin wrappers over the framework-agnostic AiEndpointHandler in the `scolta`
 * binding. The developer mounts them at the exact paths scolta.js defaults to:
 *   app/api/scolta/v1/expand-query/route.ts  -> export const POST = handlers.expandQuery
 *   app/api/scolta/v1/summarize/route.ts     -> export const POST = handlers.summarize
 *   app/api/scolta/v1/followup/route.ts       -> export const POST = handlers.followUp
 *   app/api/scolta/v1/health/route.ts         -> export const GET  = handlers.health
 *
 * NOTE: POST Route Handlers are NOT included in a static export (`output:
 * 'export'`). In static-export mode the AI tier requires an externally hosted
 * endpoint (point `window.scolta.endpoints` at it) or running the site in
 * server mode. Search works fully static regardless.
 */

import { ai, type CacheDriver, NullCacheDriver, HealthChecker } from "scolta";
import type { NextScoltaConfig } from "./config.js";

type RouteHandler = (req: Request) => Promise<Response>;

export interface ScoltaApiOptions {
  cache?: CacheDriver;
  generation?: number;
  /** Override the AI service (defaults to the built-in AiServiceAdapter). */
  aiService?: ai.AiServiceLike;
  promptEnricher?: ai.PromptEnricher;
  logger?: ai.Logger;
}

export interface ScoltaRouteHandlers {
  expandQuery: RouteHandler;
  summarize: RouteHandler;
  followUp: RouteHandler;
  health: RouteHandler;
}

function toResponse(result: ai.EndpointResult): Response {
  if (result.ok) {
    return Response.json({ ok: true, data: result.data ?? {} });
  }
  const headers: Record<string, string> = {};
  if (result.retry_after) headers["Retry-After"] = result.retry_after;
  const body: Record<string, unknown> = { ok: false, error: result.error };
  if (result.limit !== undefined) body["limit"] = result.limit;
  return Response.json(body, { status: result.status ?? 400, headers });
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Build the four Route Handlers from a resolved config. */
export function createScoltaRouteHandlers(
  config: NextScoltaConfig,
  opts: ScoltaApiOptions = {},
): ScoltaRouteHandlers {
  const aiService = opts.aiService ?? new ai.AiServiceAdapter(config.scolta);
  const handler = ai.createAiEndpointHandler(aiService, config.scolta, {
    cache: opts.cache ?? new NullCacheDriver(),
    generation: opts.generation ?? 0,
    promptEnricher: opts.promptEnricher,
    logger: opts.logger,
  });

  return {
    expandQuery: async (req) => {
      const body = await readJson(req);
      return toResponse(await handler.handleExpandQuery(String(body.query ?? "")));
    },
    summarize: async (req) => {
      const body = await readJson(req);
      return toResponse(await handler.handleSummarize(String(body.query ?? ""), String(body.context ?? "")));
    },
    followUp: async (req) => {
      const body = await readJson(req);
      return toResponse(await handler.handleFollowUp(Array.isArray(body.messages) ? body.messages : []));
    },
    health: async () => {
      const report = await new HealthChecker(config.scolta, config.outputDir).check();
      // Reflect SAVED config (Release Gate family 4), not auto-detected defaults.
      return Response.json({ ...report, scoring: config.scolta.toJsScoringConfig() });
    },
  };
}
