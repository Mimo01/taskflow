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
