import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

export type PanelType = 'panel' | 'info' | 'note' | 'warning' | 'tip';

/** Remove characters that would break out of a `{panel:title=…}` opener; trim. */
export function sanitizePanelTitle(s: string): string {
  return s.replace(/[}|\r\n]/g, '').trim();
}

export function paramsFromTitle(title: string): string | null {
  return title === '' ? null : `title=${title}`;
}

export function titleFromParams(params: string | null | undefined): string {
  return typeof params === 'string' && params.startsWith('title=') ? params.slice(6) : '';
}

export function setPanelTitle(editor: Editor, pos: number, title: string): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== 'panel') return false;
  const params = paramsFromTitle(sanitizePanelTitle(title));
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, params }));
  return true;
}

export function setPanelType(editor: Editor, pos: number, type: PanelType): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== 'panel') return false;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, type }));
  return true;
}

/**
 * Replace the panel with its body: one transaction, one undo step.
 *
 * Inner blocks carry gaps relative to the panel (the first is usually 0). Lifted to the top level
 * the first takes the panel's own gap and no other may stay at 0, or it would join the block
 * above and the save would fail.
 */
export function removePanel(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== 'panel') return false;
  const lifted: PMNode[] = [];
  node.content.forEach((child, _offset, i) => {
    if (!('gap' in child.attrs)) {
      lifted.push(child);
      return;
    }
    const gap = i === 0 ? node.attrs.gap : Math.max(1, child.attrs.gap ?? 1);
    lifted.push(child.type.create({ ...child.attrs, gap }, child.content, child.marks));
  });
  editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + node.nodeSize, lifted));
  return true;
}

/** Set the code language; reset the recorded spelling so the canonical opener is emitted. */
export function setCodeLanguage(editor: Editor, pos: number, language: string | null): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== 'codeBlock' || node.attrs.open === '{noformat}') return false;
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      language,
      open: null,
      close: null,
    }),
  );
  return true;
}
