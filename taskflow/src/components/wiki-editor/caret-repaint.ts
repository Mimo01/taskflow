import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/** Safari / WKWebView (Tauri on macOS), not Chromium, which also says AppleWebKit. */
export const IS_WEBKIT =
  typeof navigator !== 'undefined' &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome|Chromium|Edg\//.test(navigator.userAgent);

/** DOM element of the textblock holding the caret (null at depth 0, e.g. a node selection). */
function caretBlock(view: EditorView): Node | null {
  const { $head } = view.state.selection;
  return $head.depth > 0 ? view.nodeDOM($head.before()) : null;
}

/**
 * WKWebView skips the caret repaint when an edit rebuilds the DOM around a caret that sits
 * between elements (after a hard break, in an empty line, next to ProseMirror's separator img):
 * its own mutation tracking already shifts the selection to the point ProseMirror then sets, so
 * no selectionchange fires and the caret stays painted at its old spot for 100–500ms
 * (debug: editor-caret-lags-behind; Shift+Enter, Enter on an empty line). Removing and
 * re-adding the same range after layout makes it a real change, so the caret paints in the
 * same frame as the content.
 *
 * Runs when the caret moved to another textblock or sits on an element, after a doc change.
 * Typing inside a text node paints fine and is left alone, as is IME composition.
 */
export function repaintCaret(view: EditorView, lastBlock: Node | null): Node | null {
  const block = caretBlock(view);
  if (view.composing || !view.hasFocus()) return block;
  const sel = view.dom.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return block;
  if (block === lastBlock && sel.anchorNode?.nodeType === Node.TEXT_NODE) return block;
  const range = sel.getRangeAt(0).cloneRange();
  // Flush layout first so the caret has a box to land in.
  void view.dom.getBoundingClientRect();
  sel.removeAllRanges();
  sel.addRange(range);
  return block;
}

export const WikiCaretRepaint = Extension.create({
  name: 'wikiCaretRepaint',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikiCaretRepaint'),
        view: (initial) => {
          let lastBlock = caretBlock(initial);
          return {
            update(view, prevState) {
              if (!IS_WEBKIT) return;
              // Selection-only moves (clicks, arrows) paint fine: just track the block.
              if (view.state.doc === prevState.doc) lastBlock = caretBlock(view);
              else lastBlock = repaintCaret(view, lastBlock);
            },
          };
        },
      }),
    ];
  },
});
