import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Cmd+Left / Cmd+Right: move the caret to the line boundary of the current textblock.
 * (Phase 96 found WKWebView doing nothing on the first press after a programmatic selection,
 * so the editor binds it explicitly.)
 *
 * Semantics: the visual line boundary, found by measuring (coordsAtPos + posAtCoords at the
 * textblock's edge on the caret's line), which matches native macOS in wrapped paragraphs.
 * When layout can't be measured (zero rects as in jsdom, or a throw) it falls back to the
 * logical line: the nearest hardBreak before/after the caret, else the textblock start/end.
 * The result is clamped to the textblock. `extend` keeps the anchor (Shift variants).
 * Returns false (native handling) for non-text selections and non-textblock parents.
 * LTR only (wiki text).
 */
export function moveToLineBoundary(view: EditorView, dir: -1 | 1, extend: boolean): boolean {
  const { selection, doc } = view.state;
  if (!(selection instanceof TextSelection)) return false;
  const resolvedHead = selection.$head;
  if (!resolvedHead.parent.isTextblock) return false;
  const start = resolvedHead.start();
  const end = resolvedHead.end();
  const head = selection.head;

  let target: number | null = null;
  try {
    const coords = view.coordsAtPos(head);
    const dom = view.nodeDOM(resolvedHead.before());
    if (dom instanceof Element && coords.bottom > coords.top) {
      const rect = dom.getBoundingClientRect();
      if (rect.width > 0) {
        const hit = view.posAtCoords({
          left: dir < 0 ? rect.left + 1 : rect.right - 1,
          top: (coords.top + coords.bottom) / 2,
        });
        if (hit) target = hit.pos;
      }
    }
  } catch {
    target = null;
  }

  if (target === null) {
    const headOffset = head - start;
    let before = 0;
    let after = resolvedHead.parent.content.size;
    resolvedHead.parent.forEach((child, offset) => {
      if (child.type.name !== 'hardBreak') return;
      if (offset + child.nodeSize <= headOffset) before = offset + child.nodeSize;
      else if (offset >= headOffset && after === resolvedHead.parent.content.size) after = offset;
    });
    target = start + (dir < 0 ? before : after);
  }

  const clamped = Math.max(start, Math.min(end, target));
  const anchor = extend ? selection.anchor : clamped;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(doc, anchor, clamped)).scrollIntoView(),
  );
  return true;
}
