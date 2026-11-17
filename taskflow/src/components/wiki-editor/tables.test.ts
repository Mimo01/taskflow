import { describe, expect, it } from 'vitest';
import { loadWiki } from '@/lib/wiki/editor';
import { findTable, isInTable, TABLE_ACTIONS, toggleTableHeaderRow } from './table-commands';
import { makeEditor, saveText } from './test-utils';

const HEADER = '||a||b||\n|c|d|';
const HEADERLESS = '|a|b|\n|c|d|';

type Ed = ReturnType<typeof makeEditor>['editor'];

const tableAttrs = (editor: Ed) => findTable(editor.state)?.node.attrs;
const rowCount = (editor: Ed) => findTable(editor.state)?.node.childCount;
function tab(editor: Ed, shift = false) {
  const { view } = editor;
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift });
  return view.someProp('handleKeyDown', (f) => f(view, event));
}
function inFirstCell(editor: Ed) {
  const t = findTable(editor.state);
  editor.commands.setTextSelection((t?.pos ?? 0) + 4);
}

describe('table commands', () => {
  it('action ids are ordered', () => {
    expect(TABLE_ACTIONS.map((a) => a.id)).toEqual([
      'row-above',
      'row-below',
      'col-left',
      'col-right',
      'delete-row',
      'delete-col',
      'toggle-header-row',
      'toggle-header-col',
      'delete-table',
    ]);
    expect(TABLE_ACTIONS[TABLE_ACTIONS.length - 1]?.destructive).toBe(true);
  });

  it('isInTable only inside a table', () => {
    const { editor } = makeEditor(`para\n\n${HEADER}`);
    editor.commands.setTextSelection(1);
    expect(isInTable(editor.state)).toBe(false);
    editor.commands.setTextSelection(editor.state.doc.content.size - 3);
    expect(isInTable(editor.state)).toBe(true);
  });

  it('Tab in the last cell adds a row; Shift-Tab moves back', () => {
    const { editor } = makeEditor(HEADER);
    editor.commands.setTextSelection(editor.state.doc.content.size - 3);
    expect(rowCount(editor)).toBe(2);
    tab(editor);
    expect(rowCount(editor)).toBe(3);
    const before = editor.state.selection.from;
    tab(editor, true);
    expect(editor.state.selection.from).toBeLessThan(before);
  });

  it.each([
    'row-below',
    'row-above',
    'col-left',
    'col-right',
    'delete-row',
    'delete-col',
  ])('%s round-trips as a rich table', (id) => {
    const { editor, load } = makeEditor('||a||b||\n|c|d|\n|e|f|');
    inFirstCell(editor);
    editor.commands.goToNextCell();
    editor.commands.goToNextCell();
    TABLE_ACTIONS.find((a) => a.id === id)?.run(editor);
    const saved = saveText(editor, load);
    expect(saved.kind).toBe('saved');
    if (saved.kind === 'saved') expect(loadWiki(saved.text)).toHaveProperty('doc');
  });

  it('toggle header row off saves headerless and reloads headerless', () => {
    const { editor, load } = makeEditor(HEADER);
    inFirstCell(editor);
    expect(tableAttrs(editor)?.headerless).toBe(false);
    toggleTableHeaderRow(editor);
    expect(tableAttrs(editor)?.headerless).toBe(true);
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: HEADERLESS });
    const re = makeEditor(HEADERLESS);
    inFirstCell(re.editor);
    expect(tableAttrs(re.editor)?.headerless).toBe(true);
  });

  it('toggle header row on writes a || row', () => {
    const { editor, load } = makeEditor(HEADERLESS);
    inFirstCell(editor);
    toggleTableHeaderRow(editor);
    expect(tableAttrs(editor)?.headerless).toBe(false);
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: HEADER });
  });

  it('headerless table stays headerless after editing a cell', () => {
    const { editor, load } = makeEditor(HEADERLESS);
    editor.commands.setTextSelection(editor.state.doc.content.size - 3);
    editor.commands.insertContent('z');
    const saved = saveText(editor, load);
    expect(saved.kind).toBe('saved');
    if (saved.kind === 'saved') expect(saved.text.startsWith('||')).toBe(false);
  });
});
