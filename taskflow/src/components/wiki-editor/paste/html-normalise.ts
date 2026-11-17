/**
 * Clipboard HTML -> the markup the editor schema's parseHTML rules already accept (D-13/D-14).
 *
 * The input is parsed with DOMParser (an inert document: no script runs, no resource loads) and
 * an allowlist walk rebuilds a NEW document. Attributes are never copied wholesale: only a
 * safe `href`, validated `data-wiki-*` markers and a palette-matched `data-color` survive, so
 * raw pasted HTML can never reach the editor. The normaliser never fetches images; it lists
 * them for the paste plugin.
 */
import { isSafeColor } from '@/lib/wiki/editor/parse/color';
import { JIRA_EMOTICON_TOKENS } from '@/lib/wiki/preprocess';
import { CODE_LANGUAGES } from '../languages';
import { isSafeLinkUrl, normalizeLinkUrl } from '../link-url';
import { TEXT_PALETTE } from '../palette';
import { applyJiraRewrites, type NormaliseContext } from './jira-html';
import { applyWordRewrites } from './word-html';

export type { NormaliseContext };

export const PASTE_IMAGE_MARKER_PREFIX = 'wiki-paste-image-';

export interface PastedImage {
  marker: string;
  src: string;
  alt: string;
}

const DROP = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'canvas',
  'template',
  'noscript',
  'head',
  'meta',
  'link',
  'input',
  'button',
  'form',
  'select',
  'textarea',
  'audio',
  'video',
  'title',
]);

/** Tag -> output tag for elements copied (without attributes). */
const KEEP: Record<string, string> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  blockquote: 'blockquote',
  hr: 'hr',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  u: 'u',
  s: 's',
  strike: 's',
  del: 's',
  code: 'code',
  sup: 'sup',
  sub: 'sub',
  cite: 'cite',
};

/** Elements whose children must not be wrapped in style-derived marks. */
const STRUCTURAL = new Set(['ul', 'ol', 'blockquote', 'hr']);

const BLOCKISH = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'li',
  'div',
  'hr',
  'table',
]);

const PANEL_TYPES = new Set(['panel', 'info', 'note', 'warning', 'tip']);
const MENTION_ID = /^[\w.@-]+$/;
const IMAGE_NAME_BAD = /[!|\n\r{}[\]]/;
const LANG_CLASS = /\b(?:language|code)-([a-z]+)\b/;

interface State {
  out: Document;
  images: PastedImage[];
}

// -- colour ------------------------------------------------------------------------------

function toHex(css: string): string | null {
  const v = css.trim().toLowerCase();
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (hex3) return `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/][^)]*)?\)$/.exec(
    v,
  );
  if (!rgb) return null;
  const parts = [rgb[1], rgb[2], rgb[3]].map((x) => Number.parseInt(x as string, 10));
  if (parts.some((n) => n > 255)) return null;
  return `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Body defaults: dropped even though black/white/dark-grey are palette entries. */
const DEFAULT_COLOURS = new Set(['#000000', '#ffffff', '#172b4d']);

/** The palette value for a CSS colour, only on an exact match and never for body defaults. */
function paletteColour(css: string | undefined): string | null {
  if (!css) return null;
  const hex = toHex(css);
  if (!hex || DEFAULT_COLOURS.has(hex)) return null;
  const entry = TEXT_PALETTE.find((p) => p.value === hex);
  return entry && isSafeColor(entry.value) ? entry.value : null;
}

// -- style -> marks ----------------------------------------------------------------------

type MarkSpec = { tag: 'strong' | 'em' | 'u' | 's' } | { tag: 'color'; value: string };

function styleMap(el: Element): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of (el.getAttribute('style') ?? '').split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) map.set(decl.slice(0, i).trim().toLowerCase(), decl.slice(i + 1).trim());
  }
  return map;
}

function isBoldWeight(w: string | undefined): boolean {
  if (!w) return false;
  const v = w.toLowerCase();
  return v === 'bold' || v === 'bolder' || Number.parseInt(v, 10) >= 600;
}

