import type { WikiEol } from '../types';

/**
 * Source normalisation helpers (Phase 97, D-06). Pure, no module state.
 */

/** 'crlf' when CRLF endings outnumber bare LF endings, else 'lf' (D-06). */
export function detectEol(text: string): WikiEol {
  let crlf = 0;
  let bare = 0;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
    if (i > 0 && text.charCodeAt(i - 1) === 13) crlf++;
    else bare++;
  }
  return crlf > bare ? 'crlf' : 'lf';
}

/** CRLF and lone CR become LF. */
export function normaliseEol(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export const isBlankLine = (line: string): boolean => /^[ \t]*$/.test(line);

export type SplitLines = {
  /** All lines of the LF text. */
  lines: string[];
  /** Number of lines belonging to the body (up to the last non-blank line); 0 when all blank. */
  bodyCount: number;
  /** Number of `\n` after the last character of the last non-blank line. */
  tail: number;
};

export function splitLines(text: string): SplitLines {
  const lines = text.split('\n');
  let last = lines.length - 1;
  while (last >= 0 && isBlankLine(lines[last] ?? '')) last--;
  if (last < 0) return { lines, bodyCount: 0, tail: lines.length - 1 };
  return { lines, bodyCount: last + 1, tail: lines.length - 1 - last };
}
