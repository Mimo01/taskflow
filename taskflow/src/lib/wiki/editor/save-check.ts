import { unspellableReason } from './escape';
import { parseWiki } from './parse/blocks';
import type { WikiDocJSON } from './types';

/**
 * Save-time structural check (Phase 97, WR-01). `saveWiki` emits the edited
 * doc, then `checkSaved` re-parses that text and compares STRUCTURE with the
 * edited doc. Any difference means the emitted text would not read back as
 * what the user typed, so the save fails closed. Pure: no React, no module
 * state beyond frozen constants.
 *
 * The comparison goes through `shape()`, a projection with a small, named
 * set of normalisations (same discipline as equivalence.ts, D-06). Each rule
 * is numbered `rule N:` and has its own test. No rule may make an unspellable
 * case (intraword italic, `h1. ` typed text, `(x)`) compare equal.
 */

/** Source of one top-level block: its slice without separator, gap and tail blank lines. */
export const blockSource = (slice: string): string =>
  slice.replace(/^(?:[^\S\n]*\n)*/, '').replace(/(?:\n[ \t]*)+$/, '');

type Json = WikiDocJSON;

/** Marks that are written as delimiters around their text (rule 5). */
const DELIMITER_MARKS: ReadonlySet<string> = new Set([
  'bold',
  'italic',
  'strike',
  'underline',
  'sup',
  'sub',
  'cite',
  'color',
]);

/** One character, atom or break of an inline stream, with its marks as sorted keys. */
type Unit =
  | { k: 'c'; ch: string; marks: string[] }
  | { k: 'a'; key: string; marks: string[] }
  | { k: 'b'; marks: string[] };

const markKey = (m: { type?: string; attrs?: Record<string, unknown> | null }): string => {
  const a = m.attrs ?? {};
  switch (m.type) {
    case 'link':
      return `link:${String(a.href ?? '')}`;
    case 'color':
      return `color:${String(a.value ?? '')}`;
    default:
      return String(m.type);
  }
};

const markType = (key: string): string => key.split(':', 1)[0] as string;

const attrsOf = (n: Json): Record<string, unknown> => (n.attrs ?? {}) as Record<string, unknown>;

/** Atom identity: type plus semantic attrs only (see rule 1). */
const atomKey = (n: Json): string => {
  const a = attrsOf(n);
  switch (n.type) {
    case 'mention':
      return `mention:${String(a.id)}`;
    case 'image':
      return `image:${String(a.name)}:${String(a.params ?? '')}`;
    case 'attachment':
      return `attachment:${String(a.name)}:${String(a.label ?? '')}`;
    case 'emoticon':
      return `emoticon:${String(a.src)}`;
    case 'rawInline':
      return `rawInline:${String(a.raw)}`;
    default:
      return `${String(n.type)}:${JSON.stringify(n.content ?? null)}`;
  }
};

const marksOf = (n: Json): string[] =>
  (n.marks ?? [])
    .map((m) => markKey(m as { type?: string; attrs?: Record<string, unknown> }))
    .sort();

/** Inline units of one textblock. An escape atom is its character as text (rule 2). */
function unitsOf(block: Json): Unit[] {
  const out: Unit[] = [];
  for (const n of block.content ?? []) {
    const marks = marksOf(n);
    if (n.type === 'text') {
      for (const ch of n.text ?? '') out.push({ k: 'c', ch, marks });
    } else if (n.type === 'hardBreak') {
      out.push({ k: 'b', marks });
    } else if (n.type === 'escape') {
      const src = String(attrsOf(n).src ?? '');
      for (const ch of src.startsWith('\\') ? src.slice(1) : src) out.push({ k: 'c', ch, marks });
    } else {
      out.push({ k: 'a', key: atomKey(n), marks });
    }
  }
  return out;
}

const isBlank = (u: Unit): boolean => u.k === 'c' && (u.ch === ' ' || u.ch === '\t');

/** Rule 2 trimming plus rule 5 edge-whitespace, then merged into tokens. */
function tokens(units: Unit[]): unknown[] {
  // rule 2: spaces/tabs before each break and at the stream end are trimmed
  // (D-07: trailing whitespace is stripped on edit).
  let kept: Unit[] = [];
  for (let i = units.length - 1, trimming = true; i >= 0; i--) {
    const u = units[i] as Unit;
    if (trimming && isBlank(u)) continue;
    trimming = u.k === 'b';
    kept.push(u);
  }
  kept = kept.reverse();
  // rule 5: edge whitespace of a maximal run of a delimiter mark is compared
  // as unmarked, on both sides. 97-13 hoists it outside canonical delimiters
  // (`*hello* `); brace spellings keep it inside; either reads back equal.
  const strip = kept.map(() => new Set<string>());
  const keys = new Set<string>();
  for (const u of kept) for (const m of u.marks) if (DELIMITER_MARKS.has(markType(m))) keys.add(m);
  for (const key of keys) {
    let i = 0;
    while (i < kept.length) {
      if (!(kept[i] as Unit).marks.includes(key)) {
        i++;
        continue;
      }
      let j = i;
      while (j < kept.length && (kept[j] as Unit).marks.includes(key)) j++;
      for (let a = i; a < j && isBlank(kept[a] as Unit); a++) strip[a]?.add(key);
      for (let b = j - 1; b >= i && isBlank(kept[b] as Unit); b--) strip[b]?.add(key);
      i = j;
    }
  }
  const out: unknown[] = [];
  let last: { text: string; marks: string } | null = null;
  kept.forEach((u, idx) => {
    const marks = u.marks.filter((m) => !strip[idx]?.has(m));
    if (u.k === 'c') {
      const mk = marks.join('|');
      if (last && last.marks === mk) {
        last.text += u.ch;
        return;
      }
      last = { text: u.ch, marks: mk };
      out.push(last);
      return;
    }
    last = null;
    out.push(u.k === 'b' ? { br: marks } : { atom: u.key, marks });
  });
  return out;
}

