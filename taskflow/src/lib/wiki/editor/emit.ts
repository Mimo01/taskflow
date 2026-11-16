import type { JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { type EscapeContext, escapeSites, escapeText } from './escape';
import { parseWiki } from './parse/blocks';
import { COLOR_OPEN } from './parse/color';
import { CANONICAL_DELIMS } from './parse/marks';

/**
 * Spelling-replaying emitter (Phase 97). Walks a document and rebuilds wiki
 * text from the recorded spellings (D-05); user-created nodes with no recorded
 * spelling use canonical forms (D-08). Pure, no module state.
 *
 * D-06: the detected majority line ending is restored at the very end.
 * D-07: trailing whitespace is stripped on prose lines only, never inside
 * code bodies or raw atoms.
 */

/** Thrown when a document holds a shape wiki text cannot express; saving must fail closed. */
export class WikiEmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WikiEmitError';
  }
}

type Segment = { text: string; verbatim: boolean };

const prose = (text: string): Segment => ({ text, verbatim: false });
const verbatim = (text: string): Segment => ({ text, verbatim: true });

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

/** Plain text of a node, the safe fallback for constructs with no emitter yet. */
function textOf(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}

type InlineCtx = 'para' | 'heading' | 'item' | 'quote' | 'cell';

/** Spelling of a hard break: a raw newline would split a cell, heading or quote, so those use `\\\\`. */
function breakSpelling(n: JSONContent, ctx: InlineCtx): string {
  const src = typeof n.attrs?.src === 'string' ? n.attrs.src : null;
  // A recorded `\n` is a parsed continuation (open table row, multi-line quote) and stays as
  // written; only a break with no recorded spelling is rewritten inside a line-bound block.
  const lineBound = ctx === 'cell' || ctx === 'heading' || ctx === 'quote';
  if (lineBound && src === null) return '\\\\';
  return src ?? '\n';
}

/** Attributes that carry an atom's meaning (the rest of its attrs only record spelling). */
const SEMANTIC: Record<string, readonly string[]> = {
  mention: ['id'],
  image: ['name', 'params'],
  attachment: ['name', 'label'],
};

/**
 * True while a recorded `src` still spells the node's current attributes: the
 * source is re-parsed and its semantic attributes compared. After an attribute
 * edit the recorded spelling is stale and the canonical form must be written.
 */
function stillSpells(n: JSONContent, src: string): boolean {
  const keys = SEMANTIC[n.type ?? ''] ?? [];
  const blocks = parseWiki(src).doc.content ?? [];
  const p = blocks[0];
  const inline = p?.type === 'paragraph' && p.content?.length === 1 ? p.content[0] : undefined;
  if (blocks.length !== 1 || !inline || inline.type !== n.type) return false;
  return keys.every((k) => str(inline.attrs?.[k], '') === str(n.attrs?.[k], ''));
}

/** A recorded color opener is reused only while it still names the mark's value. */
const colorOpen = (open: unknown, value: string): string => {
  const m = typeof open === 'string' ? COLOR_OPEN.exec(open) : null;
  return typeof open === 'string' && m && m[0] === open && m[1] === value
    ? open
    : `{color:${value}}`;
};

const spelled = (n: JSONContent, canonical: string): string => {
  const src = n.attrs?.src;
  return typeof src === 'string' && stillSpells(n, src) ? src : canonical;
};

function nodeSegments(n: JSONContent, ctx: InlineCtx = 'para'): Segment[] {
  const out: Segment[] = [];
  switch (n.type) {
    case 'text':
      out.push(prose(n.text ?? ''));
      break;
    case 'hardBreak':
      out.push(prose(breakSpelling(n, ctx)));
      break;
    case 'rawInline':
      out.push(verbatim(str(n.attrs?.raw, '')));
      break;
    case 'emoticon':
    case 'escape':
      out.push(prose(str(n.attrs?.src, '')));
      break;
    case 'mention':
      out.push(prose(spelled(n, `[~${str(n.attrs?.id, '')}]`)));
      break;
    case 'image': {
      const params = str(n.attrs?.params, '');
      out.push(prose(spelled(n, `!${str(n.attrs?.name, '')}${params ? `|${params}` : ''}!`)));
      break;
    }
    case 'attachment': {
      const label = str(n.attrs?.label, '');
      out.push(
        prose(
          spelled(
            n,
            label ? `[${label}|^${str(n.attrs?.name, '')}]` : `[^${str(n.attrs?.name, '')}]`,
          ),
        ),
      );
      break;
    }
    default:
      throw new WikiEmitError(`cannot emit inline node type "${String(n.type)}"`);
  }
  return out;
}

