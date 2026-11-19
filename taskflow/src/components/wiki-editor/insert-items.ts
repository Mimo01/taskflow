import type { Editor, JSONContent } from '@tiptap/core';
import { Selection } from '@tiptap/pm/state';
import {
  AlertTriangle,
  Code2,
  FileText,
  Info,
  Lightbulb,
  type LucideIcon,
  Minus,
  PanelTop,
  StickyNote,
  Table2,
} from 'lucide-react';

/**
 * Single data-driven list of insertable blocks. Drives the toolbar "+ Insert" menu and is
 * consumed by Phase 99's slash menu: keep ids stable. Every rich `run` and every source
 * snippet produces canonical wiki text (Phase 97 D-08).
 */
export type InsertItemId =
  | 'table'
  | 'code'
  | 'noformat'
  | 'panel'
  | 'info'
  | 'note'
  | 'warning'
  | 'tip'
  | 'rule';

export interface InsertItem {
  id: InsertItemId;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  /** Source-mode snippet; the cursor lands between `before` and `after`. */
  source: { before: string; after: string };
  run: (editor: Editor, opts?: { rows: number; cols: number }) => boolean;
}

/**
 * End of the code block, list or table that cannot hold a `type` block at the caret, or
 * null when the caret's own container can. List items and table cells only take what
 * emit.ts can spell (schema.ts), and a code block holds only text; ProseMirror's replace
 * fitting would otherwise split the code block, list or table around the new block, so it
 * showed twice (and a split table failed to save).
 */
function blockingContainerEnd(editor: Editor, type: string): number | null {
  const { $from } = editor.state.selection;
  const nodeType = editor.schema.nodes[type];
  if (!nodeType) return null;
  const inCode = $from.parent.type.spec.code === true;
  for (let d = $from.depth - 1; d >= 0; d--) {
    const i = $from.index(d);
    // A panel in a table cell is spelled on the cell's one line (emit.ts cellSegments), so it
    // holds text only, though the schema's `block+` would take a rule or code block.
    const role = d > 0 ? $from.node(d - 1).type.spec.tableRole : undefined;
    if ($from.node(d).type.name === 'panel' && (role === 'cell' || role === 'header_cell'))
      continue;
    if ($from.node(d).canReplaceWith(i + 1, i + 1, nodeType))
      return d === $from.depth - 1 && !inCode ? null : $from.after(d + 1);
  }
  return null;
}

/**
 * Inserts a block at the caret, or after the enclosing list/table when the caret's container
 * cannot hold it. The caret moves into the new block; a leaf (rule) leaves it where it was.
 */
function insertBlock(editor: Editor, content: JSONContent, atCaret: () => boolean): boolean {
  const at = blockingContainerEnd(editor, content.type ?? '');
  if (at === null) return atCaret();
  const leaf = editor.schema.nodes[content.type ?? '']?.isLeaf ?? false;
  return editor
    .chain()
    .focus()
    .insertContentAt(at, content, { updateSelection: false })
    .command(({ tr }) => {
      if (!leaf) tr.setSelection(Selection.near(tr.doc.resolve(at + 1)));
      return true;
    })
    .run();
}

const cells = (type: 'tableHeader' | 'tableCell', cols: number): JSONContent => ({
  type: 'tableRow',
  content: Array.from({ length: cols }, () => ({ type, content: [{ type: 'paragraph' }] })),
});

/** Inserts `content` with insertContent, or after a list/table that cannot hold it. */
const insertNode = (editor: Editor, content: JSONContent): boolean =>
  insertBlock(editor, content, () => editor.chain().focus().insertContent(content).run());

function panelItem(
  id: 'panel' | 'info' | 'note' | 'warning' | 'tip',
  label: string,
  icon: LucideIcon,
  keywords: string[],
): InsertItem {
  return {
    id,
    label,
    icon,
    keywords,
    source: { before: `{${id}}\n`, after: `\n{${id}}` },
    run: (editor) =>
      insertNode(editor, { type: 'panel', attrs: { type: id }, content: [{ type: 'paragraph' }] }),
  };
}

export const INSERT_ITEMS: readonly InsertItem[] = [
  {
    id: 'table',
    label: 'Table',
    icon: Table2,
    keywords: ['table', 'grid', 'rows', 'columns'],
    source: { before: '||  ||  ||\n|  |  |', after: '' },
    run: (editor, opts) => {
      const rows = opts?.rows ?? 3;
      const cols = opts?.cols ?? 3;
      const table: JSONContent = {
        type: 'table',
        content: [
          cells('tableHeader', cols),
          ...Array.from({ length: rows - 1 }, () => cells('tableCell', cols)),
        ],
      };
      return insertBlock(editor, table, () =>
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run(),
      );
    },
  },
  {
    id: 'code',
    label: 'Code block',
    icon: Code2,
    keywords: ['code', 'snippet', 'pre'],
    source: { before: '{code}\n', after: '\n{code}' },
    run: (editor) => insertNode(editor, { type: 'codeBlock', attrs: { language: null } }),
  },
  {
    id: 'noformat',
    label: 'Noformat',
    icon: FileText,
    keywords: ['noformat', 'plain', 'preformatted'],
    source: { before: '{noformat}\n', after: '\n{noformat}' },
    run: (editor) =>
      insertNode(editor, {
        type: 'codeBlock',
        attrs: { language: null, open: '{noformat}', close: '{noformat}' },
      }),
  },
  panelItem('panel', 'Panel', PanelTop, ['panel', 'box', 'callout']),
  panelItem('info', 'Info', Info, ['info', 'information', 'callout']),
  panelItem('note', 'Note', StickyNote, ['note', 'callout']),
  panelItem('warning', 'Warning', AlertTriangle, ['warning', 'caution', 'callout']),
  panelItem('tip', 'Tip', Lightbulb, ['tip', 'hint', 'callout']),
  {
    id: 'rule',
    label: 'Horizontal rule',
    icon: Minus,
    keywords: ['rule', 'divider', 'line', 'hr'],
    source: { before: '\n----\n', after: '' },
    run: (editor) =>
      insertBlock(editor, { type: 'horizontalRule' }, () =>
        editor.chain().focus().setHorizontalRule().run(),
      ),
  },
];
