import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { loadWiki } from '@/lib/wiki/editor';
import { INSERT_ITEMS } from './insert-items';
import { makeEditor, saveText } from './test-utils';

function savedText(
  editor: ReturnType<typeof makeEditor>['editor'],
  load: ReturnType<typeof makeEditor>['load'],
) {
  const saved = saveText(editor, load);
  expect(saved.kind).not.toBe('failed');
  return 'text' in saved ? saved.text.trim() : '';
}

describe('INSERT_ITEMS', () => {
  it('lists the items in order with complete metadata', () => {
    expect(INSERT_ITEMS.map((i) => i.id)).toEqual([
      'table',
      'code',
      'noformat',
      'panel',
      'info',
      'note',
      'warning',
      'tip',
      'rule',
    ]);
    for (const i of INSERT_ITEMS) {
      expect(i.label).toBeTruthy();
      expect(i.icon).toBeTruthy();
      expect(i.keywords.length).toBeGreaterThan(0);
      expect(typeof i.run).toBe('function');
    }
  });

  it.each(
    INSERT_ITEMS.map((i) => [i.id, i] as const),
  )('%s source snippet loads rich', (_id, item) => {
    expect(loadWiki(item.source.before + item.source.after).kind).toBe('rich');
  });

  const expected: Record<string, RegExp> = {
    code: /^\{code\}\n*\{code\}$/,
    noformat: /^\{noformat\}\n*\{noformat\}$/,
    panel: /^\{panel\}[\s\S]*\{panel\}$/,
    info: /^\{info\}[\s\S]*\{info\}$/,
    note: /^\{note\}[\s\S]*\{note\}$/,
    warning: /^\{warning\}[\s\S]*\{warning\}$/,
    tip: /^\{tip\}[\s\S]*\{tip\}$/,
    rule: /^-{4,}$/,
  };
  it.each(Object.entries(expected))('rich %s saves canonical wiki', (id, re) => {
    const { editor, load } = makeEditor('');
    const item = INSERT_ITEMS.find((i) => i.id === id);
    expect(item?.run(editor)).toBe(true);
    expect(savedText(editor, load)).toMatch(re);
    editor.destroy();
  });

  it('table inserts a header row plus data rows', () => {
    const { editor, load } = makeEditor('');
    INSERT_ITEMS[0]?.run(editor, { rows: 2, cols: 3 });
    const table = (editor.getJSON().content as JSONContent[] | undefined)?.find(
      (n) => n.type === 'table',
    );
    expect(table?.attrs?.headerless).toBeFalsy();
    expect(table?.content?.length).toBe(2);
    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
    expect(savedText(editor, load)).toContain('||');
    editor.destroy();
  });
});

describe('block inserts inside containers the emitter cannot nest into', () => {
  const insert = (id: string, editor: ReturnType<typeof makeEditor>['editor']) =>
    INSERT_ITEMS.find((i) => i.id === id)?.run(editor);

  it('a code block inserted in a list item lands after the list and saves', () => {
    const { editor, load } = makeEditor('* a');
    editor.commands.focus('end');
    insert('code', editor);
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: '* a\n\n{code}\n\n{code}' });
  });

  it('a pasted code block in a list item lands after the list and saves', () => {
    const { editor, load } = makeEditor('* a');
    editor.commands.focus('end');
    editor.commands.insertContent('<pre><code>x\ny</code></pre>');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: '* a\n\n{code}\nx\ny\n{code}' });
  });

  it.each(['code', 'noformat', 'rule'])('%s inserted in a table cell saves', (id) => {
    const { editor, load } = makeEditor('|a|b|');
    editor.commands.focus(3);
    insert(id, editor);
    expect(saveText(editor, load).kind).toBe('saved');
  });
});

describe('block inserts mid-text in a list item or cell never split the container', () => {
  const ids = INSERT_ITEMS.map((i) => i.id);
  const run = (id: string, editor: ReturnType<typeof makeEditor>['editor']) =>
    INSERT_ITEMS.find((i) => i.id === id)?.run(editor, { rows: 2, cols: 2 });
  const tops = (editor: ReturnType<typeof makeEditor>['editor']) =>
    (editor.getJSON().content ?? []).map((n) => n.type);

  it.each(
    ids.filter((id) => id !== 'panel' && !['info', 'note', 'warning', 'tip'].includes(id)),
  )('%s in a table cell lands after the table', (id) => {
    const { editor, load } = makeEditor('|| h ||\n| cell |\n\nafter');
    editor.commands.setTextSelection(12); // between "c" and "ell"
    expect(run(id, editor)).toBe(true);
    expect(tops(editor).filter((t) => t === 'table')).toHaveLength(id === 'table' ? 2 : 1);
    const saved = saveText(editor, load);
    expect(saved.kind).toBe('saved');
    expect('text' in saved && saved.text.startsWith('|| h ||\n| cell |\n\n')).toBe(true);
    expect('text' in saved && saved.text.endsWith('\n\nafter')).toBe(true);
  });

  it.each(ids)('%s in a list item lands after the list', (id) => {
    const { editor, load } = makeEditor('* one\n* two\n\nafter');
    editor.commands.setTextSelection(5); // between "on" and "e"
    expect(run(id, editor)).toBe(true);
    expect(tops(editor).filter((t) => t === 'bulletList')).toHaveLength(1);
    const saved = saveText(editor, load);
    expect(saved.kind).toBe('saved');
    expect('text' in saved && saved.text.startsWith('* one\n* two\n\n')).toBe(true);
  });

  it('a rule mid-cell keeps the caret in the cell', () => {
    const { editor, load } = makeEditor('|| h ||\n| cell |');
    editor.commands.setTextSelection(12);
    run('rule', editor);
    expect(editor.state.selection.$from.parent.textContent).toBe('cell');
    expect(saveText(editor, load)).toEqual({ kind: 'saved', text: '|| h ||\n| cell |\n\n----' });
  });

  it('a code block mid-list puts the caret inside it', () => {
    const { editor } = makeEditor('* one\n* two');
    editor.commands.setTextSelection(5);
    run('code', editor);
    expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock');
  });
});