type MarkJSON = { type: string; attrs?: Record<string, unknown> };

/** Nesting preference for marks of equal extent and no recorded span (user-created). */
const MARK_RANK = [
  'color',
  'link',
  'bold',
  'italic',
  'strike',
  'underline',
  'sup',
  'sub',
  'cite',
  'mono',
];

const markKey = (m: MarkJSON): string => `${m.type}\u0000${JSON.stringify(m.attrs ?? {})}`;

/** Opening delimiter of a mark; the closer depends on the run text for links. */
function markDelims(m: MarkJSON, runText: string): [string, string] {
  const a = m.attrs ?? {};
  if (m.type === 'color') {
    return [colorOpen(a.open, str(a.value, '')), '{color}'];
  }
  if (m.type === 'link') {
    const href = str(a.href, '');
    return a.form === 'bare' && runText === href ? ['[', ']'] : ['[', `|${href}]`];
  }
  const canon = CANONICAL_DELIMS[m.type as keyof typeof CANONICAL_DELIMS] ?? ['', ''];
  return [str(a.open, canon[0]), str(a.close, canon[1])];
}

/**
 * The canonical flank-sensitive marks: `*x*`, `_x_`, `+x+`, `-x-` are not read as
 * marks when the text next to a delimiter is a space. Brace spellings (`{*}`,
 * parse/marks.ts BRACE_FORMS), `^ x ^`, `~ x ~` and `{color:..}` (parse/color.ts
 * only rejects blank bodies) accept edge spaces, so those are never rewritten.
 */
const HOIST_TYPES = new Set(['bold', 'italic', 'underline', 'strike']);

function hoistable(m: MarkJSON): boolean {
  if (!HOIST_TYPES.has(m.type)) return false;
  const canon = CANONICAL_DELIMS[m.type as keyof typeof CANONICAL_DELIMS];
  const a = m.attrs ?? {};
  return (
    (a.open === undefined || a.open === null || a.open === canon[0]) &&
    (a.close === undefined || a.close === null || a.close === canon[1])
  );
}

const withoutMark = (k: JSONContent, key: string): JSONContent => {
  const marks = (k.marks ?? []).filter((m) => markKey(m) !== key);
  const { marks: _old, ...rest } = k;
  return marks.length ? { ...rest, marks } : rest;
};

