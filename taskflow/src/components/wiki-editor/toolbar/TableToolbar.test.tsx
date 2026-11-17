import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWiki } from '@/lib/wiki/editor';
import { EDITOR_RULE_OPTIONS, editorExtensions } from '../extensions';
import { TABLE_ACTIONS } from '../table-commands';
import { TableToolbar } from './TableToolbar';

const load = loadWiki('para\n\n||a||b||\n|c|d|');
if (!('doc' in load)) throw new Error('fixture must load rich');

let editorRef: Editor | null = null;

function Harness() {
  const editor = useEditor({
    extensions: editorExtensions,
    content: load.kind === 'rich' ? load.doc : undefined,
    ...EDITOR_RULE_OPTIONS,
  });
  editorRef = editor;
  if (!editor) return null;
  return (
    <>
      <EditorContent editor={editor} />
      <TableToolbar editor={editor} />
    </>
  );
}

const tablePos = () => {
  let pos = -1;
  editorRef?.state.doc.descendants((n, p) => {
    if (n.type.name === 'table') pos = p;
  });
  return pos;
};
const rows = () => {
  let n = 0;
  editorRef?.state.doc.descendants((node) => {
    if (node.type.name === 'tableRow') n++;
  });
  return n;
};

// jsdom has no layout; ProseMirror's scroll-into-view needs rect APIs.
beforeAll(() => {
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  };
  const list = () => Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
  Range.prototype.getClientRects = list;
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Element.prototype.getClientRects = list;
});

describe('TableToolbar', () => {
  it('shows only while the caret is in a table, with all actions', async () => {
    render(<Harness />);
    await act(async () => {
      editorRef?.commands.setTextSelection(1);
    });
    expect(screen.queryByRole('button', { name: 'Add row below' })).toBeNull();
    await act(async () => {
      editorRef?.commands.setTextSelection(tablePos() + 4);
    });
    for (const a of TABLE_ACTIONS) {
      expect(await screen.findByRole('button', { name: a.label })).toBeInTheDocument();
    }
    const popup = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
    const labels = within(popup)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(labels[labels.length - 1]).toBe('Delete table');
    expect(screen.getByTestId('table-toolbar-separator')).toBeInTheDocument();
  });

  it('adds a row and deletes the table with undo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await act(async () => {
      editorRef?.commands.setTextSelection(tablePos() + 4);
    });
    const before = rows();
    await user.click(await screen.findByRole('button', { name: 'Add row below' }));
    expect(rows()).toBe(before + 1);
    await user.click(await screen.findByRole('button', { name: 'Delete table' }));
    expect(tablePos()).toBe(-1);
    await act(async () => {
      editorRef?.commands.undo();
    });
    expect(tablePos()).toBeGreaterThan(-1);
  });
});
