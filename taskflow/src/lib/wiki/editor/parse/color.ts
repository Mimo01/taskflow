import type { JSONContent } from '@tiptap/core';
import { isBlankLine } from './source';

/**
 * `{color:X}` support (Phase 97). The value gate keeps untrusted text out of
 * the CSS context Phase 98 will use (`style=`, T-97-27): only a hex colour or
 * a bare name is ever modelled; any other value stays a raw atom.
 */

export const COLOR_VALUE = /^(#[0-9a-fA-F]{3,8}|[A-Za-z]+)$/;
export const COLOR_CLOSE = '{color}';
/** Opener with any non-empty value, matching what the renderer treats as an opener. */
export const COLOR_OPEN = /^\{color:([^}\n]+)\}/;

export const isSafeColor = (value: string): boolean => COLOR_VALUE.test(value);

type ScanBody = (body: readonly string[]) => { content: JSONContent[]; slices: string[] };
type Pos = readonly [line: number, col: number];

/**
 * A `{color:X}` span that crosses lines or blank lines, as paragraph/heading
 * blocks each carrying a color mark that shares one span id (D-09). Returns
 * null (the caller keeps the raw block) unless the opener starts a line, the
 * closer ends a line, both text parts are non-blank, the value is safe and
 * every covered block is a plain paragraph or heading.
 */
export function parseColorSpan(
  lines: readonly string[],
  i: number,
  closer: Pos | null,
  scanBody: ScanBody,
): { end: number; blocks: { node: JSONContent; end: number; gap: number }[] } | null {
  const line = lines[i] ?? '';
  const m = COLOR_OPEN.exec(line);
  if (!m || !closer) return null;
  const value = m[1] ?? '';
  const [k, col] = closer;
  if (!isSafeColor(value) || k <= i) return null;
  const closeLine = lines[k] ?? '';
  if (closeLine.length !== col + COLOR_CLOSE.length) return null;
  const body = lines.slice(i, k + 1);
  body[0] = line.slice(m[0].length);
  body[body.length - 1] = closeLine.slice(0, col);
  if (isBlankLine(body[0] ?? '') || isBlankLine(body[body.length - 1] ?? '')) return null;
  const { content, slices } = scanBody(body);
  if (content.length === 0 || content[0]?.type !== 'paragraph') return null;
  if (!content.every((b) => b.type === 'paragraph' || b.type === 'heading')) return null;
  const span = `c${i}`;
  if (content.some((b) => (b.content ?? []).length === 0)) return null;
  let end = i;
  const blocks = content.map((b, n) => {
    const newlines = (slices[n] ?? '').split('\n').length - 1;
    end += n === 0 ? newlines + 1 : newlines;
    const node: JSONContent = {
      ...b,
      content: (b.content ?? []).map((c) => ({
        ...c,
        marks: [
          { type: 'color', attrs: { value, open: n === 0 ? m[0] : null, span } },
          ...(c.marks ?? []),
        ],
      })),
    };
    return { node, end, gap: Number(b.attrs?.gap ?? 0) };
  });
  if (end !== k + 1) return null;
  return { end, blocks };
}