/** Moves leading/trailing spaces and tabs of a hoistable mark's run outside its delimiters (copy, never mutates). */
function hoistEdgeSpace(input: readonly JSONContent[]): JSONContent[] {
  let kids = [...input];
  const keys = new Map<string, MarkJSON>();
  for (const k of kids) for (const m of k.marks ?? []) if (hoistable(m)) keys.set(markKey(m), m);
  for (const key of keys.keys()) {
    const has = (k: JSONContent | undefined): boolean =>
      !!k && (k.marks ?? []).some((m) => markKey(m) === key);
    // Only text carrying no other mark is peeled: a nested mark's own delimiter may sit between
    // this mark's delimiter and the space (`*~ x~*`), so the space is not edge-adjacent there.
    const onlyThis = (k: JSONContent | undefined): k is JSONContent =>
      k?.type === 'text' && (k.marks ?? []).length === 1;
    const next: JSONContent[] = [];
    let i = 0;
    while (i < kids.length) {
      if (!has(kids[i])) {
        next.push(kids[i] as JSONContent);
        i++;
        continue;
      }
      let e = i;
      while (e < kids.length && has(kids[e])) e++;
      const run = kids.slice(i, e);
      const allText = run.every(onlyThis);
      const wsOnly = allText && run.every((k) => /^[ \t]*$/.test(k.text ?? ''));
      if (wsOnly) {
        for (const k of run) next.push(withoutMark(k, key));
        i = e;
        continue;
      }
      const lead: JSONContent[] = [];
      const trail: JSONContent[] = [];
      let a = 0;
      let b = run.length;
      while (a < b && onlyThis(run[a])) {
        const t = run[a]?.text ?? '';
        const m = /^[ \t]+/.exec(t);
        if (!m) break;
        lead.push(withoutMark({ ...(run[a] as JSONContent), text: m[0] }, key));
        if (m[0].length === t.length) a++;
        else {
          run[a] = { ...(run[a] as JSONContent), text: t.slice(m[0].length) };
          break;
        }
      }
      while (b > a && onlyThis(run[b - 1])) {
        const t = run[b - 1]?.text ?? '';
        const m = /[ \t]+$/.exec(t);
        if (!m) break;
        trail.unshift(withoutMark({ ...(run[b - 1] as JSONContent), text: m[0] }, key));
        if (m[0].length === t.length) b--;
        else {
          run[b - 1] = { ...(run[b - 1] as JSONContent), text: t.slice(0, t.length - m[0].length) };
          break;
        }
      }
      next.push(...lead, ...run.slice(a, b), ...trail);
      i = e;
    }
    kids = next;
  }
  return kids;
}

/**
 * Inline content with marks: delimiters are opened around maximal runs of
 * equally-marked children. Longer spans nest outside; equal extents use the
 * recorded parse order (`span`), then a fixed rank.
 */
function markedSegments(
  nodes: readonly JSONContent[] | undefined,
  ctx: InlineCtx = 'para',
): Segment[] {
  const kids = hoistEdgeSpace(nodes ?? []);
  const keySets = kids.map((k) => new Set((k.marks ?? []).map(markKey)));
  const stack: { mark: MarkJSON; key: string; closeAt: string }[] = [];
  const out: Segment[] = [];
  const closeTo = (depth: number): void => {
    while (stack.length > depth) {
      const top = stack.pop();
      if (!top) break;
      out.push(prose(top.closeAt));
    }
  };
  kids.forEach((kid, idx) => {
    const want = keySets[idx] as Set<string>;
    const bad = stack.findIndex((e) => !want.has(e.key));
    if (bad !== -1) closeTo(bad);
    const have = new Set(stack.map((e) => e.key));
    const toOpen = (kid.marks ?? []).filter((m) => !have.has(markKey(m)));
    const spanLen = (m: MarkJSON): number => {
      const key = markKey(m);
      let n = 0;
      while (idx + n < kids.length && (keySets[idx + n] as Set<string>).has(key)) n++;
      return n;
    };
    const order = (m: MarkJSON): number => {
      const sp = m.attrs?.span;
      return typeof sp === 'number' ? sp : Number.MAX_SAFE_INTEGER;
    };
    toOpen.sort(
      (a, b) =>
        spanLen(b) - spanLen(a) ||
        order(a) - order(b) ||
        MARK_RANK.indexOf(a.type) - MARK_RANK.indexOf(b.type),
    );
    for (const m of toOpen) {
      let run = '';
      for (let n = idx; n < kids.length && (keySets[n] as Set<string>).has(markKey(m)); n++) {
        run += textOf(kids[n] as JSONContent);
      }
      const [open, close] = markDelims(m, run);
      out.push(prose(open));
      stack.push({ mark: m, key: markKey(m), closeAt: close });
    }
    out.push(...nodeSegments(kid, ctx));
  });
  closeTo(0);
  return out;
}

/** Source wrapped around inline text so the real block/cell parser sees its context. */
const WRAP: Record<InlineCtx, readonly [string, string]> = {
  para: ['', ''],
  heading: ['h1. ', ''],
  item: ['* ', ''],
  quote: ['bq. ', ''],
  cell: ['|', '|'],
};

