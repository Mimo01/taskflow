import type { Editor } from '@tiptap/core';
import {
  AtSign,
  FileSymlink,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  type LucideIcon,
  Pilcrow,
  Quote,
  Smile,
} from 'lucide-react';
import { INSERT_ITEMS } from '../insert-items';
import { WIKI_OPEN_ATTACH_EVENT } from '../nodeviews/events';
import { applyTextStyle, TEXT_STYLES, type TextStyleId } from '../text-style';
import { openEmoticonSuggestion } from './emoticon-suggestion';

export type SlashGroup = 'Text' | 'Blocks' | 'Insert';

export interface SlashItem {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: readonly string[];
  group: SlashGroup;
  run(editor: Editor): boolean;
}

const TEXT_ICONS: Record<TextStyleId, LucideIcon> = {
  paragraph: Pilcrow,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  quote: Quote,
};

const TEXT_ITEMS: SlashItem[] = [
  ...TEXT_STYLES.map(
    (s): SlashItem => ({
      id: s.id,
      label: s.label,
      icon: TEXT_ICONS[s.id],
      keywords: s.id === 'paragraph' ? ['text', 'normal', 'p'] : [s.id, s.label.toLowerCase()],
      group: 'Text',
      run: (editor) => applyTextStyle(editor, s.id),
    }),
  ),
  {
    id: 'bullet-list',
    label: 'Bullet list',
    icon: List,
    keywords: ['bullet', 'list', 'unordered', 'ul'],
    group: 'Text',
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered-list',
    label: 'Numbered list',
    icon: ListOrdered,
    keywords: ['numbered', 'ordered', 'list', 'ol'],
    group: 'Text',
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
];

const BLOCK_ITEMS: SlashItem[] = INSERT_ITEMS.map((i) => ({
  id: i.id,
  label: i.label,
  icon: i.icon,
  keywords: i.keywords,
  group: 'Blocks' as const,
  run: (editor: Editor) => i.run(editor, { rows: 3, cols: 3 }),
}));

const INSERT_GROUP: SlashItem[] = [
  {
    id: 'mention',
    label: 'Mention',
    icon: AtSign,
    keywords: ['mention', 'person', 'user', '@'],
    group: 'Insert',
    // The caret sits where "/" was: line start or after a space, so "@" opens the list.
    run: (editor) => editor.chain().focus().insertContent('@').run(),
  },
  {
    id: 'attachment',
    label: 'Attachment or image',
    icon: FileSymlink,
    keywords: ['attachment', 'image', 'file', 'upload', 'picture'],
    group: 'Insert',
    run: (editor) => {
      const ok = editor.chain().focus().run();
      editor.view.dom.dispatchEvent(new CustomEvent(WIKI_OPEN_ATTACH_EVENT, { bubbles: true }));
      return ok;
    },
  },
  {
    id: 'emoticon',
    label: 'Emoticon',
    icon: Smile,
    keywords: ['emoticon', 'emoji', 'smile', 'icon'],
    group: 'Insert',
    run: (editor) => {
      const ok = editor.chain().focus().run();
      openEmoticonSuggestion(editor);
      return ok;
    },
  },
];

export const SLASH_ITEMS: readonly SlashItem[] = [...TEXT_ITEMS, ...BLOCK_ITEMS, ...INSERT_GROUP];

/** Prefix matches on label/keywords first, then substring matches. */
export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_ITEMS];
  const fields = (i: SlashItem) => [
    i.label.toLowerCase(),
    ...i.keywords.map((k) => k.toLowerCase()),
  ];
  const prefix = SLASH_ITEMS.filter((i) => fields(i).some((f) => f.startsWith(q)));
  const rest = SLASH_ITEMS.filter(
    (i) => !prefix.includes(i) && fields(i).some((f) => f.includes(q)),
  );
  return [...prefix, ...rest];
}
