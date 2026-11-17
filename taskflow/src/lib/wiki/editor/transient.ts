import type { Node as PMNode } from '@tiptap/pm/model';
import type { WikiDocJSON } from './types';

/**
 * The transient rule (SAFE-05): an empty list item has no wiki spelling (`* ` reads back as a
 * paragraph), so it is a shape the user passes through while typing, never a finished edit.
 * `withoutEmptyListItems` prunes empty items, and lists left with no items, from a doc.
 * `saveWiki` runs it before the no-op check, the emit and `checkSaved`, so the emitted text
 * is always proven to read back as the pruned doc. The only content not carried is an empty
 * bullet, which can't be written anyway. The editor keeps its own doc, so the user can still
 * type into the empty item.
 *
 * Pure: no React, no module state. Returns the SAME instance when nothing was pruned.
 */

type Json = WikiDocJSON;

const isEmptyPara = (n: Json): boolean =>
  n.type === 'paragraph' &&
  (n.content ?? []).every((c) => c.type === 'text' && !(c.text ?? '').trim());

const isEmptyItem = (item: Json): boolean => (item.content ?? []).every(isEmptyPara);

type Pruned = { node: Json | null; changed: boolean; gap?: unknown };

function prune(node: Json): Pruned {
  if (!node.content) return { node, changed: false };
  let changed = false;
  let firstDroppedGap: unknown;
  const kids: Json[] = [];
  for (const child of node.content) {
    const r = prune(child);
    if (r.changed) changed = true;
    if (r.node) kids.push(r.node);
    else if (firstDroppedGap === undefined) firstDroppedGap = child.attrs?.gap;
  }
  if (node.type === 'listItem') {
    const next = { ...node, content: kids };
    if (isEmptyItem(next)) return { node: null, changed: true };
    return { node: changed ? next : node, changed };
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    if (kids.length === 0) return { node: null, changed: true, gap: node.attrs?.gap };
    return { node: changed ? { ...node, content: kids } : node, changed };
  }
  if (!changed) return { node, changed: false };
  if (kids.length === 0) {
    const attrs = firstDroppedGap === undefined ? undefined : { gap: firstDroppedGap };
    kids.push(attrs ? { type: 'paragraph', attrs } : { type: 'paragraph' });
  }
  return { node: { ...node, content: kids }, changed: true };
}

export function withoutEmptyListItems(doc: PMNode): PMNode {
  const json = doc.toJSON() as Json;
  const blocks = json.content ?? [];
  const out: Json[] = [];
  let changed = false;
  let leadGap: unknown;
  let droppedFirst = false;
  blocks.forEach((block, i) => {
    const r = prune(block);
    if (r.changed) changed = true;
    if (r.node) {
      out.push(r.node);
      return;
    }
    if (i === 0) {
      droppedFirst = true;
      leadGap = r.gap ?? block.attrs?.gap;
    }
  });
  if (!changed) return doc;
  if (out.length === 0) {
    out.push({ type: 'paragraph', attrs: { gap: leadGap ?? 0 } });
  } else if (droppedFirst && out[0] && leadGap !== undefined) {
    // The new first block takes the dropped list's gap, so no leading blank line appears.
    out[0] = { ...out[0], attrs: { ...out[0].attrs, gap: leadGap } };
  }
  return doc.type.schema.nodeFromJSON({ ...json, content: out });
}