/** The inline nodes the parser reads out of `wrapped`, or null when its structure differs. */
function reparsed(ctx: InlineCtx, wrapped: string): JSONContent[] | null {
  const blocks = parseWiki(wrapped).doc.content ?? [];
  const b = blocks[0];
  if (blocks.length !== 1 || !b) return null;
  if (ctx === 'para') return b.type === 'paragraph' ? (b.content ?? []) : null;
  if (ctx === 'heading') return b.type === 'heading' ? (b.content ?? []) : null;
  if (ctx === 'quote') {
    const p = b.type === 'blockquote' && b.content?.length === 1 ? b.content[0] : undefined;
    return p?.type === 'paragraph' ? (p.content ?? []) : null;
  }
  if (ctx === 'item') {
    const item = b.type === 'bulletList' && b.content?.length === 1 ? b.content[0] : undefined;
    const p = item?.content?.length === 1 ? item.content[0] : undefined;
    return p?.type === 'paragraph' ? (p.content ?? []) : null;
  }
  const row = b.type === 'table' && b.content?.length === 1 ? b.content[0] : undefined;
  const cell = row?.content?.length === 1 ? row.content[0] : undefined;
  const p = cell?.content?.length === 1 ? cell.content[0] : undefined;
  return p?.type === 'paragraph' ? (p.content ?? []) : null;
}

/** What a reader sees of inline nodes: characters, escape targets, atom source (marks are invisible). */
function display(nodes: readonly JSONContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text ?? '';
      if (n.type === 'escape') return str(n.attrs?.src, '').slice(1);
      if (n.type === 'hardBreak') return '\n';
      // Tag atoms by type so typed text that merely looks like one never compares equal to it.
      const spelling = nodeSegments(n)
        .map((g) => g.text)
        .join('');
      return `\u0001${n.type}:${spelling}\u0001`;
    })
    .join('');
}

const joinText = (segs: readonly Segment[]): string => segs.map((g) => g.text).join('');

/** Neighbour character for escape context ('' at a boundary, `\x01` for an atom). */
function edge(n: JSONContent | undefined, last: boolean): string {
  if (!n) return '';
  if (n.type !== 'text') return n.type === 'hardBreak' ? '' : '\x01';
  const t = n.text ?? '';
  return (last ? t[t.length - 1] : t[0]) ?? '';
}

/**
 * Inline content as wiki text. Marks come from markedSegments. Text a user
 * typed may contain markup characters: when re-parsing the plain emission in
 * its block context would not show the same characters, the sites the
 * tokenizers could read as markup are backslash-escaped, one character class
 * at a time and only where that is needed (SAFE-06). Parsed text always
 * re-parses to itself, so it is never rewritten.
 */
