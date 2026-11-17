import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  type LucideIcon,
  Rows3,
  Table2,
  Trash2,
} from 'lucide-react';

export function findTable(state: EditorState): { pos: number; node: PMNode } | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table') return { pos: $from.before(d), node };
  }
  return null;
}

export function isInTable(state: EditorState): boolean {
  return findTable(state) !== null;
}

/**
 * Toggle the header row and keep `headerless` consistent in the same
 * transaction (Phase 97 D-02): headerless means the first row has no header cells.
 */
export function toggleTableHeaderRow(editor: Editor): boolean {
  const found = findTable(editor.state);
  if (!found) return false;
  const tablePos = found.pos;
  return editor
    .chain()
    .toggleHeaderRow()
    .command(({ tr }) => {
      const table = tr.doc.nodeAt(tablePos);
      if (!table || table.type.name !== 'table') return false;
      const first = table.firstChild?.firstChild;
      const headerless = first?.type.name !== 'tableHeader';
      if (table.attrs.headerless !== headerless) {
        tr.setNodeMarkup(tablePos, undefined, { ...table.attrs, headerless });
      }
      return true;
    })
    .run();
}

export interface TableAction {
  id: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  run: (editor: Editor) => boolean;
}

export const TABLE_ACTIONS: readonly TableAction[] = [
  {
    id: 'row-above',
    label: 'Add row above',
    icon: ArrowUpToLine,
    run: (e) => e.chain().focus().addRowBefore().run(),
  },
  {
    id: 'row-below',
    label: 'Add row below',
    icon: ArrowDownToLine,
    run: (e) => e.chain().focus().addRowAfter().run(),
  },
  {
    id: 'col-left',
    label: 'Add column left',
    icon: ArrowLeftToLine,
    run: (e) => e.chain().focus().addColumnBefore().run(),
  },
  {
    id: 'col-right',
    label: 'Add column right',
    icon: ArrowRightToLine,
    run: (e) => e.chain().focus().addColumnAfter().run(),
  },
  {
    id: 'delete-row',
    label: 'Delete row',
    icon: Rows3,
    run: (e) => e.chain().focus().deleteRow().run(),
  },
  {
    id: 'delete-col',
    label: 'Delete column',
    icon: Columns3,
    run: (e) => e.chain().focus().deleteColumn().run(),
  },
  {
    id: 'toggle-header-row',
    label: 'Toggle header row',
    icon: Table2,
    run: (e) => toggleTableHeaderRow(e),
  },
  {
    id: 'toggle-header-col',
    label: 'Toggle header column',
    icon: Columns3,
    run: (e) => e.chain().focus().toggleHeaderColumn().run(),
  },
  {
    id: 'delete-table',
    label: 'Delete table',
    icon: Trash2,
    destructive: true,
    run: (e) => e.chain().focus().deleteTable().run(),
  },
];
