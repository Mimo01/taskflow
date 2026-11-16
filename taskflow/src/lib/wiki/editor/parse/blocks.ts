import type { JSONContent } from '@tiptap/core';
import type { WikiParse } from '../types';
import { COLOR_OPEN, parseColorSpan } from './color';
import { parseInline } from './inline';
import { LIST_LINE, parseListRun } from './lists';
import { buildCloserIndex, type CloserIndex, findMacroSpan } from './macros';
import { parsePanel } from './panels';
import { detectEol, isBlankLine, normaliseEol, splitLines } from './source';
import { looksLikeInlineTable, parseTableRun } from './tables';

/**
 * Block scanner (Phase 97). Every construct that is not yet modelled is
 * carried as an opaque rawBlock (the cardinal rule: lossless first). Families
 * promoted by later plans: 05 lists and quotes, 06 tables and panels,
 * 08 `{color}`.
 */

const BQ = /^bq\.([ \t]*)(.*)$/;
const QUOTE_OPEN = '{quote}';
const HEADING = /^h([1-6])\.([ \t]*)(.*)$/;
const RULE = /^(-{4,})[ \t]*$/;
// Lists, quotes, panels and tables are modelled; indented or unclean rows stay raw.
const GROUPED_START = /^[ \t]*\|/;

type Block = { end: number; node: JSONContent; gap?: number };

const raw = (lines: readonly string[], start: number, end: number): JSONContent => ({
  type: 'rawBlock',
  attrs: { raw: lines.slice(start, end).join('\n') },
});

/**
 * A `{quote}` span as a blockquote, or null when it cannot be modelled
 * without guessing: parameters, text after the closer, or a nested opener.
 */
function quoteBlock(
  lines: readonly string[],
  i: number,
  span: { end: number; closer?: readonly [number, number] },
): Block | null {
  const line = lines[i] ?? '';
  if (!line.startsWith(QUOTE_OPEN) || !span.closer) return null;
  const [k, col] = span.closer;
  const closeLine = lines[k] ?? '';
  if (closeLine.length !== col + QUOTE_OPEN.length) return null;
  const body =
    k === i
      ? line.slice(QUOTE_OPEN.length, col)
      : [line.slice(QUOTE_OPEN.length), ...lines.slice(i + 1, k), closeLine.slice(0, col)].join(
          '\n',
        );
  if (body.includes('{quote:')) return null;
  const parsed = parseContainerBody(body);
  return {
    end: span.end,
    node: {
      type: 'blockquote',
      attrs: { form: 'macro', bodyLead: parsed.bodyLead, bodyTail: parsed.bodyTail },
      content: parsed.content,
    },
  };
}

/**
 * Parses the text between a macro opener and its closer into blocks.
 * `bodyLead` is the leading whitespace up to and including the last newline of
 * the leading blank area, `bodyTail` the trailing newline plus blank area, so
 * `bodyLead + emitted body + bodyTail` rebuilds the source. Reused by panels.
 */
export function parseContainerBody(src: string): {
  content: JSONContent[];
  bodyLead: string;
  bodyTail: string;
} {
  const isWs = (c: string): boolean => c === ' ' || c === '\t' || c === '\n';
  let a = 0;
  while (a < src.length && isWs(src[a] as string)) a++;
  if (a === src.length) {
    return { content: [{ type: 'paragraph', attrs: { gap: 0 } }], bodyLead: src, bodyTail: '' };
  }
  const lead = src.lastIndexOf('\n', a - 1) + 1; // 0 when no newline in the prefix
  let b = src.length;
  while (b > 0 && isWs(src[b - 1] as string)) b--;
  const nl = src.indexOf('\n', b);
  const tailAt = nl === -1 ? b : nl;
  const body = src.slice(lead, tailAt);
  const { content } = scanBody(body.split('\n'));
  return { content, bodyLead: src.slice(0, lead), bodyTail: src.slice(tailAt) };
}

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

  const bq = BQ.exec(line);
  if (bq) {
    let j = i + 1;
    while (j < lines.length && !isBlankLine(lines[j] ?? '') && !startsBlock(lines, j, index)) j++;
    const text = [bq[2] ?? '', ...lines.slice(i + 1, j)].join('\n');
    const inline = parseInline(text);
    return {
      end: j,
      node: {
        type: 'blockquote',
        attrs: { form: 'bq', bodyLead: bq[1] ?? '', bodyTail: '' },
        content: [{ type: 'paragraph', ...(inline.length > 0 ? { content: inline } : {}) }],
      },
    };
  }

  const span = findMacroSpan(lines, i, index);
  if (span) {
    // A closed `{color}` on its own line is inline prose, not a block.
    if (span.closer?.[0] === i && COLOR_OPEN.test(line)) return null;
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
    const quote = quoteBlock(lines, i, span);
    if (quote) return quote;
    const panel = parsePanel(lines, i, span, parseContainerBody);
    if (panel) return panel;
    return { end: span.end, node: raw(lines, i, span.end) };
  }

  if (GROUPED_START.test(line)) {
    const table = parseTableRun(lines, i);
    if (table) return table;
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
  if (COLOR_OPEN.test(lines[i] ?? '')) {
    const sp = findMacroSpan(lines, i, index);
    const color = parseColorSpan(lines, i, sp?.closer ?? null, scanBody);
    if (color) {
      return color.blocks;
    }
  }
  const special = scanSpecial(lines, i, index);
  if (special) return [special];
  let j = i + 1;
  while (j < lines.length && !isBlankLine(lines[j] ?? '') && !startsBlock(lines, j, index)) j++;
  if (lines.slice(i, j).some(looksLikeInlineTable)) return [{ end: j, node: raw(lines, i, j) }];
  const content = parseInline(lines.slice(i, j).join('\n'));
  return [
    {
      end: j,
      node: { type: 'paragraph', ...(content.length > 0 ? { content } : {}) },
    },
  ];
}

/** Scans body lines into top-level blocks (with gaps) and their source slices. */
function scanBody(body: readonly string[]): { content: JSONContent[]; slices: string[] } {
  const bodyCount = body.length;
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
      const g = first ? i - gapStart : (block.gap ?? 0);
      const gapFrom = first ? gapStart : from;
      const textFrom = first ? i : from + g;
      content.push({ ...block.node, attrs: { ...block.node.attrs, gap: g } });
      slices.push(
        (slices.length > 0 ? '\n' : '') +
          body
            .slice(gapFrom, textFrom)
            .map((l) => `${l}\n`)
            .join('') +
          body.slice(textFrom, block.end).join('\n'),
      );
      from = block.end;
    }
    i = from;
  }
  return { content, slices };
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

  const { content, slices } = scanBody(lines.slice(0, bodyCount));
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