function styleMarks(el: Element, tag: string): MarkSpec[] {
  const style = styleMap(el);
  const marks: MarkSpec[] = [];
  // Docs/Word style every heading run font-weight:700; a heading is already bold, so only an
  // explicit <b>/<strong> inside one becomes a bold mark.
  if (
    isBoldWeight(style.get('font-weight')) &&
    tag !== 'b' &&
    tag !== 'strong' &&
    !el.closest('h1,h2,h3,h4,h5,h6')
  ) {
    marks.push({ tag: 'strong' });
  }
  if (/italic|oblique/i.test(style.get('font-style') ?? '') && tag !== 'i' && tag !== 'em') {
    marks.push({ tag: 'em' });
  }
  const deco = style.get('text-decoration') ?? style.get('text-decoration-line') ?? '';
  if (/underline/i.test(deco) && tag !== 'a' && tag !== 'u') marks.push({ tag: 'u' });
  if (/line-through/i.test(deco) && tag !== 's' && tag !== 'strike' && tag !== 'del') {
    marks.push({ tag: 's' });
  }
  const colour = paletteColour(
    tag === 'font' ? (el.getAttribute('color') ?? undefined) : style.get('color'),
  );
  if (colour) marks.push({ tag: 'color', value: colour });
  return marks;
}

function nestMark(st: State, target: Node, mark: MarkSpec): Node {
  const el = st.out.createElement(mark.tag === 'color' ? 'span' : mark.tag);
  if (mark.tag === 'color') {
    el.setAttribute('data-color', mark.value);
    el.setAttribute('value', mark.value);
  }
  target.appendChild(el);
  return el;
}

// -- walk --------------------------------------------------------------------------------

function el(st: State, tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const e = st.out.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Text of a `<pre>`, with `<br>` as a newline. */
function preText(node: Node): string {
  let s = '';
  for (const c of Array.from(node.childNodes)) {
    if (c.nodeType === 3) s += (c as Text).data;
    else if (c.nodeType === 1) {
      s += (c as Element).localName === 'br' ? '\n' : preText(c);
    }
  }
  return s;
}

function handlePre(src: Element, dest: Node, st: State): void {
  const noformat = src.hasAttribute('data-wiki-noformat');
  const cls = `${src.getAttribute('class') ?? ''} ${src.querySelector('code')?.getAttribute('class') ?? ''}`;
  const lang = LANG_CLASS.exec(cls)?.[1];
  const pre = noformat ? el(st, 'pre', { open: '{noformat}', close: '{noformat}' }) : el(st, 'pre');
  const code = el(
    st,
    'code',
    !noformat && lang && CODE_LANGUAGES.some((l) => l.value === lang)
      ? { class: `language-${lang}` }
      : {},
  );
  code.appendChild(st.out.createTextNode(preText(src).replace(/\n$/, '')));
  pre.appendChild(code);
  dest.appendChild(pre);
}

function handleImage(src: Element, dest: Node, st: State): void {
  const url = (src.getAttribute('src') ?? '').trim();
  if (!/^(data:image\/|https?:\/\/)/i.test(url)) return;
  const marker = `${PASTE_IMAGE_MARKER_PREFIX}${st.images.length + 1}`;
  st.images.push({ marker, src: url, alt: src.getAttribute('alt') ?? '' });
  dest.appendChild(el(st, 'span', { 'data-wiki-image': '', name: marker }));
}

/** Handles pre-rewritten (or hostile) `data-wiki-*` markers, re-validating each. */
function handleMarker(src: Element, dest: Node, st: State, inTable: boolean): boolean {
  if (src.hasAttribute('data-wiki-mention')) {
    const id = src.getAttribute('id') ?? '';
    if (MENTION_ID.test(id)) dest.appendChild(el(st, 'span', { 'data-wiki-mention': '', id }));
    return true;
  }
  if (src.hasAttribute('data-wiki-emoticon')) {
    const tok = src.getAttribute('src') ?? '';
    if (JIRA_EMOTICON_TOKENS.includes(tok)) {
      dest.appendChild(el(st, 'span', { 'data-wiki-emoticon': '', src: tok }));
    }
    return true;
  }
  if (src.hasAttribute('data-wiki-image')) {
    const name = src.getAttribute('name') ?? '';
    if (name && name.length <= 255 && !IMAGE_NAME_BAD.test(name)) {
      dest.appendChild(el(st, 'span', { 'data-wiki-image': '', name }));
    }
    return true;
  }
  if (src.hasAttribute('data-wiki-panel')) {
    const raw = src.getAttribute('type') ?? '';
    const type = PANEL_TYPES.has(raw) ? raw : 'panel';
    const attrs: Record<string, string> = { 'data-wiki-panel': '', 'data-type': type, type };
    const params = src.getAttribute('params') ?? '';
    const title = /^title=([^}|\n\r]+)$/.exec(params)?.[1];
    if (title) attrs.params = `title=${title}`;
    const panel = el(st, 'div', attrs);
    dest.appendChild(panel);
    convertChildren(src, panel, st, inTable);
    return true;
  }
  return false;
}