function inlineSegments(nodes: readonly JSONContent[] | undefined, ctx: InlineCtx): Segment[] {
  const kids = nodes ?? [];
  const plain = markedSegments(kids, ctx);
  const risky = kids.some((n) => n.type === 'text' && /[*_\-+^~{}[\]!#|(]/.test(n.text ?? ''));
  if (!risky) return plain;
  const [pre, post] = WRAP[ctx];
  const want = display(kids);
  const fits = (segs: readonly Segment[]): boolean => {
    const back = reparsed(ctx, pre + joinText(segs) + post);
    return back !== null && display(back) === want;
  };
  if (fits(plain)) return plain;
  const ctxOf = (i: number): EscapeContext => {
    const prevNode = kids[i - 1];
    return {
      lineStart:
        i === 0 || (prevNode?.type === 'hardBreak' && breakSpelling(prevNode, ctx) === '\n'),
      inCell: ctx === 'cell',
      prev: edge(prevNode, true),
      next: edge(kids[i + 1], false),
    };
  };
  const escaped = (keep: ReadonlySet<string>): JSONContent[] =>
    kids.map((n, i) =>
      n.type === 'text' && !n.marks?.some((m) => m.type === 'mono')
        ? { ...n, text: escapeText(n.text ?? '', ctxOf(i), keep) }
        : n,
    );
  const chars = new Set<string>();
  kids.forEach((n, i) => {
    if (n.type === 'text' && !n.marks?.some((m) => m.type === 'mono'))
      for (const ch of escapeSites(n.text ?? '', ctxOf(i)).keys()) chars.add(ch);
  });
  const all = markedSegments(escaped(new Set()), ctx);
  // No Jira spelling shows these characters (for example `h1. ` at a line start): leave as typed.
  if (!fits(all)) return plain;
  const keep = new Set<string>();
  for (const ch of chars) {
    keep.add(ch);
    if (!fits(markedSegments(escaped(keep), ctx))) keep.delete(ch);
  }
  return markedSegments(escaped(keep), ctx);
}

/** Marker character a list contributes to the run of its items and descendants. */
function listChar(list: JSONContent, depth: number): string {
  if (list.type === 'orderedList') return '#';
  return list.attrs?.marker === '-' && depth === 0 ? '-' : '*';
}

/** Segments of a list; `ancestors` is the marker run of the enclosing items. */
function listSegments(list: JSONContent, ancestors: string): Segment[] {
  const out: Segment[] = [];
  const char = listChar(list, ancestors.length);
  const run = ancestors + char;
  const childRun = ancestors + (char === '#' ? '#' : '*');
  let first = true;
  for (const item of list.content ?? []) {
    if (!first) out.push(prose('\n'));
    first = false;
    const recorded = item.attrs?.prefix;
    const head =
      typeof recorded === 'string' && recorded.replace(/[ \t]/g, '') === run ? recorded : `${run} `;
    out.push(prose(head));
    const kids = item.content ?? [];
    kids.forEach((kid, i) => {
      if (kid.type === 'bulletList' || kid.type === 'orderedList') {
        out.push(prose('\n'), ...listSegments(kid, childRun));
      } else if (kid.type === 'rawBlock') {
        const raw = str(kid.attrs?.raw, '');
        if (raw.includes('\n'))
          throw new WikiEmitError('cannot emit a multi-line raw block inside a list item');
        out.push(prose('\n'), verbatim(raw));
      } else if (kid.type === 'paragraph') {
        if (i > 0) out.push(prose('\n'));
        out.push(...inlineSegments(kid.content, 'item'));
      } else {
        throw new WikiEmitError(`cannot emit a ${String(kid.type)} inside a list item`);
      }
    });
  }
  return out;
}

/** Wiki text of a container body: blocks with their recorded gaps. */
function bodyText(blocks: readonly JSONContent[]): string {
  let out = '';
  const texts = blockTexts(blocks);
  blocks.forEach((block, i) => {
    const gap = i === 0 ? 0 : Number(block.attrs?.gap ?? 1);
    out += `${i > 0 ? '\n' : ''}${'\n'.repeat(gap)}${texts[i]}`;
  });
  return out;
}

function quoteSegments(node: JSONContent): Segment[] {
  const a = node.attrs ?? {};
  const kids = node.content ?? [];
  const lead = str(a.bodyLead, ' ');
  const single = kids.length === 1 && kids[0]?.type === 'paragraph';
  if (a.form !== 'macro' && single) {
    return [
      prose(`bq.${/^[ \t]*$/.test(lead) ? lead : ' '}`),
      ...inlineSegments(kids[0]?.content, 'quote'),
    ];
  }
  const recorded = a.form === 'macro';
  const l = recorded ? str(a.bodyLead, '\n') : '\n';
  const t = recorded ? str(a.bodyTail, '\n') : '\n';
  return [verbatim(`{quote}${l}${bodyText(kids)}${t}{quote}`)];
}

function panelSegments(node: JSONContent): Segment[] {
  const a = node.attrs ?? {};
  const type = str(a.type, 'panel');
  const params = typeof a.params === 'string' ? `:${a.params}` : '';
  const lead = str(a.bodyLead, '\n');
  const tail = str(a.bodyTail, '\n');
  return [verbatim(`{${type}${params}}${lead}${bodyText(node.content ?? [])}${tail}{${type}}`)];
}

/** Cell content: blocks concatenated with no separator (adjacent paragraphs get a `\\\\` break). */
function cellSegments(cell: JSONContent): Segment[] {
  const out: Segment[] = [];
  let prevPara = false;
  for (const kid of cell.content ?? []) {
    if (kid.type === 'paragraph') {
      if (prevPara) out.push(prose('\\\\'));
      out.push(...inlineSegments(kid.content, 'cell'));
      prevPara = true;
    } else if (kid.type === 'panel') {
      out.push(...panelSegments(kid));
      prevPara = false;
    } else if (kid.type === 'rawBlock') {
      const raw = str(kid.attrs?.raw, '');
      if (raw.includes('\n') || raw.includes('|'))
        throw new WikiEmitError(
          'cannot emit a raw block with a newline or pipe inside a table cell',
        );
      if (prevPara) out.push(prose('\\\\'));
      out.push(verbatim(raw));
      prevPara = false;
    } else {
      throw new WikiEmitError(`cannot emit a ${String(kid.type)} inside a table cell`);
    }
  }
  return out;
}

/** Rows in order; a headerless table writes body rows only (never a synthetic header). */
function tableSegments(table: JSONContent): Segment[] {
  const headerless = table.attrs?.headerless === true;
  const out: Segment[] = [];
  (table.content ?? []).forEach((row, ri) => {
    if (ri > 0) out.push(prose('\n'));
    let sep = '|';
    for (const cell of row.content ?? []) {
      const ca = cell.attrs ?? {};
      sep = cell.type === 'tableHeader' && !headerless ? '||' : '|';
      const body = cellSegments(cell);
      // An empty cell with no recorded padding would write `||`, which reads as a header separator.
      const empty = joinText(body) === '' && !str(ca.padL, '') && !str(ca.padR, '');
      out.push(
        prose(sep + str(ca.padL, '')),
        ...(empty ? [prose(' ')] : body),
        prose(str(ca.padR, '')),
      );
    }
    out.push(prose(str(row.attrs?.close, sep)));
  });
  return out;
}

/** A cross-block color span member: every inline node carries the same string-span color mark. */
type ColorRun = { span: string; value: string; open: string | null };

function colorRunOf(block: JSONContent): ColorRun | null {
  if (block.type !== 'paragraph' && block.type !== 'heading') return null;
  const kids = block.content ?? [];
  const first = kids[0]?.marks?.find(
    (m) => m.type === 'color' && typeof m.attrs?.span === 'string',
  );
  if (!first) return null;
  const span = first.attrs?.span as string;
  const value = str(first.attrs?.value, '');
  const same = kids.every((k) =>
    k.marks?.some((m) => m.type === 'color' && m.attrs?.span === span && m.attrs?.value === value),
  );
  if (!same) return null;
  return { span, value, open: typeof first.attrs?.open === 'string' ? first.attrs.open : null };
}

type BlockOpts = { drop?: string; open?: string; close?: string };

/** The node with the color marks of span `drop` removed from its inline children. */
function withoutSpan(node: JSONContent, drop: string): JSONContent {
  return {
    ...node,
    content: (node.content ?? []).map((k) => {
      const marks = (k.marks ?? []).filter((m) => !(m.type === 'color' && m.attrs?.span === drop));
      const { marks: _old, ...rest } = k;
      return marks.length ? { ...rest, marks } : rest;
    }),
  };
}

/** A recorded code opener is reused only while it still reads as the block's language. */
function codeOpenHolds(open: string, close: string, language: string | null): boolean {
  const b = parseWiki(`${open}\nx\n${close}`).doc.content ?? [];
  const only = b.length === 1 ? b[0] : undefined;
  if (only?.type !== 'codeBlock') return false;
  const got = typeof only.attrs?.language === 'string' ? only.attrs.language : '';
  return got === (language ?? '');
}

function blockSegments(node: JSONContent, opts: BlockOpts = {}): Segment[] {
  if (opts.drop !== undefined) {
    return [
      prose(opts.open ?? ''),
      ...blockSegments(withoutSpan(node, opts.drop)),
      prose(opts.close ?? ''),
    ];
  }
  const a = node.attrs ?? {};
  switch (node.type) {
    case 'paragraph':
      return inlineSegments(node.content, 'para');
    case 'heading':
      return [
        prose(`h${Number(a.level ?? 1)}.${str(a.sep, ' ')}`),
        ...inlineSegments(node.content, 'heading'),
      ];
    case 'blockquote':
      return quoteSegments(node);
    case 'bulletList':
    case 'orderedList':
      return listSegments(node, '');
    case 'panel':
      return panelSegments(node);
    case 'table':
      return tableSegments(node);
    case 'horizontalRule':
      return [prose(str(a.src, '----'))];
    case 'codeBlock': {
      const language = typeof a.language === 'string' && a.language !== '' ? a.language : null;
      const canonOpen = language ? `{code:${language}}` : '{code}';
      const close = str(a.close, '{code}');
      const open =
        typeof a.open === 'string' && codeOpenHolds(a.open, close, language) ? a.open : canonOpen;
      const body = (node.content ?? []).map(textOf).join('');
      return [verbatim(open + str(a.bodyLead, '\n') + body + str(a.bodyTail, '\n') + close)];
    }
    case 'rawBlock':
      return [verbatim(str(a.raw, ''))];
    default:
      throw new WikiEmitError(`cannot emit block node type "${String(node.type)}"`);
  }
}

/** D-07: strip line-end whitespace from prose segments only. */
function render(segments: readonly Segment[]): string {
  // Merge adjacent prose segments so a line break in a later segment still
  // ends the line of an earlier one.
  const merged: Segment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && !prev.verbatim && !seg.verbatim) prev.text += seg.text;
    else merged.push({ ...seg });
  }
  let out = '';
  merged.forEach((seg, i) => {
    if (seg.verbatim) {
      out += seg.text;
      return;
    }
    let t = seg.text.replace(/[ \t]+(?=\n)/g, '');
    if (i === merged.length - 1) t = t.replace(/[ \t]+$/, '');
    out += t;
  });
  return out;
}

