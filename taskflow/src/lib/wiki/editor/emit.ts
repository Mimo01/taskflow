import type { JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
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

type Segment = { text: string; verbatim: boolean };

const prose = (text: string): Segment => ({ text, verbatim: false });
const verbatim = (text: string): Segment => ({ text, verbatim: true });

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

/** Plain text of a node, the safe fallback for constructs with no emitter yet. */
function textOf(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}

function nodeSegments(n: JSONContent): Segment[] {
  const out: Segment[] = [];
  switch (n.type) {
    case 'text':
      out.push(prose(n.text ?? ''));
      break;
    case 'hardBreak':
      out.push(prose(str(n.attrs?.src, '\n')));
      break;
    case 'rawInline':
      out.push(verbatim(str(n.attrs?.raw, '')));
      break;
    case 'emoticon':
    case 'escape':
      out.push(prose(str(n.attrs?.src, '')));
      break;
    case 'mention':
      out.push(prose(str(n.attrs?.src, `[~${str(n.attrs?.id, '')}]`)));
      break;
    case 'image': {
      const params = str(n.attrs?.params, '');
      out.push(
        prose(str(n.attrs?.src, `!${str(n.attrs?.name, '')}${params ? `|${params}` : ''}!`)),
      );
      break;
    }
    case 'attachment': {
      const label = str(n.attrs?.label, '');
      out.push(
        prose(
          str(
            n.attrs?.src,
            label ? `[${label}|^${str(n.attrs?.name, '')}]` : `[^${str(n.attrs?.name, '')}]`,
          ),
        ),
      );
      break;
    }
    default:
      out.push(prose(textOf(n)));
  }
  return out;
}

type MarkJSON = { type: string; attrs?: Record<string, unknown> };

/** Nesting preference for marks of equal extent and no recorded span (user-created). */
const MARK_RANK = ['link', 'bold', 'italic', 'strike', 'underline', 'sup', 'sub', 'cite', 'mono'];

const markKey = (m: MarkJSON): string => `${m.type}\u0000${JSON.stringify(m.attrs ?? {})}`;

/** Opening delimiter of a mark; the closer depends on the run text for links. */
function markDelims(m: MarkJSON, runText: string): [string, string] {
  const a = m.attrs ?? {};
  if (m.type === 'link') {
    const href = str(a.href, '');
    return a.form === 'bare' && runText === href ? ['[', ']'] : ['[', `|${href}]`];
  }
  const canon = CANONICAL_DELIMS[m.type as keyof typeof CANONICAL_DELIMS] ?? ['', ''];
  return [str(a.open, canon[0]), str(a.close, canon[1])];
}

/**
 * Inline content with marks: delimiters are opened around maximal runs of
 * equally-marked children. Longer spans nest outside; equal extents use the
 * recorded parse order (`span`), then a fixed rank.
 */
function inlineSegments(nodes: readonly JSONContent[] | undefined): Segment[] {
  const kids = nodes ?? [];
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
    out.push(...nodeSegments(kid));
  });
  closeTo(0);
  return out;
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
      } else {
        if (i > 0) out.push(prose('\n'));
        out.push(...inlineSegments(kid.content));
      }
    });
  }
  return out;
}

/** Wiki text of a container body: blocks with their recorded gaps. */
function bodyText(blocks: readonly JSONContent[]): string {
  let out = '';
  blocks.forEach((block, i) => {
    const gap = i === 0 ? 0 : Number(block.attrs?.gap ?? 1);
    out += `${i > 0 ? '\n' : ''}${'\n'.repeat(gap)}${emitBlockNode(block)}`;
  });
  return out;
}

function quoteSegments(node: JSONContent): Segment[] {
  const a = node.attrs ?? {};
  const kids = node.content ?? [];
  const lead = str(a.bodyLead, ' ');
  const single = kids.length === 1 && kids[0]?.type === 'paragraph';
  if (a.form !== 'macro' && single) {
    return [prose(`bq.${/^[ \t]*$/.test(lead) ? lead : ' '}`), ...inlineSegments(kids[0]?.content)];
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
      out.push(...inlineSegments(kid.content));
      prevPara = true;
    } else {
      out.push(kid.type === 'panel' ? panelSegments(kid)[0] : prose(textOf(kid)));
      prevPara = false;
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
      out.push(prose(sep + str(ca.padL, '')), ...cellSegments(cell), prose(str(ca.padR, '')));
    }
    out.push(prose(str(row.attrs?.close, sep)));
  });
  return out;
}

function blockSegments(node: JSONContent): Segment[] {
  const a = node.attrs ?? {};
  switch (node.type) {
    case 'paragraph':
      return inlineSegments(node.content);
    case 'heading':
      return [
        prose(`h${Number(a.level ?? 1)}.${str(a.sep, ' ')}`),
        ...inlineSegments(node.content),
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
      const open = str(a.open, language ? `{code:${language}}` : '{code}');
      const close = str(a.close, '{code}');
      const body = (node.content ?? []).map(textOf).join('');
      return [verbatim(open + str(a.bodyLead, '\n') + body + str(a.bodyTail, '\n') + close)];
    }
    case 'rawBlock':
      return [verbatim(str(a.raw, ''))];
    default:
      return [prose(textOf(node))];
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
export function emitBlockNode(node: JSONContent | PMNode): string {
  return render(blockSegments(toJSON(node)));
}

export function emitWiki(doc: JSONContent | PMNode): string {
  const json = toJSON(doc);
  const blocks = json.content ?? [];
  let out = '';
  blocks.forEach((block, i) => {
    const gap = Number(block.attrs?.gap ?? (i === 0 ? 0 : 1));
    out += `${i > 0 ? '\n' : ''}${'\n'.repeat(gap)}${emitBlockNode(block)}`;
  });
  out += '\n'.repeat(Number(json.attrs?.tail ?? 0));
  return json.attrs?.eol === 'crlf' ? out.replace(/\n/g, '\r\n') : out;
}
