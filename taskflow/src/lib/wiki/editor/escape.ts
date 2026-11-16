/**
 * Table-driven escaping of typed text (Phase 97, SAFE-06). A character is an
 * escape "site" only where the inline/block tokenizers (parse/inline.ts,
 * parse/marks.ts, parse/blocks.ts) could read it as markup in its context.
 * The emitter decides whether any site must really be escaped by re-parsing
 * (emit.ts), so parsed text, which the tokenizer already read as text, is
 * never rewritten. Pure; module state is frozen constants only.
 *
 * Emoticon tokens such as `(+)` are escaped through their inner character
 * (`(\+)`), because `\(` is not an escape the renderer or Jira honours.
 */

import { JIRA_EMOTICON_TOKENS } from '../preprocess';

export type EscapeContext = {
  /** The text starts a source line (block prefixes `* `, `# `, `----`, `|`). */
  lineStart: boolean;
  /** The text is inside a table cell (`|` splits cells). */
  inCell: boolean;
  /** Neighbouring character before / after the text ('' at a boundary, `\x01` for an atom). */
  prev: string;
  next: string;
};

/** Characters whose backslash form the parser models as an escape atom. */
export const ESCAPABLE_CHARS = '*_-+^~?{}[]|!#';

/** Characters that may need escaping; `?` (cite) is not rendered, `#`/`|` are context-gated. */
export const SITE_CHARS = '*_-+^~{}[]!#|';

const isWord = (c: string): boolean => /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string): boolean => c === '' || /\s/.test(c);

/** Index offsets (inside the token) of the first escapable character of a token, or -1. */
const innerEscapable = (token: string): number => {
  for (let i = 1; i < token.length - 1; i++)
    if (ESCAPABLE_CHARS.includes(token[i] as string)) return i;
  return -1;
};

const HEADING_PREFIX = /^(h[1-6]\.|bq\.)/;

/**
 * Why `text` cannot be spelled so it re-parses and renders literally, or null.
 * `lineStart` is true when the text begins a paragraph/source line.
 */
export function unspellableReason(text: string, lineStart: boolean): string | null {
  if (lineStart) {
    const m = HEADING_PREFIX.exec(text);
    if (m)
      return `The text starts with \`${m[1]} \`, which has no escape spelling. Wrap the text in monospace (for example \`{{${text}}}\`) to keep it literal.`;
  }
  for (const token of JIRA_EMOTICON_TOKENS) {
    if (text.includes(token) && innerEscapable(token) === -1)
      return `The emoticon token \`${token}\` has no literal spelling, and monospace does not help (\`{{${token}}}\` still renders the emoticon). Insert it as an emoticon or reword the text.`;
  }
  return null;
}

/** Indexes in `text` that could be read as markup in `ctx`, by character. */
export function escapeSites(text: string, ctx: EscapeContext): Map<string, number[]> {
  const sites = new Map<string, number[]>();
  const add = (ch: string, k: number): void => {
    const list = sites.get(ch);
    if (list) {
      if (!list.includes(k)) list.push(k);
    } else sites.set(ch, [k]);
  };
  for (const token of JIRA_EMOTICON_TOKENS) {
    const off = innerEscapable(token);
    if (off === -1) continue;
    for (let at = text.indexOf(token); at !== -1; at = text.indexOf(token, at + 1))
      add(text[at + off] as string, at + off);
  }
  for (let k = 0; k < text.length; k++) {
    const ch = text[k] as string;
    if (!SITE_CHARS.includes(ch)) continue;
    const prev = k === 0 ? ctx.prev : (text[k - 1] as string);
    const next = k === text.length - 1 ? ctx.next : (text[k + 1] as string);
    const atStart = k === 0 && ctx.lineStart;
    let site: boolean;
    switch (ch) {
      case '*':
        site = !(isSpace(prev) && isSpace(next)) || (atStart && isSpace(next));
        break;
      case '#':
        site = atStart;
        break;
      case '|':
        site = ctx.inCell || atStart;
        break;
      case '_':
        site = !(isWord(prev) && isWord(next));
        break;
      case '-':
        site =
          atStart ||
          isSpace(prev) ||
          prev === '*' ||
          prev === '_' ||
          isSpace(next) ||
          next === '*' ||
          next === '_';
        break;
      case '+':
        site = !isSpace(prev) || !isSpace(next);
        break;
      default:
        site = true;
    }
    if (!site) continue;
    add(ch, k);
  }
  return sites;
}

/** `text` with a backslash before every site whose character is not in `keep`. */
export function escapeText(text: string, ctx: EscapeContext, keep?: ReadonlySet<string>): string {
  const sites = escapeSites(text, ctx);
  const at = new Set<number>();
  for (const [ch, idx] of sites) if (!keep?.has(ch)) for (const k of idx) at.add(k);
  if (at.size === 0) return text;
  let out = '';
  for (let k = 0; k < text.length; k++) out += at.has(k) ? `\\${text[k]}` : (text[k] as string);
  return out;
}
