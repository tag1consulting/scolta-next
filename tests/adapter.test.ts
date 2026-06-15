/** scolta-next adapter: config round-trip, build modes, route handlers, JSON:API source. */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContentItem, ai, index as scoltaIndex } from "scolta";
import { NextScoltaConfig } from "../src/config.js";
import { buildIndex, crawlStaticExport, exportPathToUrl } from "../src/build.js";
import { createScoltaRouteHandlers } from "../src/route-handlers.js";
import { JsonApiContentSource } from "../src/jsonapi-source.js";
import type { NextContentSource } from "../src/content-source.js";

const silent = { info() {}, warn() {}, error() {} };

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scolta-next-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const longBody = "<p>" + "This paragraph is long enough to pass the minimum content length filter. ".repeat(4) + "</p>";

function writeExport(dir: string): void {
  fs.mkdirSync(path.join(dir, "about"), { recursive: true });
  fs.mkdirSync(path.join(dir, "blog"), { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), `<html><head><title>Home</title></head><body>${longBody}</body></html>`);
  fs.writeFileSync(path.join(dir, "about", "index.html"), `<html><head><title>About Us</title></head><body>${longBody}</body></html>`);
  fs.writeFileSync(path.join(dir, "blog", "first-post.html"), `<html><head><title>First Post</title></head><body>${longBody}</body></html>`);
}

describe("config round-trip (Release Gate family 4)", () => {
  it("browser config reflects the SAVED values, not defaults", () => {
    const config = NextScoltaConfig.fromObject({ site_name: "My Site", results_per_page: 12, pagefind_index_path: "/pf" });
    const b = config.toBrowserConfig();
    expect(b["siteName"]).toBe("My Site");
    expect((b["scoring"] as any)["RESULTS_PER_PAGE"]).toBe(12);
    expect(b["pagefindPath"]).toBe("/pf/pagefind.js");
  });

  it("fromEnv reads SCOLTA_API_KEY without clobbering explicit values", () => {
    const config = NextScoltaConfig.fromEnv({ ai_model: "claude-x" }, { SCOLTA_API_KEY: "sk-env" });
    expect(config.scolta.ai_api_key).toBe("sk-env");
    expect(config.scolta.ai_model).toBe("claude-x");
  });
});

describe("exportPathToUrl", () => {
  it.each([
    ["index.html", "/"],
    ["about/index.html", "/about/"],
    ["blog/first-post.html", "/blog/first-post"],
    ["docs/api/index.html", "/docs/api/"],
  ])("%s -> %s", (rel, url) => {
    expect(exportPathToUrl(rel)).toBe(url);
  });
});

describe("static-export build", () => {
  it("crawls rendered HTML into ContentItems", () => {
    const dir = path.join(tmp, "out");
    writeExport(dir);
    const items = crawlStaticExport(dir);
    expect(items.length).toBe(3);
    expect(new Set(items.map((i) => i.url))).toEqual(new Set(["/", "/about/", "/blog/first-post"]));
  });

  it("produces a valid index over the export dir", async () => {
    const dir = path.join(tmp, "out");
    writeExport(dir);
    const config = NextScoltaConfig.fromObject({
      source: "static-export",
      exportDir: dir,
      outputDir: path.join(tmp, "public"),
      stateDir: path.join(tmp, "state"),
    });
    const report = await buildIndex(config, { logger: silent });
    expect(report.success).toBe(true);
    expect(report.pagesProcessed).toBe(3);
    expect(fs.existsSync(path.join(tmp, "public", "pagefind", "pagefind-entry.json"))).toBe(true);
  });
});

