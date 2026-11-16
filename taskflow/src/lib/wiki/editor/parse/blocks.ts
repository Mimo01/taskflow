import type { JSONContent } from '@tiptap/core';
import type { WikiParse } from '../types';
import { parseInline } from './inline';
import { LIST_LINE, parseListRun } from './lists';
import { buildCloserIndex, type CloserIndex, findMacroSpan } from './macros';
import { detectEol, isBlankLine, normaliseEol, splitLines } from './source';

/**
 * Block scanner (Phase 97). Every construct that is not yet modelled is
 * carried as an opaque rawBlock (the cardinal rule: lossless first). Families
 * promoted by later plans: 05 lists and quotes, 06 tables and panels,
 * 08 `{color}`.
 */

const HEADING = /^h([1-6])\.([ \t]*)(.*)$/;
const RULE = /^(-{4,})[ \t]*$/;
// Plan 05 models lists via parseListRun; `bq.` stays grouped raw until Task 2,
// Plan 06 models tables.
const GROUPED_START = /^(?:bq\.|[ \t]*\|)/;

type Block = { end: number; node: JSONContent };

const raw = (lines: readonly string[], start: number, end: number): JSONContent => ({
  type: 'rawBlock',
  attrs: { raw: lines.slice(start, end).join('\n') },
});

/** A non-paragraph block starting at `i`, or null when the line is plain prose. */
function scanSpecial(lines: readonly string[], i: number, index: CloserIndex): Block | null {
  const line = lines[i] ?? '';
  const rule = RULE.exec(line);
  if (rule) return { end: i + 1, node: { type: 'horizontalRule', attrs: { src: rule[1] } } };

  const h = HEADING.exec(line);
  if (h) {
    const content = parseInline(h[3] ?? '');
    return {
      end: i + 1,
      node: {
        type: 'heading',
        attrs: { level: Number(h[1]), sep: h[2] ?? '' },
        ...(content.length > 0 ? { content } : {}),
      },
    };
  }

  const span = findMacroSpan(lines, i, index);
  if (span) {
    const c = span.code;
    if (c) {
      return {
        end: span.end,
        node: {
          type: 'codeBlock',
          attrs: {
            language: c.language,
            open: c.open,
            close: c.close,
            bodyLead: c.lead,
            bodyTail: c.tail,
          },
          ...(c.body !== '' ? { content: [{ type: 'text', text: c.body }] } : {}),
        },
      };
    }
    return { end: span.end, node: raw(lines, i, span.end) };
  }

  if (GROUPED_START.test(line)) {
    let j = i + 1;
    while (j < lines.length && !isBlankLine(lines[j] ?? '')) j++;
    return { end: j, node: raw(lines, i, j) };
  }
  return null;
}

const startsBlock = (lines: readonly string[], j: number, index: CloserIndex): boolean =>
  LIST_LINE.test(lines[j] ?? '') || scanSpecial(lines, j, index) !== null;

/** One or more top-level blocks starting at line `i` (a list run can yield several). */
function scanBlocks(lines: readonly string[], i: number, index: CloserIndex): Block[] {
  const list = parseListRun(lines, i, (j) => scanSpecial(lines, j, index) !== null);
  if (list) return list.parts;
  const special = scanSpecial(lines, i, index);
  if (special) return [special];
  let j = i + 1;
  while (j < lines.length && !isBlankLine(lines[j] ?? '') && !startsBlock(lines, j, index)) j++;
  const content = parseInline(lines.slice(i, j).join('\n'));
  return [
    {
      end: j,
      node: { type: 'paragraph', ...(content.length > 0 ? { content } : {}) },
    },
  ];
}

function parseUnsafe(text: string): WikiParse {
  const eol = detectEol(text);
  const norm = normaliseEol(text);
  const { lines, bodyCount, tail } = splitLines(norm);

  if (bodyCount === 0) {
    return {
      doc: {
        type: 'doc',
        attrs: { eol, tail },
        content: [{ type: 'paragraph', attrs: { gap: 0 } }],
      },
      slices: [norm],
    };
  }

  const body = lines.slice(0, bodyCount);
  const index = buildCloserIndex(body);
  const content: JSONContent[] = [];
  const slices: string[] = [];
  let i = 0;
  while (i < bodyCount) {
    const gapStart = i;
    while (i < bodyCount && isBlankLine(body[i] ?? '')) i++;
    let from = i;
    for (const block of scanBlocks(body, i, index)) {
      const first = from === i;
      content.push({
        ...block.node,
        attrs: { ...block.node.attrs, gap: first ? i - gapStart : 0 },
      });
      slices.push(
        (slices.length > 0 ? '\n' : '') +
          (first
            ? body
                .slice(gapStart, i)
                .map((l) => `${l}\n`)
                .join('')
            : '') +
          body.slice(from, block.end).join('\n'),
      );
      from = block.end;
    }
    i = from;
  }
  const last = slices.length - 1;
  slices[last] += lines
    .slice(bodyCount)
    .map((l) => `\n${l}`)
    .join('');
  return { doc: { type: 'doc', attrs: { eol, tail }, content }, slices };
}

/** Parses wiki text into a lossless document. Never throws. */
export function parseWiki(text: string): WikiParse {
  try {
    return parseUnsafe(text);
  } catch {
    const eol = detectEol(text);
    const norm = normaliseEol(text);
    return {
      doc: {
        type: 'doc',
        attrs: { eol, tail: 0 },
        content: [{ type: 'rawBlock', attrs: { raw: norm, gap: 0 } }],
      },
      slices: [norm],
    };
  }
}
