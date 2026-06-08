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
  attributes: Record<string, any>;
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

function defaultMap(resource: JsonApiResource): ContentItem {
  const a = resource.attributes;
  return new ContentItem({
    id: String(resource.id),
    title: String(a["title"] ?? ""),
    bodyHtml: String(a["body"]?.processed ?? a["body"]?.value ?? a["body"] ?? ""),
    url: String(a["path"]?.alias ?? a["url"] ?? `/node/${resource.id}`),
    date: String(a["created"] ?? ""),
    language: String(a["langcode"] ?? "en"),
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
        const changedMs = changedRaw ? Date.parse(String(changedRaw)) : NaN;
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
