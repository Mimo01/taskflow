import type { Editor } from '@tiptap/core';
import { isSafeColor } from '@/lib/wiki/editor/parse/color';
import { normalizeLinkUrl } from './link-url';

/** Apply a text colour. Never writes a value that fails the safe-colour guard (T-98-01). */
export function applyColour(editor: Editor, value: string): boolean {
  if (!isSafeColor(value)) return false;
  return editor.chain().focus().setMark('color', { value, open: null, span: null }).run();
}

export function removeColour(editor: Editor): boolean {
  return editor.chain().focus().unsetMark('color').run();
}

export function currentColour(editor: Editor): string | null {
  const value = editor.getAttributes('color').value;
  return typeof value === 'string' ? value : null;
}

/** Link the selection (or insert the URL as linked text when collapsed). Allowlisted URLs only (T-98-02). */
export function applyLink(editor: Editor, input: string): boolean {
  const href = normalizeLinkUrl(input);
  if (!href) return false;
  const { empty } = editor.state.selection;
  if (empty && !editor.isActive('link')) {
    return editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
      .run();
  }
  return editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
}

export function removeLink(editor: Editor): boolean {
  return editor.chain().focus().extendMarkRange('link').unsetLink().run();
}

export function currentLink(editor: Editor): string | null {
  const href = editor.getAttributes('link').href;
  return typeof href === 'string' ? href : null;
}
