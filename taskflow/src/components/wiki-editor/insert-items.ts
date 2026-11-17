import type { Editor } from '@tiptap/core';
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
      editor
        .chain()
        .focus()
        .insertContent({ type: 'panel', attrs: { type: id }, content: [{ type: 'paragraph' }] })
        .run(),
  };
}

export const INSERT_ITEMS: readonly InsertItem[] = [
  {
    id: 'table',
    label: 'Table',
    icon: Table2,
    keywords: ['table', 'grid', 'rows', 'columns'],
    source: { before: '||  ||  ||\n|  |  |', after: '' },
    run: (editor, opts) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: opts?.rows ?? 3, cols: opts?.cols ?? 3, withHeaderRow: true })
        .run(),
  },
  {
    id: 'code',
    label: 'Code block',
    icon: Code2,
    keywords: ['code', 'snippet', 'pre'],
    source: { before: '{code}\n', after: '\n{code}' },
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertContent({ type: 'codeBlock', attrs: { language: null } })
        .run(),
  },
  {
    id: 'noformat',
    label: 'Noformat',
    icon: FileText,
    keywords: ['noformat', 'plain', 'preformatted'],
    source: { before: '{noformat}\n', after: '\n{noformat}' },
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'codeBlock',
          attrs: { language: null, open: '{noformat}', close: '{noformat}' },
        })
        .run(),
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
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];
