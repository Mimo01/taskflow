/**
 * editor-log-view — pure helpers for Developer Tools → Editor: an aligned side-by-side line
 * diff, a readable outline of the save check's block projection, and locating a block's saved
 * text inside the produced markup.
 */
import { diffLines } from 'diff';

export type DiffKind = 'same' | 'removed' | 'added';

export interface DiffCell {
  /** 1-based line number in its own text. */
  n: number;
  text: string;
  kind: DiffKind;
}

/** One visual row: left = old text, right = new text; a missing side is a gap. */
export interface DiffRow {
  left: DiffCell | null;
  right: DiffCell | null;
}

const splitLines = (value: string): string[] => {
  const lines = value.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
};

/** Side-by-side rows: unchanged lines pair up, removed lines pair with the added lines after. */
export function sideBySide(oldText: string, newText: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let l = 0;
  let r = 0;
  let removed: string[] = [];
  const flush = (added: string[]) => {
    const count = Math.max(removed.length, added.length);
    for (let i = 0; i < count; i++) {
      const a = removed[i];
      const b = added[i];
      rows.push({
        left: a === undefined ? null : { n: ++l, text: a, kind: 'removed' },
        right: b === undefined ? null : { n: ++r, text: b, kind: 'added' },
      });
    }
    removed = [];
  };
  for (const part of diffLines(oldText, newText)) {
    const lines = splitLines(part.value);
    if (part.removed) {
      removed.push(...lines);
    } else if (part.added) {
      flush(lines);
    } else {
      flush([]);
      for (const line of lines) {
        rows.push({
          left: { n: ++l, text: line, kind: 'same' },
          right: { n: ++r, text: line, kind: 'same' },
        });
      }
    }
  }
  flush([]);
  return rows;
}

/** 1-based inclusive line range of `slice` inside `text`, or null when not found. */
export function lineRangeOf(text: string, slice: string | null): [number, number] | null {
  const needle = slice?.replace(/\n+$/, '');
  if (!needle) return null;
  const at = text.indexOf(needle);
  if (at < 0) return null;
  const start = text.slice(0, at).split('\n').length;
  return [start, start + needle.split('\n').length - 1];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function marksSuffix(marks: unknown): string {
  const list = Array.isArray(marks)
    ? marks.map(String)
    : typeof marks === 'string' && marks
      ? marks.split('|')
      : [];
  return list.length > 0 ? `  [${list.join(', ')}]` : '';
}

/** One inline token of the save check's projection: text run, line break or atom. */
function tokenLine(tok: unknown): string {
  if (typeof tok === 'string') return JSON.stringify(tok);
  if (isObj(tok)) {
    if ('text' in tok) return `${JSON.stringify(tok.text)}${marksSuffix(tok.marks)}`;
    if ('br' in tok) return `⏎ line break${marksSuffix(tok.br)}`;
    if ('atom' in tok) return `◆ ${String(tok.atom)}${marksSuffix(tok.marks)}`;
  }
  return JSON.stringify(tok);
}

const CHILD_KEYS = ['inline', 'body', 'items', 'rows'] as const;

function outlineInto(node: unknown, depth: number, out: string[]): void {
  const pad = '  '.repeat(depth);
  if (Array.isArray(node)) {
    for (const child of node) outlineInto(child, depth, out);
    return;
  }
  if (!isObj(node)) {
    out.push(pad + JSON.stringify(node));
    return;
  }
  if ('inline' in node && !('type' in node)) {
    // A flattened paragraph run inside a list item / table cell.
    for (const tok of node.inline as unknown[]) out.push(pad + tokenLine(tok));
    return;
  }
  if (!('type' in node) && 'header' in node) {
    out.push(`${pad}cell${node.header ? ' (header)' : ''}`);
    outlineInto(node.body, depth + 1, out);
    return;
  }
  const attrs = Object.entries(node)
    .filter(([k]) => k !== 'type' && !(CHILD_KEYS as readonly string[]).includes(k))
    .map(([k, v]) => `${k}=${typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)}`);
  out.push(`${pad}${String(node.type ?? '?')}${attrs.length ? ` ${attrs.join(' ')}` : ''}`);
  if (Array.isArray(node.inline))
    for (const tok of node.inline) out.push(`${pad}  ${tokenLine(tok)}`);
  if (Array.isArray(node.body)) outlineInto(node.body, depth + 1, out);
  if (Array.isArray(node.items)) {
    node.items.forEach((item, i) => {
      out.push(`${pad}  item ${i + 1}`);
      outlineInto(item, depth + 2, out);
    });
  }
  if (Array.isArray(node.rows)) {
    node.rows.forEach((row, i) => {
      out.push(`${pad}  row ${i + 1}`);
      outlineInto(row, depth + 2, out);
    });
  }
}

/**
 * Readable outline of a block projection (one inline token per line so a line diff points at
 * the exact run that changed), e.g. `heading level=1` / `  "Title"  [strong]`.
 */
export function outlineShape(shape: unknown): string {
  if (shape === null || shape === undefined) return '(nothing at this position)';
  const out: string[] = [];
  outlineInto(shape, 0, out);
  return out.join('\n');
}
