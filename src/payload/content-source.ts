/**
 * Payload CMS content source over the Local API.
 *
 * Enumerates the developer-declared collections, serializes the configured
 * rich-text (Lexical) field to HTML, and yields `ContentItem`s. Payload has no
 * canonical page-URL concept, so a `url(doc)` function is REQUIRED per
 * collection (documented requirement).
 *
 * Gated: the module never hard-imports `payload`; the developer passes their
 * app's Local API instance. A clear error is thrown if it is missing.
 */

import { ContentItem } from "scolta";
import type { EnumeratedContent, NextContentSource } from "../content-source.js";
import { lexicalToHtml } from "./lexical.js";

/** Minimal shape of the Payload Local API we depend on. */
export interface PayloadLike {
  find(args: {
    collection: string;
    limit?: number;
    page?: number;
    depth?: number;
    pagination?: boolean;
  }): Promise<{ docs: Record<string, any>[]; hasNextPage?: boolean; nextPage?: number | null }>;
}

export interface PayloadCollectionConfig {
  slug: string;
  /** REQUIRED — derive the canonical URL (Payload has no built-in page URL). */
  url: (doc: Record<string, any>) => string;
  titleField?: string;
  richTextField?: string;
  dateField?: string;
  filters?: (doc: Record<string, any>) => Record<string, string | string[]>;
}

export interface PayloadSourceOptions {
  payload: PayloadLike;
  collections: PayloadCollectionConfig[];
  /** Override the rich-text serializer (default: Lexical → HTML). */
  serializer?: (richText: unknown) => string;
  language?: string;
  /** Local API page size. */
  pageSize?: number;
}

export class PayloadContentSource implements NextContentSource {
  constructor(private readonly options: PayloadSourceOptions) {
    if (!options.payload || typeof options.payload.find !== "function") {
      throw new Error(
        "PayloadContentSource requires a Payload Local API instance. Pass `payload` from your app: " +
          "new PayloadContentSource({ payload, collections: [...] }).",
      );
    }
  }

  async *enumerate(): AsyncGenerator<EnumeratedContent> {
    const serialize: (richText: unknown) => string =
      this.options.serializer ?? (lexicalToHtml as (richText: unknown) => string);
    const language = this.options.language ?? "en";
    const pageSize = this.options.pageSize ?? 100;

    for (const col of this.options.collections) {
      const titleField = col.titleField ?? "title";
      const richTextField = col.richTextField ?? "content";
      let page = 1;
      for (;;) {
        const result = await this.options.payload.find({
          collection: col.slug,
          limit: pageSize,
          page,
          depth: 1,
          pagination: true,
        });
        for (const doc of result.docs ?? []) {
          const bodyHtml = serialize(doc[richTextField]);
          const date = col.dateField ? String(doc[col.dateField] ?? "") : String(doc["updatedAt"] ?? doc["createdAt"] ?? "");
          yield new ContentItem({
            id: `${col.slug}:${doc["id"]}`,
            title: String(doc[titleField] ?? ""),
            bodyHtml,
            url: col.url(doc),
            date,
            language,
            filters: col.filters ? col.filters(doc) : {},
          });
        }
        if (!result.hasNextPage || result.nextPage == null) break;
        page = result.nextPage;
      }
    }
  }
}
