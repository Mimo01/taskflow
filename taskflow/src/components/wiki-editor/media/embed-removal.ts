import { type Editor, Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import { WIKI_TOGGLE_META } from '../editor-session';
import { getHost } from '../host';
import { getSessionUploads } from './upload-plugin';

/*
 * D-10: deleting the embed of a file uploaded in this editing session offers to delete the
 * attachment too. Detection only runs on user doc-changing transactions: never on mode toggle,
 * value reset (addToHistory false), or undo/redo (history meta). Staged embeds never qualify
 * because they are not in the session-uploads map.
 */

export interface RemovalNotice {
  filename: string;
  attachmentId: string;
}

interface RemovalMeta {
  dismiss?: boolean;
}

export const removalKey = new PluginKey<RemovalNotice | null>('wikiEmbedRemoval');

/** prosemirror-history tags undo/redo transactions with its PluginKey("history") meta. */
const HISTORY_META = 'history$';

function nameCounts(doc: PMNode): Map<string, number> {
  const counts = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name === 'image' || node.type.name === 'attachment') {
      const n = node.attrs.name;
      if (typeof n === 'string') counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  });
  return counts;
}

export function getRemovalNotice(state: EditorState): RemovalNotice | null {
  return removalKey.getState(state) ?? null;
}

export function dismissRemovalNotice(editor: Editor): void {
  if (editor.isDestroyed || !getRemovalNotice(editor.state)) return;
  const meta: RemovalMeta = { dismiss: true };
  editor.view.dispatch(editor.state.tr.setMeta(removalKey, meta).setMeta('addToHistory', false));
}

export const WikiEmbedRemoval = Extension.create({
  name: 'wikiEmbedRemoval',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<RemovalNotice | null>({
        key: removalKey,
        state: {
          init: () => null,
          apply(tr, prev, oldState, newState) {
            if ((tr.getMeta(removalKey) as RemovalMeta | undefined)?.dismiss) return null;
            if (tr.getMeta(HISTORY_META) !== undefined) {
              if (prev && nameCounts(newState.doc).has(prev.filename)) return null;
              return prev;
            }
            if (
              !tr.docChanged ||
              tr.getMeta(WIKI_TOGGLE_META) ||
              tr.getMeta('addToHistory') === false
            ) {
              return prev;
            }
            const before = nameCounts(oldState.doc);
            const after = nameCounts(newState.doc);
            const sessionUploads = getSessionUploads(oldState);
            let next = prev;
            for (const name of before.keys()) {
              if ((after.get(name) ?? 0) > 0) continue;
              const attachmentId = sessionUploads.get(name);
              if (!attachmentId) continue;
              if (getHost(editor).isReferencedElsewhere?.(name)) continue;
              next = { filename: name, attachmentId };
            }
            return next;
          },
        },
      }),
    ];
  },
});
