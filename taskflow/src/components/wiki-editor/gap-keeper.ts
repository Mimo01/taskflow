import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * The first top-level block has gap 0 (no leading blank line). Wrapping or retyping it
 * (quote, list, heading) creates a node whose `gap` attr defaults to 1, which would save
 * a stray leading newline. Carry the old first block's gap onto the replacement.
 */
export const WikiGapKeeper = Extension.create({
  name: 'wikiGapKeeper',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikiGapKeeper'),
        appendTransaction: (trs, oldState, newState) => {
          if (!trs.some((t) => t.docChanged)) return null;
          const before = oldState.doc.firstChild;
          const after = newState.doc.firstChild;
          if (!before || !after || before.type === after.type) return null;
          const gap = before.attrs.gap;
          if (typeof gap !== 'number' || after.attrs.gap === gap) return null;
          if (newState.doc.childCount < oldState.doc.childCount) return null;
          return newState.tr.setNodeMarkup(0, undefined, { ...after.attrs, gap });
        },
      }),
    ];
  },
});
