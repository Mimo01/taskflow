import type { JSONContent } from '@tiptap/core';
import { parseInline } from './inline';
import { isBlankLine } from './source';

/**
 * List run parser (Phase 97, Plan 05). A run is a maximal sequence of list
 * lines (`*`/`#` marker runs or a single `-`) plus lazy continuation lines.
 * Nesting follows the marker run: a run of length n needs a parent whose run
 * is its (n-1)-prefix, the same rule the D-01 renderer applies. Anything
 * ambiguous (a skipped depth, `-` below depth 1) is returned as one rawBlock
 * for the whole run (never a guessed structure). Iterative, no recursion per
 * depth (T-97-15).
 */

/** Matches a list line: indent, marker run, separator whitespace. */
export const LIST_LINE = /^([ \t]*)([*#]+|-)([ \t]+)/;

export type ListPart = { node: JSONContent; end: number };

type Entry = { run: string; prefix: string; text: string[] };

const asList = (run: string): 'bulletList' | 'orderedList' =>
  run.endsWith('#') ? 'orderedList' : 'bulletList';

function build(entries: readonly Entry[]): JSONContent[] | null {
  const tops: JSONContent[] = [];
  const stack: { item: JSONContent }[] = [];
  let prev = '';
  for (const e of entries) {
    const n = e.run.length;
    if (n > 1 && (n > prev.length + 1 || e.run.slice(0, n - 1) !== prev.slice(0, n - 1)))
      return null;
    stack.length = n - 1;
    const container: JSONContent[] =
      n === 1 ? tops : ((stack[n - 2] as { item: JSONContent }).item.content as JSONContent[]);
    const marker = e.run === '-' ? '-' : e.run.slice(-1);
    const type = asList(e.run);
    let list = container[container.length - 1];
    if (!(list && list.type === type && list.attrs?.marker === marker)) {
      list = { type, attrs: { marker }, content: [] };
      container.push(list);
    }
    const inline = parseInline(e.text.join('\n'));
    const item: JSONContent = {
      type: 'listItem',
      attrs: { prefix: e.prefix },
      content: [{ type: 'paragraph', ...(inline.length > 0 ? { content: inline } : {}) }],
    };
    (list.content as JSONContent[]).push(item);
    stack.push({ item });
    prev = e.run;
  }
  return tops;
}

/**
 * Parses the list run starting at `start`. `stopAt(j)` says whether line j
 * begins another block (so it is not a continuation). Returns null when the
 * line is not a list line.
 */
export function parseListRun(
  lines: readonly string[],
  start: number,
  stopAt: (j: number) => boolean = () => false,
): { parts: ListPart[]; end: number } | null {
  if (!LIST_LINE.test(lines[start] ?? '')) return null;
  const entries: Entry[] = [];
  const entryEnd: number[] = [];
  let j = start;
  while (j < lines.length) {
    const line = lines[j] ?? '';
    if (isBlankLine(line)) break;
    const m = LIST_LINE.exec(line);
    if (m) {
      entries.push({ run: m[2] ?? '', prefix: m[0], text: [line.slice(m[0].length)] });
      entryEnd.push(j + 1);
    } else if (stopAt(j)) {
      break;
    } else {
      (entries[entries.length - 1] as Entry).text.push(line);
      entryEnd[entryEnd.length - 1] = j + 1;
    }
    j++;
  }
  const tops = build(entries);
  if (!tops) {
    return {
      parts: [
        {
          node: { type: 'rawBlock', attrs: { raw: lines.slice(start, j).join('\n') } },
          end: j,
        },
      ],
      end: j,
    };
  }
  // Each top-level list ends where its last entry ends.
  const parts: ListPart[] = [];
  let k = 0;
  for (const top of tops) {
    k += countItems(top);
    parts.push({ node: top, end: entryEnd[k - 1] as number });
  }
  return { parts, end: j };
}

function countItems(list: JSONContent): number {
  let n = 0;
  const todo: JSONContent[] = [list];
  while (todo.length > 0) {
    const cur = todo.pop() as JSONContent;
    if (cur.type === 'listItem') n++;
    for (const c of cur.content ?? []) todo.push(c);
  }
  return n;
}
