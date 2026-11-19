import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Two rules keep the blank-line spelling (`gap`) safe.
 *
 * 1. The first top-level block has gap 0 (no leading blank line). Wrapping or retyping it
 *    (quote, list, heading) creates a node whose `gap` attr defaults to 1, which would save
 *    a stray leading newline. Carry the old first block's gap onto the replacement.
 * 2. When a block is added (Enter split, lift out of a list, multi-block paste), a fresh
 *    top-level block at index > 0 that carries gap 0 is given gap 1. A mid-block split or
 *    Enter at the start copies the node attrs whatever `keepOnSplit` says, and gap 0 would
 *    join the two paragraphs into one on re-parse. A blank line always reads back as a block
 *    boundary. The rule only fires when the block count grows, so loaded gap-0 spellings stay
 *    byte-identical while the user types inside them. A gap-0 block that is itself split
 *    ends up with gap 1 on both halves, which reads back correctly.
 * 3. A paragraph that newly sits right after another paragraph with gap 0 is given gap 1,
 *    at any depth, whatever the block count does: turning a heading into a paragraph above
 *    a gap-0 paragraph, or deleting the block between two. Without a blank line the two
 *    emit as one line run and re-parse as ONE paragraph, failing the save check. Pairs
 *    that were already adjacent (loaded spellings) are left alone.
 */
export const WikiGapKeeper = Extension.create({
  name: 'wikiGapKeeper',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikiGapKeeper'),
        appendTransaction: (trs, oldState, newState) => {
          if (!trs.some((t) => t.docChanged)) return null;
          const tr = newState.tr;
          let changed = false;

          const before = oldState.doc.firstChild;
          const after = newState.doc.firstChild;
          if (
            before &&
            after &&
            before.type !== after.type &&
            newState.doc.childCount >= oldState.doc.childCount
          ) {
            const gap = before.attrs.gap;
            if (typeof gap === 'number' && after.attrs.gap !== gap) {
              tr.setNodeMarkup(0, undefined, { ...after.attrs, gap });
              changed = true;
            }
          }

          if (newState.doc.childCount > oldState.doc.childCount) {
            const old = new Set<PMNode>();
            oldState.doc.forEach((n) => {
              old.add(n);
            });
            newState.doc.forEach((node, offset, index) => {
              if (index === 0 || node.attrs.gap !== 0 || old.has(node)) return;
              tr.setNodeMarkup(offset, undefined, { ...node.attrs, gap: 1 });
              changed = true;
            });
          }
          // Every block parent with the position its content starts at (doc: 0).
          const parents = (doc: PMNode): [PMNode, number][] => {
            const out: [PMNode, number][] = [[doc, 0]];
            doc.descendants((n, pos) => {
              if (n.isTextblock) return false;
              out.push([n, pos + 1]);
              return true;
            });
            return out;
          };
          const wasAfter = new Map<PMNode, PMNode>();
          for (const [n] of parents(oldState.doc)) {
            let prev: PMNode | null = null;
            n.forEach((kid) => {
              if (prev) wasAfter.set(kid, prev);
              prev = kid;
            });
          }
          // Attr-only setNodeMarkup keeps positions, so newState offsets hold for tr.
          for (const [n, start] of parents(newState.doc)) {
            let prev: PMNode | null = null;
            n.forEach((kid, offset) => {
              if (
                prev?.type.name === 'paragraph' &&
                kid.type.name === 'paragraph' &&
                kid.attrs.gap === 0 &&
                wasAfter.get(kid) !== prev
              ) {
                tr.setNodeMarkup(start + offset, undefined, { ...kid.attrs, gap: 1 });
                changed = true;
              }
              prev = kid;
            });
          }
          return changed ? tr : null;
        },
      }),
    ];
  },
});
