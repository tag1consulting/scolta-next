/**
 * Lexical (Payload's default rich-text editor) → HTML serialization.
 *
 * Payload stores rich text as a Lexical editor-state JSON tree. We serialize it
 * to HTML so the binding's cleaner/tokenizer index exactly what the editor
 * emits. This default handles the standard Lexical node set (root, paragraph,
 * heading, text with format bits, list/listitem, link, quote, linebreak); a
 * site with custom Lexical features can inject its own serializer where the
 * content source accepts one.
 *
 * Pinned by a fixture (lexical → expected HTML) — "index what the serializer
 * emits" is the quiet drift risk this guards.
 */

// Lexical text-format bitfield.
const IS_BOLD = 1;
const IS_ITALIC = 1 << 1;
const IS_STRIKETHROUGH = 1 << 2;
const IS_UNDERLINE = 1 << 3;
const IS_CODE = 1 << 4;

export interface LexicalNode {
  type?: string;
  children?: LexicalNode[];
  text?: string;
  format?: number | string;
  tag?: string;
  listType?: string;
  url?: string;
  fields?: { url?: string; [k: string]: unknown };
  [k: string]: unknown;
}

export interface LexicalState {
  root?: LexicalNode;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function serializeText(node: LexicalNode): string {
  let html = escapeHtml(node.text ?? "");
  const format = typeof node.format === "number" ? node.format : 0;
  if (format & IS_CODE) html = `<code>${html}</code>`;
  if (format & IS_BOLD) html = `<strong>${html}</strong>`;
  if (format & IS_ITALIC) html = `<em>${html}</em>`;
  if (format & IS_UNDERLINE) html = `<u>${html}</u>`;
  if (format & IS_STRIKETHROUGH) html = `<s>${html}</s>`;
  return html;
}

function serializeChildren(node: LexicalNode): string {
  return (node.children ?? []).map(serializeNode).join("");
}

function serializeNode(node: LexicalNode): string {
  switch (node.type) {
    case "text":
      return serializeText(node);
    case "linebreak":
      return "<br>";
    case "paragraph":
      return `<p>${serializeChildren(node)}</p>`;
    case "heading": {
      const tag = typeof node.tag === "string" && /^h[1-6]$/.test(node.tag) ? node.tag : "h2";
      return `<${tag}>${serializeChildren(node)}</${tag}>`;
    }
    case "quote":
      return `<blockquote>${serializeChildren(node)}</blockquote>`;
    case "list": {
      const tag = node.listType === "number" ? "ol" : "ul";
      return `<${tag}>${serializeChildren(node)}</${tag}>`;
    }
    case "listitem":
      return `<li>${serializeChildren(node)}</li>`;
    case "link": {
      const url = node.fields?.url ?? node.url ?? "#";
      return `<a href="${escapeHtml(String(url))}">${serializeChildren(node)}</a>`;
    }
    default:
      return serializeChildren(node);
  }
}

/** Serialize a Lexical editor state (or root node) to HTML. */
export function lexicalToHtml(state: LexicalState | LexicalNode | null | undefined): string {
  if (!state) return "";
  const root = (state as LexicalState).root ?? (state as LexicalNode);
  if (!root || typeof root !== "object") return "";
  return serializeChildren(root);
}
