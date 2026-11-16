import { isBlankLine } from './source';

/**
 * Macro segmenter (Phase 97, RESEARCH Pattern 3). Decides, for a line that
 * starts with `{name...}`, which lines form one macro span and whether the span
 * is a modelled code block or an opaque raw span (SAFE-04, D-10).
 * Pure; the closer index is built per parse call (no module state).
 */

/** Macros whose families are modelled by later plans; an unclosed one is raw. */
export const KNOWN_MACROS: ReadonlySet<string> = new Set([
  'code',
  'noformat',
  'quote',
  'panel',
  'info',
  'note',
  'warning',
  'tip',
  'color',
]);

const CODE_PARAM_KEYS = '(?:title|borderStyle|borderColor|borderWidth|bgColor|titleBGColor)';

/** `{name}` or `{name:params}` at the very start of a line. */
const OPENER = /^\{([A-Za-z][A-Za-z0-9]*)(?::[^}]*)?\}/;

/** One closer-index entry: a bare `{name}` token at (line, col). */
type Pos = readonly [line: number, col: number];
export type CloserIndex = ReadonlyMap<string, readonly Pos[]>;

export function buildCloserIndex(lines: readonly string[]): CloserIndex {
  const map = new Map<string, Pos[]>();
  const re = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
  for (let line = 0; line < lines.length; line++) {
    const text = lines[line] ?? '';
    if (!text.includes('{')) continue;
    for (const m of text.matchAll(re)) {
      const list = map.get(m[1] ?? '') ?? [];
      list.push([line, m.index ?? 0]);
      map.set(m[1] ?? '', list);
    }
  }
  return map;
}

/** First bare `{name}` at or after (line, col), or null. Binary search. */
function firstCloser(index: CloserIndex, name: string, line: number, col: number): Pos | null {
  const list = index.get(name);
  if (!list) return null;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const p = list[mid] as Pos;
    if (p[0] < line || (p[0] === line && p[1] < col)) lo = mid + 1;
    else hi = mid;
  }
  return list[lo] ?? null;
}

function codeRestOk(rest: string): boolean {
  if (rest === '') return true;
  return new RegExp(`^[:|]?${CODE_PARAM_KEYS}=.`).test(rest);
}

/**
 * jira2md's `{code…}` opener grammar, evaluated without nested quantifiers:
 * `{code(:lang)?([:|]?(title|borderStyle|…)=.+?)*}`. `inner` is the text
 * between `{code` and the first `}`.
 */
export function isCodeOpenerInner(inner: string): boolean {
  if (codeRestOk(inner)) return true;
  const m = /^:([a-z]+)/.exec(inner);
  return m !== null && codeRestOk(inner.slice(m[0].length));
}

export type CodeParts = {
  open: string;
  close: string;
  lead: string;
  body: string;
  tail: string;
  language: string | null;
};

export type MacroSpan = { end: number; code?: CodeParts };

/** Exclusive end line of the block that starts at `start` (next blank line or end). */
function blockEnd(lines: readonly string[], start: number): number {
  let j = start + 1;
  while (j < lines.length && !isBlankLine(lines[j] ?? '')) j++;
  return j;
}

/**
 * Span of the macro opened at the start of `lines[start]`, or null when the
 * line does not open a span (plain text, or an unknown macro without a closer).
 */
export function findMacroSpan(
  lines: readonly string[],
  start: number,
  index: CloserIndex = buildCloserIndex(lines),
): MacroSpan | null {
  const line = lines[start] ?? '';
  const m = OPENER.exec(line);
  if (!m) return null;
  const name = m[1] ?? '';
  const opener = m[0];
  const known = KNOWN_MACROS.has(name);

  if (name === 'code' || name === 'noformat') {
    const gateOk =
      name === 'noformat' ? opener === '{noformat}' : isCodeOpenerInner(opener.slice(5, -1));
    if (gateOk) {
      const own = firstCloser(index, name, start, opener.length);
      const other = firstCloser(index, name === 'code' ? 'noformat' : 'code', start, opener.length);
      const ownFirst =
        own !== null &&
        (other === null || own[0] < other[0] || (own[0] === other[0] && own[1] < other[1]));
      if (ownFirst && own) {
        const [k, col] = own;
        const closeToken = `{${name}}`;
        const closeLine = lines[k] ?? '';
        if (closeLine.length === col + closeToken.length) {
          const between =
            k === start
              ? line.slice(opener.length, col)
              : [
                  line.slice(opener.length),
                  ...lines.slice(start + 1, k),
                  closeLine.slice(0, col),
                ].join('\n');
          const lead = between.startsWith('\n') ? '\n' : '';
          const rest = between.slice(lead.length);
          const tail = rest.endsWith('\n') ? '\n' : '';
          const body = rest.slice(0, rest.length - tail.length);
          const lang = name === 'code' ? /^\{code:([a-z]+)\}$/.exec(opener) : null;
          return {
            end: k + 1,
            code: {
              open: opener,
              close: closeToken,
              lead,
              body,
              tail,
              language: lang?.[1] ?? null,
            },
          };
        }
        return { end: k + 1 };
      }
    }
    // Opener outside the grammar, mismatched closer, or unclosed: raw span.
    const same = firstCloser(index, name, start, opener.length);
    return { end: same ? same[0] + 1 : blockEnd(lines, start) };
  }

  const closer = firstCloser(index, name, start, opener.length);
  if (closer) return { end: closer[0] + 1 };
  return known ? { end: blockEnd(lines, start) } : null;
}
