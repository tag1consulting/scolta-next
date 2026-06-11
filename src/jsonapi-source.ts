/**
 * Worked example: a JSON:API / decoupled-Drupal content source.
 *
 * This is the highest-value content-source case for Next (the `next-drupal`
 * pattern). It is a `fetch`-based async iterable over a Drupal JSON:API
 * endpoint with a `changed-since` check: entries whose `changed` timestamp is
 * older than the last build yield a {@link CachedContentReference} (hitting the
 * token cache), otherwise a full {@link ContentItem}.
 *
 * It is a documented EXAMPLE, not a separately-tested first-class module — the
 * v1 bar is the generic content-source interface plus this reference shape.
 * Field mapping (which JSON:API attributes become title/body/url/filters) is
 * inherently site-specific; adjust `mapResource` for your content model.
 */

import { ContentItem, index as scoltaIndex } from "scolta";
import { CachedContentReference, type EnumeratedContent, type NextContentSource } from "./content-source.js";

export interface JsonApiResource {
  id: string;
  attributes: Record<string, unknown>;
}

export interface JsonApiSourceOptions {
  /** Base JSON:API collection URL, e.g. https://drupal.example.com/jsonapi/node/article */
  endpoint: string;
  /** Unix-ms timestamp of the last successful build; older entries are cached. */
  changedSince?: number;
  /** Optional bearer token / headers for authenticated JSON:API. */
  headers?: Record<string, string>;
  /** Injectable fetch (defaults to global fetch) — used for testing. */
  fetchImpl?: typeof fetch;
  /** Map a JSON:API resource to a ContentItem. Override for your content model. */
  mapResource?: (resource: JsonApiResource) => ContentItem;
}

/** Read a nested attribute (`body.processed`-style) without trusting its shape. */
function attr(value: unknown, key: string): unknown {
  if (value !== null && typeof value === "object" && key in value) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

/**
 * Validate a mapped URL path: it must be site-relative (leading `/`) and free
 * of `..` segments. The scolta binding's exporter also refuses to write
 * outside its output dir; rejecting here names the offending resource while
 * the remote data is still in hand (defense in depth above that containment).
 */
export function validateResourceUrl(url: string, resourceId: string): string {
  const hasTraversal = url.split(/[\\/]/).includes("..");
  if (!url.startsWith("/") || hasTraversal) {
    throw new Error(
      `JSON:API resource "${resourceId}" mapped to unsafe URL ${JSON.stringify(url)}: ` +
        "URLs must start with '/' and must not contain '..' segments. " +
        "Adjust mapResource for your content model.",
    );
  }
  return url;
}

function defaultMap(resource: JsonApiResource): ContentItem {
  const a = resource.attributes;
  const body = a["body"];
  const path = a["path"];
  const url = asString(attr(path, "alias")) || asString(a["url"]) || `/node/${resource.id}`;
  return new ContentItem({
    id: String(resource.id),
    title: asString(a["title"]),
    bodyHtml: asString(attr(body, "processed")) || asString(attr(body, "value")) || asString(body),
    url: validateResourceUrl(url, String(resource.id)),
    date: asString(a["created"]),
    language: asString(a["langcode"], "en") || "en",
  });
}

export class JsonApiContentSource implements NextContentSource {
  constructor(private readonly options: JsonApiSourceOptions) {}

  async *enumerate(): AsyncGenerator<EnumeratedContent> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const map = this.options.mapResource ?? defaultMap;
    let url: string | null = this.options.endpoint;

    while (url) {
      const res = await fetchImpl(url, { headers: this.options.headers });
      if (!res.ok) {
        throw new Error(`JSON:API request failed: HTTP ${res.status} for ${url}`);
      }
      const doc = (await res.json()) as { data: JsonApiResource[]; links?: { next?: { href: string } } };
      for (const resource of doc.data ?? []) {
        const item = map(resource);
        const changedRaw = resource.attributes["changed"] ?? resource.attributes["created"];
        const changedMs =
          typeof changedRaw === "string" || typeof changedRaw === "number"
            ? Date.parse(String(changedRaw))
            : NaN;
        if (this.options.changedSince !== undefined && !Number.isNaN(changedMs) && changedMs < this.options.changedSince) {
          // Unchanged → cache reference (cheap, no body re-tokenization).
          yield new CachedContentReference(
            item.id,
            // The token cache is keyed by sha256(url \0 bodyHtml) — reuse the
            // binding's own hash so this resolves to a true cache hit.
            scoltaIndex.contentHash(item),
            item.id,
            item.url,
            item.date,
            item.siteName,
            item.language,
            item.filters,
            item.sortable,
          );
        } else {
          yield item;
        }
      }
      url = doc.links?.next?.href ?? null;
    }
  }
}
