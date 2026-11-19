import type { NodeViewRenderer } from '@tiptap/core';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Table, TableRow } from '@tiptap/extension-table';
import { Dropcursor, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { isSafeColor } from '@/lib/wiki/editor/parse/color';
import {
  Attachment,
  Cite,
  Color,
  Emoticon,
  Escape,
  Image,
  Mention,
  Mono,
  Panel,
  RawBlock,
  RawInline,
  STARTER_KIT_OPTIONS,
  Sub,
  Sup,
  WikiListItem,
  WikiSpelling,
  WikiTableCell,
  WikiTableHeader,
} from '@/lib/wiki/editor/schema';
import { WIKI_PROSE_CLASSES } from '@/lib/wiki/prose';
import { codeHighlightPlugin } from './code-highlight';
import { WikiGapKeeper } from './gap-keeper';
import { WikiHostBridge } from './host';
import { WikiInputRules } from './input-rules';
import { WikiKeymap } from './keymap';
import { WikiLinkPaste } from './link-paste';
import { emoticonGlyph } from './suggestion/emoticon-data';

export type WikiNodeViews = Partial<
  Record<
    | 'panel'
    | 'codeBlock'
    | 'rawBlock'
    | 'rawInline'
    | 'mention'
    | 'image'
    | 'attachment'
    | 'emoticon',
    NodeViewRenderer
  >
>;

const CHIP_CLASS = 'rounded bg-muted px-1 text-xs text-muted-foreground';

/**
 * Build the editor extension list. Call ONLY at module scope: a new array per render
 * recreates the editor and loses the caret (EDIT-09). Schema stays identical to
 * `wikiExtensions` (Phase 97); this only adds rendering, node views and behaviour.
 */
export function buildEditorExtensions(views: WikiNodeViews = {}) {
  const panel = views.panel;
  const codeBlock = views.codeBlock;
  const rawBlock = views.rawBlock;
  const rawInline = views.rawInline;
  return [
    StarterKit.configure({ ...STARTER_KIT_OPTIONS, codeBlock: false }),
    CodeBlock.extend({
      addNodeView: codeBlock ? () => codeBlock : undefined,
      // Keep the parent's plugins (VS Code paste handler) — overriding without this.parent drops them.
      addProseMirrorPlugins() {
        return [...(this.parent?.() ?? []), codeHighlightPlugin()];
      },
    }),
    Table,
    TableRow,
    WikiTableCell,
    WikiTableHeader,
    WikiListItem,
    WikiSpelling,
    Panel.extend({
      parseHTML: () => [{ tag: 'div[data-wiki-panel]' }],
      renderHTML: ({ node }) => [
        'div',
        { 'data-wiki-panel': '', 'data-type': String(node.attrs.type) },
        0,
      ],
      addNodeView: panel ? () => panel : undefined,
    }),
    RawBlock.extend({
      parseHTML: () => [{ tag: 'div[data-wiki-raw]' }],
      renderHTML: ({ node }) => [
        'div',
        { 'data-wiki-raw': '', contenteditable: 'false' },
        String(node.attrs.raw),
      ],
      addNodeView: rawBlock ? () => rawBlock : undefined,
    }),
    RawInline.extend({
      parseHTML: () => [{ tag: 'span[data-wiki-raw-inline]' }],
      renderHTML: ({ node }) => [
        'span',
        { 'data-wiki-raw-inline': '', contenteditable: 'false' },
        String(node.attrs.raw),
      ],
      addNodeView: rawInline ? () => rawInline : undefined,
    }),
    Emoticon.extend({
      parseHTML: () => [{ tag: 'span[data-wiki-emoticon]' }],
      renderHTML: ({ node }) => {
        const src = String(node.attrs.src);
        return ['span', { 'data-wiki-emoticon': '', src }, emoticonGlyph(src) ?? src];
      },
      addNodeView: views.emoticon ? () => views.emoticon as NodeViewRenderer : undefined,
    }),
    Mention.extend({
      parseHTML: () => [{ tag: 'span[data-wiki-mention]' }],
      renderHTML: ({ node }) => [
        'span',
        { 'data-wiki-mention': '', id: String(node.attrs.id), class: CHIP_CLASS },
        `@${String(node.attrs.id)}`,
      ],
      addNodeView: views.mention ? () => views.mention as NodeViewRenderer : undefined,
    }),
    Escape.extend({
      parseHTML: () => [{ tag: 'span[data-wiki-escape]' }],
      renderHTML: ({ node }) => ['span', { 'data-wiki-escape': '' }, String(node.attrs.src)],
    }),
    Image.extend({
      parseHTML: () => [{ tag: 'span[data-wiki-image]' }],
      renderHTML: ({ node }) => [
        'span',
        {
          'data-wiki-image': '',
          name: String(node.attrs.name),
          ...(node.attrs.params ? { params: String(node.attrs.params) } : {}),
          class: CHIP_CLASS,
        },
        String(node.attrs.name),
      ],
      addNodeView: views.image ? () => views.image as NodeViewRenderer : undefined,
    }),
    Attachment.extend({
      parseHTML: () => [{ tag: 'span[data-wiki-attachment]' }],
      renderHTML: ({ node }) => [
        'span',
        { 'data-wiki-attachment': '', name: String(node.attrs.name), class: CHIP_CLASS },
        String(node.attrs.name),
      ],
      addNodeView: views.attachment ? () => views.attachment as NodeViewRenderer : undefined,
    }),
    Sup.extend({
      parseHTML: () => [{ tag: 'sup' }],
      renderHTML: () => ['sup', 0],
    }),
    Sub.extend({
      parseHTML: () => [{ tag: 'sub' }],
      renderHTML: () => ['sub', 0],
    }),
    Cite.extend({
      parseHTML: () => [{ tag: 'cite' }],
      renderHTML: () => ['cite', 0],
    }),
    Mono.extend({
      parseHTML: () => [{ tag: 'code' }],
      renderHTML: () => ['code', 0],
    }),
    Color.extend({
      parseHTML: () => [{ tag: 'span[data-color]' }],
      renderHTML: ({ mark }) => {
        const value = String(mark.attrs.value);
        return isSafeColor(value)
          ? ['span', { 'data-color': value, style: `color: ${value}` }, 0]
          : ['span', { 'data-color': value }, 0];
      },
    }),
    UndoRedo,
    Dropcursor,
    Gapcursor,
    Placeholder.configure({
      placeholder: ({ editor }) =>
        (editor.options.editorProps.attributes as Record<string, string> | undefined)?.[
          'data-wiki-placeholder'
        ] ?? '',
      showOnlyWhenEditable: true,
    }),
    WikiKeymap,
    WikiInputRules,
    WikiLinkPaste,
    WikiGapKeeper,
    WikiHostBridge,
  ];
}

export const editorExtensions = buildEditorExtensions();

/** Wiki wins over markdown: only these (plus the wiki rules) may contribute input rules. */
export const EDITOR_RULE_OPTIONS: { enableInputRules: string[]; enablePasteRules: false } = {
  enableInputRules: [
    'bulletList',
    'orderedList',
    'blockquote',
    'horizontalRule',
    'codeBlock',
    'wikiInputRules',
  ],
  enablePasteRules: false,
};

const PROSE = WIKI_PROSE_CLASSES.join(' ');

export const EDITOR_ATTRIBUTES = Object.freeze({
  full: Object.freeze({
    class: `${PROSE} min-h-[160px] px-4 py-3 outline-none`,
    'data-wiki-placeholder': 'Write a description…',
  }),
  compact: Object.freeze({
    class: `${PROSE} min-h-[96px] px-4 py-3 outline-none`,
    'data-wiki-placeholder': 'Add a comment…',
  }),
});
