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
  // scolta.js reads the payload fields (terms/summary/response) directly off the
  // response body, so success responses send the raw `data` (not an {ok,data}
  // envelope) and failures send {error} — mirroring the Django/Laravel/Drupal
  // controllers' response mapping exactly.
  if (result.ok) {
    return Response.json(result.data ?? {});
  }
  const headers: Record<string, string> = {};
  if (result.retry_after) headers["Retry-After"] = result.retry_after;
  return Response.json({ error: result.error ?? "Error" }, { status: result.status ?? 500, headers });
}

/**
 * Reject request bodies above this size before buffering them. The largest
 * legitimate payload is handleSummarize's context, which the handler caps at
 * 100k characters — but that check runs after the body is fully read, so the
 * public POST handlers need a pre-buffering bound too.
 */
const MAX_BODY_BYTES = 1_000_000;

/** Marker returned by {@link readJson} when Content-Length exceeds the cap. */
const BODY_TOO_LARGE = Symbol("scolta-body-too-large");

async function readJson(req: Request): Promise<unknown> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return BODY_TOO_LARGE;
  }
  try {
    return (await req.json()) as unknown;
  } catch {
    return {};
  }
}

const TOO_LARGE_RESPONSE = () =>
  Response.json({ error: "Request body too large" }, { status: 413 });

/** Narrow an unknown JSON body to an object for per-field reads. */
function asRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/** Read a string field off a JSON body; non-string scalars stringify, the rest is "". */
function fieldString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * Default AI service: when the resolved provider is `amazee`, use the
 * auto-provisioning {@link ai.AmazeeAiService} (free LiteLLM trial on first use,
 * no key required) backed by a filesystem credential store under the state dir.
 * Otherwise the plain {@link ai.AiServiceAdapter} (explicit key / framework AI).
 */
function defaultAiService(config: NextScoltaConfig): ai.AiServiceLike {
  if (config.scolta.ai_provider === "amazee") {
    return new ai.AmazeeAiService(config.scolta, new ai.FilesystemConfigStorage(config.stateDir));
  }
  return new ai.AiServiceAdapter(config.scolta);
}

/** Build the four Route Handlers from a resolved config. */
export function createScoltaRouteHandlers(
  config: NextScoltaConfig,
  opts: ScoltaApiOptions = {},
): ScoltaRouteHandlers {
  const aiService = opts.aiService ?? defaultAiService(config);
  const handler = ai.createAiEndpointHandler(aiService, config.scolta, {
    cache: opts.cache ?? new NullCacheDriver(),
    generation: opts.generation ?? 0,
    promptEnricher: opts.promptEnricher,
    logger: opts.logger,
  });

  return {
    expandQuery: async (req) => {
      const raw = await readJson(req);
      if (raw === BODY_TOO_LARGE) return TOO_LARGE_RESPONSE();
      const body = asRecord(raw);
      return toResponse(await handler.handleExpandQuery(fieldString(body, "query")));
    },
    summarize: async (req) => {
      const raw = await readJson(req);
      if (raw === BODY_TOO_LARGE) return TOO_LARGE_RESPONSE();
      const body = asRecord(raw);
      return toResponse(
        await handler.handleSummarize(fieldString(body, "query"), fieldString(body, "context")),
      );
    },
    followUp: async (req) => {
      const raw = await readJson(req);
      if (raw === BODY_TOO_LARGE) return TOO_LARGE_RESPONSE();
      const body = asRecord(raw);
      const messages = body["messages"];
      return toResponse(
        await handler.handleFollowUp(Array.isArray(messages) ? (messages as ai.ChatMessage[]) : []),
      );
    },
    health: async () => {
      // The full report is always computed so the trimmed status still
      // reflects degradation; without healthDetail every caller gets exactly
      // {status} — enough for uptime monitors, nothing a public endpoint
      // shouldn't expose.
      const report = await new HealthChecker(config.scolta, config.outputDir).check();
      if (!config.healthDetail) {
        return Response.json({ status: report.status });
      }
      // Reflect SAVED config (Release Gate family 4), not auto-detected defaults.
      return Response.json({ ...report, scoring: config.scolta.toJsScoringConfig() });
    },
  };
}