const isEmptyPara = (n: Json): boolean => n.type === 'paragraph' && tokens(unitsOf(n)).length === 0;

/** Child blocks of a container; para/rawBlock runs flatten into one stream (rule 3). */
function children(kids: Json[] | undefined, flatten: boolean): unknown[] {
  const out: unknown[] = [];
  let run: Unit[] | null = null;
  const flush = (): void => {
    if (!run) return;
    const t = tokens(run);
    if (t.length > 0) out.push({ inline: t });
    run = null;
  };
  for (const kid of kids ?? []) {
    if (flatten && (kid.type === 'paragraph' || kid.type === 'rawBlock')) {
      // rule 3: the emitter writes item/cell paragraphs joined by a line
      // break and the parser reads them back as ONE paragraph with breaks.
      const units: Unit[] =
        kid.type === 'rawBlock'
          ? [
              {
                k: 'a',
                key: atomKey({ type: 'rawInline', attrs: { raw: attrsOf(kid).raw } }),
                marks: [],
              },
            ]
          : unitsOf(kid);
      run = run ? [...run, { k: 'b', marks: [] }, ...units] : units;
      continue;
    }
    flush();
    // rule 4: empty paragraphs are blank lines (gaps) on re-parse.
    if (isEmptyPara(kid)) continue;
    out.push(shape(kid));
  }
  flush();
  return out;
}

/** Structural projection of one block (rule 1: semantic attrs only). */
function shape(n: Json): unknown {
  const a = attrsOf(n);
  switch (n.type) {
    case 'paragraph':
      return { type: 'paragraph', inline: tokens(unitsOf(n)) };
    case 'heading':
      return { type: 'heading', level: a.level, inline: tokens(unitsOf(n)) };
    case 'horizontalRule':
      return { type: 'horizontalRule' };
    case 'bulletList':
    case 'orderedList':
      return { type: n.type, items: (n.content ?? []).map((li) => children(li.content, true)) };
    case 'blockquote':
      return { type: 'blockquote', body: children(n.content, false) };
    case 'codeBlock':
      return {
        type: 'codeBlock',
        language: a.language ?? null,
        text: (n.content ?? []).map((t) => t.text ?? '').join(''),
      };
    case 'table':
      return {
        type: 'table',
        headerless: Boolean(a.headerless),
        rows: (n.content ?? []).map((row) =>
          (row.content ?? []).map((cell) => ({
            header: cell.type === 'tableHeader',
            body: children(cell.content, true),
          })),
        ),
      };
    case 'panel':
      return {
        type: 'panel',
        panel: a.type,
        params: a.params ?? null,
        body: children(n.content, false),
      };
    case 'rawBlock':
      return { type: 'rawBlock', raw: a.raw };
    default:
      return { type: n.type, body: children(n.content, false) };
  }
}

/** First reason from `unspellableReason` over the text of a block, or null. */
function unspellableIn(block: Json): string | null {
  let found: string | null = null;
  const walk = (n: Json): void => {
    if (found) return;
    if (n.type === 'paragraph' || n.type === 'heading') {
      let lineStart = true;
      for (const c of n.content ?? []) {
        if (c.type === 'text') {
          found = unspellableReason(c.text ?? '', lineStart);
          if (found) return;
        }
        lineStart = c.type === 'hardBreak';
      }
      return;
    }
    for (const c of n.content ?? []) walk(c);
  };
  walk(block);
  return found;
}

/**
 * Re-parse `emitted` and compare with `current`. Returns null when the text
 * reads back as the same structure, else the reason the save must not proceed.
 */
export function checkSaved(current: WikiDocJSON, emitted: string): string | null {
  let parsed: ReturnType<typeof parseWiki>;
  try {
    parsed = parseWiki(emitted);
  } catch (err) {
    return `the emitted text does not parse: ${err instanceof Error ? err.message : String(err)}`;
  }
  const cur = (current.content ?? []).filter((b) => !isEmptyPara(b));
  const back: { block: Json; slice: string }[] = [];
  (parsed.doc.content ?? []).forEach((block, i) => {
    if (!isEmptyPara(block)) back.push({ block, slice: parsed.slices[i] ?? '' });
  });
  if (cur.length !== back.length)
    return `the saved text has ${back.length} top-level blocks, the edit has ${cur.length}`;
  for (let i = 0; i < cur.length; i++) {
    const want = cur[i] as Json;
    const got = back[i] as { block: Json; slice: string };
    if (want.type === 'rawBlock') {
      const raw = attrsOf(want).raw;
      if (
        (got.block.type === 'rawBlock' && attrsOf(got.block).raw === raw) ||
        blockSource(got.slice) === raw
      )
        continue;
    } else if (JSON.stringify(shape(want)) === JSON.stringify(shape(got.block))) continue;
    const why = unspellableIn(want);
    return why
      ? `block ${i}: ${why}`
      : `block ${i} (${String(want.type)}) does not read back as the edited structure`;
  }
  return null;
}
