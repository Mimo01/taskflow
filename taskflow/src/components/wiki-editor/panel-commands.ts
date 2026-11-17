import type { Editor } from '@tiptap/core';

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

/** Replace the panel with its body: one transaction, one undo step. */
export function removePanel(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== 'panel') return false;
  editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + node.nodeSize, node.content));
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