describe("content-source build hits the token cache", () => {
  it("second build re-tokenizes zero unchanged items", async () => {
    const items = [
      new ContentItem({ id: "a", title: "Alpha", bodyHtml: longBody, url: "/a", date: "2024-01-01" }),
      new ContentItem({ id: "b", title: "Beta", bodyHtml: longBody, url: "/b", date: "2024-01-01" }),
    ];
    const source: NextContentSource = {
       
      async *enumerate() {
        for (const it of items) yield it;
      },
    };
    const config = NextScoltaConfig.fromObject({
      source: "content",
      outputDir: path.join(tmp, "public"),
      stateDir: path.join(tmp, "state"),
    });

    const proto = scoltaIndex.InvertedIndexBuilder.prototype;
    const original = proto.tokenizeItem;
    const calls: string[] = [];
    proto.tokenizeItem = function (item: any) {
      calls.push(item.id);
      return original.call(this, item);
    };
    try {
      await buildIndex(config, { source, logger: silent });
      expect(calls.length).toBe(2); // cold cache
      calls.length = 0;
      await buildIndex(config, { source, logger: silent });
      expect(calls).toEqual([]); // warm cache: zero re-tokenizations
    } finally {
      proto.tokenizeItem = original;
    }
  });
});

describe("AI route handlers", () => {
  function fakeService(response: string): ai.AiServiceLike {
    return {
      getExpandPrompt: () => "expand",
      getSummarizePrompt: () => "summarize",
      getFollowUpPrompt: () => "follow",
      message: async () => response,
      conversation: async () => response,
      messageForOperation: async () => response,
    };
  }

  it("expand-query returns the raw terms payload (no {ok,data} envelope)", async () => {
    // scolta.js reads `data.terms` straight off the body, so the route must send
    // the unwrapped payload — matching the Django/Laravel/Drupal controllers.
    const config = NextScoltaConfig.fromObject({});
    const h = createScoltaRouteHandlers(config, { aiService: fakeService('["term1","term2","term3"]'), logger: silent });
    const res = await h.expandQuery(new Request("http://x/api/scolta/v1/expand-query", { method: "POST", body: JSON.stringify({ query: "test" }) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBeUndefined();
    expect(json.terms).toEqual(["term1", "term2", "term3"]);
  });

  it("summarize returns the raw summary payload", async () => {
    const h = createScoltaRouteHandlers(NextScoltaConfig.fromObject({}), { aiService: fakeService("A summary."), logger: silent });
    const res = await h.summarize(new Request("http://x", { method: "POST", body: JSON.stringify({ query: "q", context: "some context here" }) }));
    const json = await res.json();
    expect(json.summary).toBe("A summary.");
  });

  it("followup enforces validation and returns the raw response payload", async () => {
    const h = createScoltaRouteHandlers(NextScoltaConfig.fromObject({}), { aiService: fakeService("reply"), logger: silent });
    const bad = await h.followUp(new Request("http://x", { method: "POST", body: JSON.stringify({ messages: [] }) }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBeTruthy();
    const ok = await h.followUp(new Request("http://x", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) }));
    expect((await ok.json()).response).toBe("reply");
  });

  it("health is status-only by default — monitors get 200, no diagnostics", async () => {
    const config = NextScoltaConfig.fromObject({ results_per_page: 17 });
    const h = createScoltaRouteHandlers(config, { logger: silent });
    const res = await h.health(new Request("http://x/api/scolta/v1/health"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Object.keys(json)).toEqual(["status"]);
    expect(["ok", "degraded"]).toContain(json.status);
  });

  it("health reflects saved scoring config when healthDetail is enabled", async () => {
    const config = NextScoltaConfig.fromObject({ results_per_page: 17, healthDetail: true });
    const h = createScoltaRouteHandlers(config, { logger: silent });
    const res = await h.health(new Request("http://x/api/scolta/v1/health"));
    const json = await res.json();
    expect(json.scoring.RESULTS_PER_PAGE).toBe(17);
    expect(json.aiConfigured).toBe(false);
  });
});

describe("request-body size cap", () => {
  it("rejects an oversized Content-Length with 413 before buffering", async () => {
    const h = createScoltaRouteHandlers(NextScoltaConfig.fromObject({}), { logger: silent });
    const res = await h.summarize(
      new Request("http://x", {
        method: "POST",
        headers: { "content-length": String(50_000_000) },
        body: JSON.stringify({ query: "q", context: "ctx" }),
      }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/too large/i);
  });

  it("accepts a normally sized body", async () => {
    const h = createScoltaRouteHandlers(NextScoltaConfig.fromObject({}), { logger: silent });
    // No AI key configured -- expand degrades gracefully but is NOT a 413.
    const res = await h.expandQuery(
      new Request("http://x", { method: "POST", body: JSON.stringify({ query: "test" }) }),
    );
    expect(res.status).not.toBe(413);
  });
});

describe("JSON:API URL validation (defense in depth)", () => {
  function sourceFor(attributes: Record<string, unknown>) {
    const page = { data: [{ id: "1", attributes }] };
    const fetchImpl = (async () =>
      new Response(JSON.stringify(page), { status: 200 })) as unknown as typeof fetch;
    return new JsonApiContentSource({ endpoint: "http://drupal/jsonapi/node/article", fetchImpl });
  }

  it("rejects a traversal alias from remote data", async () => {
    const src = sourceFor({ title: "Evil", body: "<p>x</p>", path: { alias: "/../../etc/evil" } });
    await expect(async () => {
      for await (const _item of src.enumerate()) {
        // consume
      }
    }).rejects.toThrow(/unsafe URL/);
  });

  it("rejects a non-relative url", async () => {
    const src = sourceFor({ title: "Evil", body: "<p>x</p>", url: "https://attacker.example/x" });
    await expect(async () => {
      for await (const _item of src.enumerate()) {
        // consume
      }
    }).rejects.toThrow(/unsafe URL/);
  });

  it("rejects a traversal url from a custom mapResource (not only the default map)", async () => {
    // Field mapping is documented as site-specific, so a custom `mapResource`
    // is the common case — it must not be able to bypass the URL guard. A
    // traversal path survives ContentItem URL normalization (only scheme/host
    // are stripped), so it reaches the exporter unless validated here.
    const page = { data: [{ id: "1", attributes: { title: "Evil" } }] };
    const fetchImpl = (async () =>
      new Response(JSON.stringify(page), { status: 200 })) as unknown as typeof fetch;
    const src = new JsonApiContentSource({
      endpoint: "http://drupal/jsonapi/node/article",
      fetchImpl,
      mapResource: (resource) =>
        new ContentItem({
          id: String(resource.id),
          title: "Evil",
          bodyHtml: "<p>x</p>",
          url: "/../../etc/evil",
          date: "2026-01-01T00:00:00Z",
        }),
    });
    await expect(async () => {
      for await (const _item of src.enumerate()) {
        // consume
      }
    }).rejects.toThrow(/unsafe URL/);
  });
});

describe("JSON:API content source (worked example)", () => {
  it("maps resources and emits cached refs for unchanged entries", async () => {
    const page = {
      data: [
        { id: "1", attributes: { title: "New", body: "<p>new body</p>", path: { alias: "/new" }, changed: "2026-06-01T00:00:00Z" } },
        { id: "2", attributes: { title: "Old", body: "<p>old body</p>", path: { alias: "/old" }, changed: "2020-01-01T00:00:00Z" } },
      ],
    };
    const fetchImpl = (async () => new Response(JSON.stringify(page), { status: 200 })) as unknown as typeof fetch;
    const src = new JsonApiContentSource({
      endpoint: "http://drupal/jsonapi/node/article",
      changedSince: Date.parse("2025-01-01T00:00:00Z"),
      fetchImpl,
    });
    const out: any[] = [];
    for await (const item of src.enumerate()) out.push(item);
    expect(out.length).toBe(2);
    expect(out[0]).toBeInstanceOf(ContentItem); // changed → full item
    expect(out[1]).toBeInstanceOf(scoltaIndex.CachedContentReference); // unchanged → cached ref
    expect(out[0].url).toBe("/new");
    expect(out[1].url).toBe("/old");
  });
});
