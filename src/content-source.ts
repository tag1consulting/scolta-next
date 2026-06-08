/**
 * Content-source protocol for server/hybrid Next sites.
 *
 * The developer registers a source that enumerates content as an async iterable
 * of `ContentItem`s. For incremental rebuilds, a source may yield a
 * `CachedContentReference` for entries unchanged since the last build (cheap
 * `changed-since` check) so they hit the in-process token cache instead of
 * being re-cleaned and re-tokenized. The interface is CMS-agnostic.
 */

import type { ContentItem } from "scolta";
import { index as scoltaIndex } from "scolta";

/** Re-export for adapter consumers: yield these for unchanged entries. */
export const CachedContentReference = scoltaIndex.CachedContentReference;

export type EnumeratedContent = ContentItem | InstanceType<typeof scoltaIndex.CachedContentReference>;

export interface NextContentSource {
  /** Yield all content (or cached references for unchanged entries). */
  enumerate(): AsyncIterable<EnumeratedContent> | Iterable<EnumeratedContent>;
}

/** Materialize a (possibly async) content source into an array. */
export async function collectSource(source: NextContentSource): Promise<EnumeratedContent[]> {
  const out: EnumeratedContent[] = [];
  for await (const item of source.enumerate() as AsyncIterable<EnumeratedContent>) {
    out.push(item);
  }
  return out;
}
