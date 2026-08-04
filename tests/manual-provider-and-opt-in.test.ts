/**
 * The Amazee opt-in gate, asserted where THIS adapter decides it.
 *
 * There is no admin UI in a code-config framework, so a developer setting
 * `ai_provider` to `amazee` is the manual opt-in. This adapter's job is to route
 * that value — and only that value — to the Amazee-backed AI service. With the
 * provider unset or set to anything else, nothing Amazee-shaped is constructed
 * and no outbound Amazee call can be made from any request path.
 *
 * `fetch` is stubbed to fail on any amazee.ai host, so an unexpected outbound
 * call is a hard failure naming the URL rather than a swallowed error.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextScoltaConfig } from "../src/config.js";
import { createScoltaRouteHandlers } from "../src/route-handlers.js";

let tmp: string;
let amazeeCalls: string[];

/** A Next Route Handler takes a Request, not a parsed body. */
function post(body: unknown): Request {
  return new Request("http://localhost/api/scolta/v1/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scolta-optin-"));
  amazeeCalls = [];
  vi.stubGlobal("fetch", async (url: unknown) => {
    const u = String(url);
    if (u.includes("amazee")) {
      amazeeCalls.push(u);
      throw new Error(`no outbound Amazee call expected, got ${u}`);
    }
    throw new Error(`unexpected outbound call to ${u}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("the Amazee opt-in gate", () => {
  it("introduces no provider of its own, from an object or from the env", () => {
    // This adapter must never invent a provider. It is asserted relative to the
    // bare config rather than against the literal "", because the no-default
    // itself belongs to the core and is pinned there (scolta's
    // tests/ai/manual-provider-and-opt-in.test.ts) — this package's own duty is
    // to add nothing. A key without a provider in particular must not be
    // silently completed.
    const bare = NextScoltaConfig.fromObject({}).scolta.ai_provider;

    expect(NextScoltaConfig.fromEnv({}, {}).scolta.ai_provider).toBe(bare);
    expect(
      NextScoltaConfig.fromEnv({}, { SCOLTA_API_KEY: "sk-env" }).scolta.ai_provider,
    ).toBe(bare);
  });

  it("takes ai_provider = amazee from the environment as the opt-in", () => {
    const config = NextScoltaConfig.fromEnv({}, { SCOLTA_AI_PROVIDER: "amazee" });

    expect(config.scolta.ai_provider).toBe("amazee");
  });

  it("makes no Amazee call on a request path when no provider is selected", async () => {
    const api = createScoltaRouteHandlers(NextScoltaConfig.fromObject({ outputDir: tmp, stateDir: tmp }));

    // The AI call itself degrades — that is the point of "AI off". What is
    // asserted is that nothing reached out to Amazee to get there.
    await api.expandQuery(post({ query: "drupal" })).catch(() => undefined);
    await api.summarize(post({ query: "drupal", context: "ctx" })).catch(() => undefined);
    await api.followUp(post({ messages: [] })).catch(() => undefined);

    expect(amazeeCalls).toEqual([]);
  });

  it("makes no Amazee call on a request path for a non-Amazee provider", async () => {
    const api = createScoltaRouteHandlers(
      NextScoltaConfig.fromObject({ outputDir: tmp, stateDir: tmp, ai_provider: "anthropic" }),
    );

    await api.expandQuery(post({ query: "drupal" })).catch(() => undefined);
    await api.summarize(post({ query: "drupal", context: "ctx" })).catch(() => undefined);
    await api.followUp(post({ messages: [] })).catch(() => undefined);

    expect(amazeeCalls).toEqual([]);
  });

  it("provisions nothing on a health check, whatever the provider", async () => {
    for (const ai_provider of ["", "anthropic", "amazee"]) {
      const api = createScoltaRouteHandlers(NextScoltaConfig.fromObject({ outputDir: tmp, stateDir: tmp, ai_provider }));
      await api.health(new Request("http://localhost/api/scolta/v1/health")).catch(() => undefined);
    }

    // Health is a read-only surface. It never establishes a connection, not
    // even for a site that opted in.
    expect(amazeeCalls).toEqual([]);
    expect(fs.existsSync(path.join(tmp, "amazee-credentials.json"))).toBe(false);
  });
});
