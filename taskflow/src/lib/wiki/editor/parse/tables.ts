import type { JSONContent } from '@tiptap/core';
import { parseInline } from './inline';
import { isPanelParams } from './panels';
import { isBlankLine } from './source';

/**
 * Table run parser (Phase 97, Plan 06). Mirrors the renderer's row rules
 * (open-row merge with the same 50 line cap and even panel-tag count). Every
 * form the renderer handles heuristically is returned as null, which the
 * caller keeps as a rawBlock (D-10): mixed `||`/`|` rows, unescaped `{code}` in a cell,
 * indented rows, rows that never close, trailing whitespace after a row.
 * Single pass per row; no regex with nested quantifiers (T-97-18).
 */

type Block = { end: number; node: JSONContent };

const PANEL_TAG_RE = /\{(?:panel|info|note|warning|tip)(?::[^}]*)?\}/g;
const MAX_LOOKAHEAD = 50;
/** Opener not preceded by an odd backslash run (same rule as preprocess.ts). */
const CELL_PANEL_OPENER = /(?<!(?<!\\)(?:\\\\)*\\)\{(panel|info|note|warning|tip)(?::([^}]*))?\}/g;
const UNESCAPED_CODE_OPENER = /(?<!(?<!\\)(?:\\\\)*\\)\{(?:code|noformat)/;

function trimEnd(s: string): string {
  let e = s.length;
  while (e > 0 && (s[e - 1] === ' ' || s[e - 1] === '\t')) e--;
  return e === s.length ? s : s.slice(0, e);
}

const tagCount = (s: string): number => (s.match(PANEL_TAG_RE) ?? []).length;

/** Joined text of the row starting at `i` and the exclusive end line, or null. */
function collectRow(lines: readonly string[], i: number): { text: string; end: number } | null {
  const first = lines[i] ?? '';
  const t = trimEnd(first);
  if (t.startsWith('||'))
    return t === first && t.endsWith('|') ? { text: first, end: i + 1 } : null;
  if (t.endsWith('|')) return t === first ? { text: first, end: i + 1 } : null;
  const buf = [first];
  let count = tagCount(first);
  let j = i + 1;
  while (j < lines.length && j - i <= MAX_LOOKAHEAD) {
    const raw = lines[j] ?? '';
    const next = trimEnd(raw);
    buf.push(raw);
    count += tagCount(next);
    j++;
    if (next.endsWith('|') && count % 2 === 0) {
      return next === raw ? { text: buf.join('\n'), end: j } : null;
    }
  }
  return null;
}

/** Index after the panel span opening at `i`, 0 when none opens, -1 when it never closes. */
function panelSpanEnd(text: string, i: number): number {
  const re = /\{(panel|info|note|warning|tip)(?::[^}]*)?\}/y;
  re.lastIndex = i;
  const m = re.exec(text);
  if (!m) return 0;
  const close = `{${m[1]}}`;
  const at = text.indexOf(close, i + m[0].length);
  return at === -1 ? -1 : at + close.length;
}

/** Splits a row into separators and raw cell texts, or null when it is not clean. */
function splitRow(text: string): { seps: string[]; cells: string[] } | null {
  const n = text.length;
  const seps: string[] = [];
  const cells: string[] = [];
  const readSep = (pos: number): number => {
    let e = pos;
    while (e < n && text[e] === '|') e++;
    return e;
  };
  let i = readSep(0);
  if (i > 2 || i === 0) return null;
  seps.push(i === 2 ? '||' : '|');
  let start = i;
  let depth = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      if (depth > 0) depth--;
    } else if (ch === '{') {
      const e = panelSpanEnd(text, i);
      if (e === -1) return null;
      if (e > 0) {
        i = e;
        continue;
      }
    } else if (ch === '|' && depth === 0) {
      const e = readSep(i);
      if (e - i > 2) return null;
      cells.push(text.slice(start, i));
      seps.push(e - i === 2 ? '||' : '|');
      i = e;
      start = e;
      continue;
    }
    i++;
  }
  if (start !== n || cells.length === 0) return null;
  return { seps, cells };
}

