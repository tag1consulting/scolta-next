/**
 * scolta-next/payload — gated Payload CMS module.
 *
 * Imported only when a Payload app wires it in; it never hard-imports `payload`
 * itself (the developer passes their Local API instance to
 * {@link PayloadContentSource}), so installing scolta-next does not require
 * Payload. An admin status panel is intentionally NOT shipped in v1 (it depends
 * on Payload-version-specific admin internals; deferred as a follow-up).
 */

export { lexicalToHtml, type LexicalNode, type LexicalState } from "./lexical.js";
export {
  PayloadContentSource,
  type PayloadLike,
  type PayloadCollectionConfig,
  type PayloadSourceOptions,
} from "./content-source.js";
export { createScoltaPayloadHooks, type ScoltaPayloadHooks } from "./hooks.js";

/**
 * Assert the optional `payload` peer dependency is installed (dynamic import),
 * with a clear error otherwise. Most call sites pass a Payload instance instead
 * and never need this.
 */
export async function assertPayloadAvailable(): Promise<void> {
  try {
    await import("payload");
  } catch {
    throw new Error(
      "The Payload module requires `payload` to be installed: npm install payload @payloadcms/richtext-lexical",
    );
  }
}
