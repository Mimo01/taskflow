import type { Editor } from '@tiptap/core';

export type TextStyleId = 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'quote';

export const TEXT_STYLES: readonly { id: TextStyleId; label: string }[] = [
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'h1', label: 'Heading 1' },
  { id: 'h2', label: 'Heading 2' },
  { id: 'h3', label: 'Heading 3' },
  { id: 'h4', label: 'Heading 4' },
  { id: 'h5', label: 'Heading 5' },
  { id: 'h6', label: 'Heading 6' },
  { id: 'quote', label: 'Quote' },
];

type Level = 1 | 2 | 3 | 4 | 5 | 6;

export function currentTextStyle(editor: Editor): TextStyleId {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    if (editor.isActive('heading', { level })) return `h${level}`;
  }
  if (editor.isActive('blockquote')) return 'quote';
  return 'paragraph';
}

export function applyTextStyle(editor: Editor, id: TextStyleId): boolean {
  const chain = editor.chain().focus();
  if (id === 'paragraph') {
    if (editor.isActive('blockquote')) return chain.lift('blockquote').setParagraph().run();
    return chain.setParagraph().run();
  }
  if (id === 'quote') return chain.toggleBlockquote().run();
  return chain.toggleHeading({ level: Number(id.slice(1)) as Level }).run();
}
