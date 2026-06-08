/** Payload module: Lexical→HTML (fixture-pinned), content source, hooks. */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { index as scoltaIndex } from "scolta";
import { lexicalToHtml } from "../src/payload/lexical.js";
import { PayloadContentSource, type PayloadLike } from "../src/payload/content-source.js";
import { createScoltaPayloadHooks } from "../src/payload/hooks.js";
import { NextScoltaConfig } from "../src/config.js";
import { buildIndex } from "../src/build.js";
import { ScoltaTracker } from "../src/tracker.js";

const silent = { info() {}, warn() {}, error() {} };

// A Lexical editor-state fixture exercising the standard node set.
const LEXICAL_FIXTURE = {
  root: {
    type: "root",
    children: [
      { type: "heading", tag: "h2", children: [{ type: "text", text: "Chocolate Cake" }] },
      {
        type: "paragraph",
        children: [
          { type: "text", text: "A " },
          { type: "text", text: "rich", format: 1 },
          { type: "text", text: " and " },
          { type: "text", text: "moist", format: 2 },
          { type: "text", text: " dessert." },
        ],
      },
      {
        type: "list",
        listType: "bullet",
        children: [
          { type: "listitem", children: [{ type: "text", text: "cocoa" }] },
          { type: "listitem", children: [{ type: "text", text: "sugar" }] },
        ],
      },
      {
        type: "paragraph",
        children: [{ type: "link", fields: { url: "https://example.com/recipe" }, children: [{ type: "text", text: "full recipe" }] }],
      },
    ],
  },
};

const EXPECTED_HTML =
  "<h2>Chocolate Cake</h2>" +
  "<p>A <strong>rich</strong> and <em>moist</em> dessert.</p>" +
  "<ul><li>cocoa</li><li>sugar</li></ul>" +
  '<p><a href="https://example.com/recipe">full recipe</a></p>';

describe("lexicalToHtml (fixture-pinned)", () => {
  it("serializes the standard node set", () => {
    expect(lexicalToHtml(LEXICAL_FIXTURE)).toBe(EXPECTED_HTML);
  });

  it("escapes text and handles empty/missing state", () => {
    expect(lexicalToHtml({ root: { children: [{ type: "paragraph", children: [{ type: "text", text: "a & <b>" }] }] } })).toBe(
      "<p>a &amp; &lt;b&gt;</p>",
    );
    expect(lexicalToHtml(null)).toBe("");
    expect(lexicalToHtml(undefined)).toBe("");
  });
});

// A fake Payload Local API returning one collection of docs.
function fakePayload(docs: Record<string, any>[]): PayloadLike {
  return {
    async find() {
      return { docs, hasNextPage: false, nextPage: null };
    },
  };
}

describe("PayloadContentSource", () => {
  it("throws a clear error without a payload instance", () => {
    expect(() => new PayloadContentSource({ payload: undefined as any, collections: [] })).toThrow(/Local API instance/);
  });

  it("maps collection docs to ContentItems via the Lexical serializer + url fn", async () => {
    const payload = fakePayload([
      { id: 1, title: "Cake", content: LEXICAL_FIXTURE, slug: "cake", updatedAt: "2026-01-01" },
    ]);
    const source = new PayloadContentSource({
      payload,
      collections: [{ slug: "recipes", url: (doc) => `/recipes/${doc.slug}` }],
    });
    const out: any[] = [];
    for await (const item of source.enumerate()) out.push(item);
    expect(out.length).toBe(1);
    expect(out[0].id).toBe("recipes:1");
    expect(out[0].url).toBe("/recipes/cake");
    expect(out[0].bodyHtml).toBe(EXPECTED_HTML);
  });
});

describe("payload hooks → tracker", () => {
  it("afterChange/afterDelete touch the tracker with collection:id keys", () => {
    let rebuilds = 0;
    const config = NextScoltaConfig.fromObject({ source: "content", autoRebuild: false });
    const tracker = new ScoltaTracker(config, { rebuild: () => void rebuilds++ });
    const hooks = createScoltaPayloadHooks(tracker, "articles");
    hooks.afterChange({ doc: { id: 7 } });
    hooks.afterDelete({ doc: { id: 9 } });
    expect(tracker.pending()).toEqual(["articles:7", "articles:9"]);
    expect(tracker.isScheduled()).toBe(false); // autoRebuild off
  });
});

describe("Payload-mode build re-tokenizes exactly one page on edit", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scolta-payload-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("a single doc edit re-tokenizes only that page (token cache)", async () => {
    const docs: Record<string, any>[] = [
      { id: 1, title: "Cake", content: LEXICAL_FIXTURE, slug: "cake", updatedAt: "2026-01-01" },
      { id: 2, title: "Pie", content: LEXICAL_FIXTURE, slug: "pie", updatedAt: "2026-01-01" },
    ];
    const config = NextScoltaConfig.fromObject({
      source: "content",
      outputDir: path.join(tmp, "public"),
      stateDir: path.join(tmp, "state"),
    });
    const makeSource = () =>
      new PayloadContentSource({ payload: fakePayload(docs), collections: [{ slug: "recipes", url: (d) => `/recipes/${d.slug}` }] });

    const proto = scoltaIndex.InvertedIndexBuilder.prototype;
    const original = proto.tokenizeItem;
    const calls: string[] = [];
    proto.tokenizeItem = function (item: any) {
      calls.push(item.id);
      return original.call(this, item);
    };
    try {
      await buildIndex(config, { source: makeSource(), logger: silent });
      expect(calls.length).toBe(2); // cold cache

      // Edit doc 2's rich text (changes its content hash).
      docs[1] = { ...docs[1]!, content: { root: { children: [{ type: "paragraph", children: [{ type: "text", text: "new pie filling recipe with extra detail here" }] }] } } };
      calls.length = 0;
      await buildIndex(config, { source: makeSource(), logger: silent });
      expect(calls).toEqual(["recipes:2"]); // only the edited doc
    } finally {
      proto.tokenizeItem = original;
    }
  });
});
