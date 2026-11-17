import { Extension, getSchema, Mark, Node } from '@tiptap/core';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';

/**
 * Wiki document schema (Phase 97). Pure: no React, no node views, no commands,
 * no plugins. Everything here is a module-scope constant (React Compiler runs
 * in the app but not in vitest, so schema stability matters, Pitfall 7).
 *
 * D-05: every source spelling variant is a node or mark attribute so the
 * emitter can replay it. `null` / default values mean "canonical spelling".
 */

const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'table',
  'panel',
  'rawBlock',
] as const;

/** Spelling attributes added to StarterKit/table nodes and marks (D-05). */
export const WikiSpelling = Extension.create({
  name: 'wikiSpelling',
  addGlobalAttributes() {
    return [
      // Blank lines between this block and the previous one. keepOnSplit: false so an
      // at-end Enter builds the new block with the default gap 1, not a copy of gap 0.
      {
        types: [...BLOCK_TYPES],
        attributes: { gap: { default: 1, keepOnSplit: false } },
      },
      { types: ['doc'], attributes: { eol: { default: 'lf' }, tail: { default: 0 } } },
      { types: ['heading'], attributes: { sep: { default: ' ' } } },
      { types: ['horizontalRule'], attributes: { src: { default: '----' } } },
      { types: ['bulletList'], attributes: { marker: { default: '*' } } },
      { types: ['orderedList'], attributes: { marker: { default: '#' } } },
      { types: ['listItem'], attributes: { prefix: { default: null } } },
      {
        types: ['blockquote'],
        attributes: {
          form: { default: 'bq' },
          bodyLead: { default: '\n' },
          bodyTail: { default: '\n' },
        },
      },
      {
        types: ['codeBlock'],
        attributes: {
          open: { default: null },
          close: { default: null },
          bodyLead: { default: '\n' },
          bodyTail: { default: '\n' },
        },
      },
      { types: ['hardBreak'], attributes: { src: { default: null } } },
      {
        types: ['bold', 'italic', 'strike', 'underline', 'sup', 'sub', 'cite', 'mono'],
        // `span` numbers each parsed span in document order (outer before inner) so
        // equal-extent nesting and adjacent equal spans re-emit exactly.
        attributes: { open: { default: null }, close: { default: null }, span: { default: null } },
      },
      {
        types: ['link'],
        attributes: { form: { default: 'named' }, src: { default: null } },
      },
      { types: ['table'], attributes: { headerless: { default: false } } },
      { types: ['tableRow'], attributes: { indent: { default: '' }, close: { default: null } } },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: { padL: { default: '' }, padR: { default: '' } },
      },
    ];
  },
});

/** Panel family: panel / info / note / warning / tip. */
export const Panel = Node.create({
  name: 'panel',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      type: { default: 'panel' },
      params: { default: null },
      bodyLead: { default: '\n' },
      bodyTail: { default: '\n' },
    };
  },
});

/** Unmodelled block, emitted verbatim. */
export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { raw: { default: '' } };
  },
});

/** Unmodelled inline token (for example `{status:...}`), emitted verbatim. */
export const RawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { raw: { default: '' } };
  },
});

export const Emoticon = Node.create({
  name: 'emoticon',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { src: { default: '' } };
  },
});

/** Mentions are modelled as a username; `src` null emits `[~id]` (D-08). */
export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { id: { default: '' }, src: { default: null } };
  },
});

export const Escape = Node.create({
  name: 'escape',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { src: { default: '' } };
  },
});

export const Image = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { name: { default: '' }, params: { default: null }, src: { default: null } };
  },
});

export const Attachment = Node.create({
  name: 'attachment',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { name: { default: '' }, label: { default: null }, src: { default: null } };
  },
});

export const Sup = Mark.create({ name: 'sup' });
export const Sub = Mark.create({ name: 'sub' });
export const Cite = Mark.create({ name: 'cite' });
export const Mono = Mark.create({ name: 'mono' });

/** `{color:x}` span; `span` ties together per-block marks of one multi-block span. */
export const Color = Mark.create({
  name: 'color',
  addAttributes() {
    return { value: { default: '' }, open: { default: null }, span: { default: null } };
  },
});

export const STARTER_KIT_OPTIONS = {
  code: false,
  link: { openOnClick: false, autolink: false, linkOnPaste: false },
  undoRedo: false,
  dropcursor: false,
  gapcursor: false,
  trailingNode: false,
  listKeymap: false,
} as const;

export const wikiExtensions = [
  StarterKit.configure(STARTER_KIT_OPTIONS),
  Table,
  TableRow,
  TableCell,
  TableHeader,
  WikiSpelling,
  Panel,
  RawBlock,
  RawInline,
  Emoticon,
  Mention,
  Escape,
  Image,
  Attachment,
  Sup,
  Sub,
  Cite,
  Mono,
  Color,
];

export const wikiSchema = getSchema(wikiExtensions);
