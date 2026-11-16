import { COLOR_CLOSE, isSafeColor } from './color';

/**
 * Inline mark recognition (Phase 97, D-05). The rules mirror what the renderer
 * itself shows (jira2md plus preprocess.ts), so the editor shows a mark only
 * where WikiRenderer does. Every matcher works on a per-line "mask" string in
 * which atoms and links are a single opaque `\x01` character, and returns the
 * recorded delimiter spelling. Closers are found by next-occurrence lookups
 * only (no nested scans), so a line is processed in time linear in its length
 * per nesting level (T-97-26). Module state is frozen constants only.
 */

export type MarkType =
  | 'color'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'underline'
  | 'sup'
  | 'sub'
  | 'mono';

/** Delimiter spelling of a mark when the user creates it (D-08). */
export const CANONICAL_DELIMS: Readonly<
  Record<MarkType | 'cite', readonly [open: string, close: string]>
> = Object.freeze({
  color: ['{color}', '{color}'], // placeholder: the emitter writes `{color:value}`…`{color}`
  bold: ['*', '*'],
  italic: ['_', '_'],
  strike: ['-', '-'],
  underline: ['+', '+'],
  sup: ['^', '^'],
  sub: ['~', '~'],
  cite: ['??', '??'],
  mono: ['{{', '}}'],
});

/** Brace spellings `{*}x{*}`: opener text and the mark it produces. */
const BRACE_FORMS: ReadonlyArray<readonly [string, MarkType]> = Object.freeze([
  ['{*}', 'bold'],
  ['{_}', 'italic'],
  ['{-}', 'strike'],
  ['{+}', 'underline'],
  ['{^}', 'sup'],
  ['{~}', 'sub'],
]);

export type MarkSpan = {
  mark: MarkType;
  open: string;
  close: string;
  /** Content range [cs, ce) and the index just after the closer. */
  cs: number;
  ce: number;
  end: number;
  /** Content of this mark is literal (monospace): no nested marks. */
  literal: boolean;
  /** Color value (color marks only). */
  value?: string;
};

export type LineScan = {
  mask: string;
  /** Valid strike closers, ascending. */
  strikeClosers: number[];
  /** stopNext[i]: first index >= i holding `*` or `_` (mask length when none). */
  stopNext: Int32Array;
};

const WORD = /[\p{L}\p{N}_]/u;
const isSpace = (c: string | undefined): boolean => c !== undefined && /\s/.test(c);
const nonSpace = (c: string | undefined): boolean => c !== undefined && !/\s/.test(c);

export function scanLine(mask: string): LineScan {
  const n = mask.length;
  const stopNext = new Int32Array(n + 1);
  stopNext[n] = n;
  for (let i = n - 1; i >= 0; i--) {
    const c = mask[i];
    stopNext[i] = c === '*' || c === '_' ? i : (stopNext[i + 1] as number);
  }
  const strikeClosers: number[] = [];
  for (let j = 1; j < n; j++) {
    if (mask[j] !== '-') continue;
    const p = mask[j - 1];
    const q = mask[j + 1];
    if (!nonSpace(p) || p === '*' || p === '_') continue;
    if (q === undefined || isSpace(q) || q === '*' || q === '_') strikeClosers.push(j);
  }
  return { mask, strikeClosers, stopNext };
}

function lowerBound(arr: readonly number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((arr[mid] as number) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function span(
  mark: MarkType,
  open: string,
  close: string,
  cs: number,
  ce: number,
  literal = false,
): MarkSpan {
  return { mark, open, close, cs, ce, end: ce + close.length, literal };
}

/**
 * The mark opening at `i` with its closer before `e`, or null. `s` is the start
 * of the enclosing range (lookbehind never looks before the line start).
 */
export function matchMark(scan: LineScan, i: number, e: number): MarkSpan | null {
  const m = scan.mask;
  const c = m[i];
  if (c === '{') {
    if (m.startsWith('{color:', i)) {
      const q = m.indexOf('}', i + 7);
      const value = q > i + 7 ? m.slice(i + 7, q) : '';
      if (q !== -1 && isSafeColor(value)) {
        const j = m.indexOf(COLOR_CLOSE, q + 1);
        if (j > q + 1 && j + COLOR_CLOSE.length <= e) {
          return { ...span('color', m.slice(i, q + 1), COLOR_CLOSE, q + 1, j), value };
        }
      }
      return null;
    }
    if (m.startsWith('{{{', i)) {
      let p = i + 3;
      let open = '{{{';
      if (m[p] === '}') {
        open = '{{{}';
        p++;
      }
      const j = m.indexOf('}}}', p);
      if (j !== -1 && j > p) {
        const brace = m[j - 1] === '{' && j - 1 > p;
        const ce = brace ? j - 1 : j;
        if (ce + (brace ? 4 : 3) <= e) {
          return span('mono', open, brace ? '{}}}' : '}}}', p, ce, true);
        }
      }
    }
    for (const [open, mark] of BRACE_FORMS) {
      if (!m.startsWith(open, i)) continue;
      const j = m.indexOf(open, i + 3);
      if (j > i + 3 && j + 3 <= e) return span(mark, open, open, i + 3, j);
    }
    if (m.startsWith('{{', i) && m[i + 2] !== undefined && m[i + 2] !== ' ' && m[i + 2] !== '\t') {
      const j = m.indexOf('}', i + 2);
      if (j > i + 2 && m[j + 1] === '}' && j + 2 <= e)
        return span('mono', '{{', '}}', i + 2, j, true);
    }
    return null;
  }
  if (c === '*') {
    if (m[i - 1] === '*') return null;
    const j = m.indexOf('*', i + 1);
    if (j <= i + 1 || j >= e) return null;
    if (!nonSpace(m[i + 1]) || !nonSpace(m[j - 1]) || m[j + 1] === '*') return null;
    return span('bold', '*', '*', i + 1, j);
  }
  if (c === '_') {
    if (i > 0 && WORD.test(m[i - 1] as string)) return null;
    const j = m.indexOf('_', i + 1);
    if (j <= i + 1 || j >= e) return null;
    if (!nonSpace(m[i + 1]) || !nonSpace(m[j - 1])) return null;
    const after = m[j + 1];
    if (after !== undefined && WORD.test(after)) return null;
    return span('italic', '_', '_', i + 1, j);
  }
  if (c === '+') {
    if (m[i - 1] === '+') return null;
    const j = m.indexOf('+', i + 1);
    if (j <= i + 1 || j >= e) return null;
    if (!nonSpace(m[i + 1]) || !nonSpace(m[j - 1]) || m[j + 1] === '+') return null;
    return span('underline', '+', '+', i + 1, j);
  }
  if (c === '^' || c === '~') {
    const j = m.indexOf(c, i + 1);
    if (j <= i + 1 || j >= e) return null;
    return span(c === '^' ? 'sup' : 'sub', c, c, i + 1, j);
  }
  if (c === '-') {
    const p = m[i - 1];
    if (i > 0 && !(isSpace(p) || p === '*' || p === '_')) return null;
    const first = m[i + 1];
    if (!nonSpace(first) || first === '*' || first === '_') return null;
    const k = lowerBound(scan.strikeClosers, i + 3);
    const j = scan.strikeClosers[k];
    if (j === undefined || j >= e || j >= (scan.stopNext[i + 1] as number)) return null;
    return span('strike', '-', '-', i + 1, j);
  }
  return null;
}