const toJSON = (doc: JSONContent | PMNode): JSONContent =>
  'toJSON' in doc && typeof doc.toJSON === 'function'
    ? (doc.toJSON() as JSONContent)
    : (doc as JSONContent);

/** Wiki text of one top-level block, without gap or separators. */
export function emitBlockNode(node: JSONContent | PMNode, opts?: BlockOpts): string {
  return render(blockSegments(toJSON(node), opts));
}

/**
 * Text of each block. A run of two or more paragraphs/headings that share one
 * color span id (D-09) is written as one `{color:…}` opener and one `{color}`
 * closer; a run broken by an edit is written as separate pairs by the normal
 * mark path.
 */
function blockTexts(blocks: readonly JSONContent[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i] as JSONContent;
    const run = b.type === 'paragraph' ? colorRunOf(b) : null;
    let j = i + 1;
    while (run && j < blocks.length) {
      const next = colorRunOf(blocks[j] as JSONContent);
      if (!next || next.span !== run.span || next.value !== run.value) break;
      j++;
    }
    if (run && j - i >= 2) {
      const open = colorOpen(run.open, run.value);
      for (let n = i; n < j; n++) {
        out.push(
          emitBlockNode(blocks[n] as JSONContent, {
            drop: run.span,
            ...(n === i ? { open } : {}),
            ...(n === j - 1 ? { close: '{color}' } : {}),
          }),
        );
      }
    } else out.push(emitBlockNode(b));
    i = j;
  }
  return out;
}

export function emitWiki(doc: JSONContent | PMNode): string {
  const json = toJSON(doc);
  const blocks = json.content ?? [];
  let out = '';
  const texts = blockTexts(blocks);
  blocks.forEach((block, i) => {
    const gap = Number(block.attrs?.gap ?? (i === 0 ? 0 : 1));
    out += `${i > 0 ? '\n' : ''}${'\n'.repeat(gap)}${texts[i]}`;
  });
  out += '\n'.repeat(Number(json.attrs?.tail ?? 0));
  return json.attrs?.eol === 'crlf' ? out.replace(/\n/g, '\r\n') : out;
}