/** Collapse converted cell content to text segments (block boundaries become breaks). */
function collect(parent: Node, segs: Node[][]): void {
  let cur: Node[] = [];
  const flush = () => {
    if (cur.length > 0) segs.push(cur);
    cur = [];
  };
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 1 && BLOCKISH.has((child as Element).localName)) {
      flush();
      collect(child, segs);
    } else cur.push(child);
  }
  flush();
}

function handleTable(src: HTMLTableElement, dest: Node, st: State): void {
  const table = el(st, 'table');
  const body = el(st, 'tbody');
  table.appendChild(body);
  for (const row of Array.from(src.rows)) {
    const tr = el(st, 'tr');
    for (const cell of Array.from(row.cells)) {
      const tmp = el(st, 'div');
      convertChildren(cell, tmp, st, true);
      const segs: Node[][] = [];
      collect(tmp, segs);
      const p = el(st, 'p');
      let first = true;
      for (const seg of segs) {
        const blank = seg.every((n) => n.nodeType === 3 && !(n.textContent ?? '').trim());
        if (blank) continue;
        if (!first) p.appendChild(el(st, 'br'));
        first = false;
        for (const n of seg) p.appendChild(n);
      }
      const td = el(st, cell.localName === 'th' ? 'th' : 'td');
      td.appendChild(p);
      tr.appendChild(td);
    }
    if (tr.childNodes.length > 0) body.appendChild(tr);
  }
  if (body.childNodes.length > 0) dest.appendChild(table);
}

function handleLink(src: Element, dest: Node, st: State, inTable: boolean): boolean {
  const href = src.getAttribute('href');
  const safe = href ? normalizeLinkUrl(href) : null;
  if (!safe || !isSafeLinkUrl(safe)) return false;
  const a = el(st, 'a', { href: safe });
  dest.appendChild(a);
  convertChildren(src, a, st, inTable);
  return true;
}

function convertNode(node: Node, dest: Node, st: State, inTable: boolean): void {
  if (node.nodeType === 3) {
    dest.appendChild(st.out.createTextNode((node as Text).data));
    return;
  }
  if (node.nodeType !== 1) return;
  const src = node as Element;
  const tag = src.localName.toLowerCase();
  if (DROP.has(tag)) return;
  if (handleMarker(src, dest, st, inTable)) return;
  if (tag === 'br') {
    dest.appendChild(el(st, 'br'));
    return;
  }
  if (tag === 'img') {
    handleImage(src, dest, st);
    return;
  }
  if (tag === 'pre') {
    handlePre(src, dest, st);
    return;
  }
  if (tag === 'table') {
    if (inTable) {
      const p = el(st, 'p');
      p.appendChild(st.out.createTextNode((src.textContent ?? '').replace(/\s+/g, ' ').trim()));
      dest.appendChild(p);
    } else handleTable(src as HTMLTableElement, dest, st);
    return;
  }
  if (tag === 'a' && handleLink(src, dest, st, inTable)) return;

  const transparentBold =
    (tag === 'b' || tag === 'strong') &&
    (/^docs-internal-guid/.test(src.getAttribute('id') ?? '') ||
      /^(normal|400)$/i.test(styleMap(src).get('font-weight') ?? ''));
  const outTag = tag === 'a' || transparentBold ? undefined : KEEP[tag];
  let target: Node = dest;
  if (outTag) {
    const e = el(st, outTag);
    dest.appendChild(e);
    target = e;
    if (outTag === 'hr') return;
  }
  if (!STRUCTURAL.has(tag)) {
    for (const mark of styleMarks(src, tag)) target = nestMark(st, target, mark);
  }
  convertChildren(src, target, st, inTable);
}

function convertChildren(src: Node, dest: Node, st: State, inTable: boolean): void {
  for (const child of Array.from(src.childNodes)) convertNode(child, dest, st, inTable);
}

export function normalisePastedHtml(
  html: string,
  ctx: NormaliseContext = {},
): { html: string; images: PastedImage[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  applyWordRewrites(doc);
  applyJiraRewrites(doc, ctx);
  const out = doc.implementation.createHTMLDocument('');
  const st: State = { out, images: [] };
  convertChildren(doc.body, out.body, st, false);
  return { html: out.body.innerHTML, images: st.images };
}
