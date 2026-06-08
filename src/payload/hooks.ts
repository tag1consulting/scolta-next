/**
 * Payload collection hooks → debounced rebuild.
 *
 * `afterChange` / `afterDelete` route the changed doc id into the
 * {@link ScoltaTracker}, which debounces a rebuild that reuses the token cache
 * (so a single doc save re-tokenizes exactly one page). Gated on `autoRebuild`
 * via the tracker. Spread these into your collection config:
 *
 *   const hooks = createScoltaPayloadHooks(tracker, "articles");
 *   // collection: { ..., hooks: { afterChange: [hooks.afterChange],
 *   //                             afterDelete: [hooks.afterDelete] } }
 */

import type { ScoltaTracker } from "../tracker.js";

export interface PayloadAfterChangeArgs {
  doc: Record<string, any>;
  [k: string]: unknown;
}
export interface PayloadAfterDeleteArgs {
  doc?: Record<string, any>;
  id?: string | number;
  [k: string]: unknown;
}

export interface ScoltaPayloadHooks {
  afterChange: (args: PayloadAfterChangeArgs) => Record<string, any>;
  afterDelete: (args: PayloadAfterDeleteArgs) => Record<string, any> | undefined;
}

export function createScoltaPayloadHooks(tracker: ScoltaTracker, collectionSlug: string): ScoltaPayloadHooks {
  const key = (id: unknown): string => `${collectionSlug}:${String(id)}`;
  return {
    afterChange: (args) => {
      tracker.touch(key(args.doc?.["id"]));
      return args.doc;
    },
    afterDelete: (args) => {
      tracker.touch(key(args.doc?.["id"] ?? args.id));
      return args.doc;
    },
  };
}