const para = (text: string): JSONContent => {
  const content = parseInline(text);
  return { type: 'paragraph', attrs: { gap: 0 }, ...(content.length > 0 ? { content } : {}) };
};

const isWs = (c: string | undefined): boolean => c === ' ' || c === '\t' || c === '\n';

function cellPanel(name: string, params: string | undefined, body: string): JSONContent {
  let a = 0;
  while (a < body.length && isWs(body[a])) a++;
  let b = body.length;
  while (b > a && isWs(body[b - 1])) b--;
  const lead = body.slice(0, a);
  const tail = a === body.length ? '' : body.slice(b);
  return {
    type: 'panel',
    attrs: { type: name, params: params ?? null, bodyLead: lead, bodyTail: tail },
    content: [para(body.slice(a, b))],
  };
}

/** Blocks of one cell: paragraphs of prose around panel nodes. Null when unmodellable. */
function cellBlocks(content: string): JSONContent[] | null {
  const out: JSONContent[] = [];
  let pos = 0;
  // A backslash-escaped `\{` is text, not a cell panel opener (97-16, SAFE-06).
  // Only an ODD backslash run escapes the opener; an even run is a real opener (WR-02).
  for (const m of content.matchAll(CELL_PANEL_OPENER)) {
    const at = m.index ?? 0;
    if (at < pos) continue;
    const name = m[1] as string;
    if (!isPanelParams(m[2])) return null;
    const bodyStart = at + m[0].length;
    const closeAt = content.indexOf(`{${name}}`, bodyStart);
    if (closeAt === -1) return null;
    const body = content.slice(bodyStart, closeAt);
    if (body.includes(`{${name}:`)) return null;
    if (at > pos) out.push(para(content.slice(pos, at)));
    out.push(cellPanel(name, m[2], body));
    pos = closeAt + name.length + 2;
  }
  if (pos < content.length || out.length === 0) out.push(para(content.slice(pos)));
  return out;
}

function parseCell(raw: string, header: boolean): JSONContent | null {
  if (UNESCAPED_CODE_OPENER.test(raw) || /[ \t]\n/.test(raw)) return null;
  let a = 0;
  while (a < raw.length && (raw[a] === ' ' || raw[a] === '\t')) a++;
  let b = raw.length;
  while (b > a && (raw[b - 1] === ' ' || raw[b - 1] === '\t')) b--;
  const blocks = cellBlocks(raw.slice(a, b));
  if (!blocks) return null;
  return {
    type: header ? 'tableHeader' : 'tableCell',
    attrs: { padL: raw.slice(0, a), padR: a === raw.length ? '' : raw.slice(b) },
    content: blocks,
  };
}

function parseRow(text: string): JSONContent | null {
  const split = splitRow(text);
  if (!split) return null;
  const header = split.seps[0] === '||';
  if (split.seps.some((s) => (s === '||') !== header)) return null; // mixed row
  const cells: JSONContent[] = [];
  for (const raw of split.cells) {
    const cell = parseCell(raw, header);
    if (!cell) return null;
    cells.push(cell);
  }
  return { type: 'tableRow', attrs: { indent: '', close: null }, content: cells };
}

/**
 * The table whose first row is `lines[start]` (which must begin with `|`), or
 * null when any row is not cleanly modellable. The run must be followed by a
 * blank line or the end of the body.
 */
export function parseTableRun(lines: readonly string[], start: number): Block | null {
  const rows: JSONContent[] = [];
  let j = start;
  while (j < lines.length && (lines[j] ?? '').startsWith('|')) {
    const r = collectRow(lines, j);
    if (!r) return null;
    const row = parseRow(r.text);
    if (!row) return null;
    rows.push(row);
    j = r.end;
  }
  if (j < lines.length && !isBlankLine(lines[j] ?? '')) return null;
  const headerless = rows[0]?.content?.[0]?.type !== 'tableHeader';
  return { end: j, node: { type: 'table', attrs: { headerless }, content: rows } };
}

/** A prose line the renderer may split into an inline single-line table (D-10). */
export const looksLikeInlineTable = (line: string): boolean =>
  / \|(?::?-+:?\|){2,}(?=\s|$)/.test(line) || /\|\|[^|]+\|\| \|/.test(line);
