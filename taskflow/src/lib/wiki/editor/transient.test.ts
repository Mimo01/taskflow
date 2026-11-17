import { describe, expect, it } from 'vitest';
import { loadWiki, saveWiki } from './engine';
import { wikiSchema } from './schema';
import { withoutEmptyListItems } from './transient';
import type { WikiDocJSON } from './types';

type J = WikiDocJSON;

const para = (text: string, gap = 1): J => ({
  type: 'paragraph',
  attrs: { gap },
  content: text ? [{ type: 'text', text }] : [],
});
const item = (...content: J[]): J => ({ type: 'listItem', attrs: { prefix: null }, content });
const list = (items: J[], gap = 1, type = 'bulletList'): J => ({
  type,
  attrs: { gap, marker: type === 'bulletList' ? '*' : '#' },
  content: items,
});
const doc = (...content: J[]) =>
  wikiSchema.nodeFromJSON({ type: 'doc', attrs: { eol: 'lf', tail: 0 }, content });
const rich = (text: string) => {
  const l = loadWiki(text);
  if (!('doc' in l)) throw new Error('not rich');
  return l;
};

describe('withoutEmptyListItems', () => {
  it('drops a trailing empty item and keeps list attrs', () => {
    const d = doc(list([item(para('one', 0)), item(para('', 0))], 0));
    const out = withoutEmptyListItems(d).toJSON();
    expect(out.content[0].content).toHaveLength(1);
    expect(out.content[0].attrs.marker).toBe('*');
  });

  it('removes an all-empty list; the next block takes its gap', () => {
    const d = doc(list([item(para('', 0))], 0), para('after', 1));
    const out = withoutEmptyListItems(d).toJSON();
    expect(out.content).toHaveLength(1);
    expect(out.content[0].type).toBe('paragraph');
    expect(out.content[0].attrs.gap).toBe(0);
  });

  it('a doc with only an empty-item list becomes one empty paragraph with the gap', () => {
    const d = doc(list([item(para('', 0))], 0));
    const out = withoutEmptyListItems(d).toJSON();
    expect(out.content).toHaveLength(1);
    expect(out.content[0].type).toBe('paragraph');
    expect(out.content[0].attrs.gap).toBe(0);
    expect(out.attrs.eol).toBe('lf');
  });

  it('keeps an item that only holds a nested list with text', () => {
    const d = doc(list([item(para('', 0), list([item(para('deep', 0))], 0, 'bulletList'))], 0));
    expect(withoutEmptyListItems(d)).toBe(d);
  });

  it('removes an all-empty nested list and then judges the parent again', () => {
    const d = doc(list([item(para('', 0), list([item(para('', 0))], 0))], 0), para('x'));
    const out = withoutEmptyListItems(d).toJSON();
    expect(out.content).toHaveLength(1);
    expect(out.content[0].type).toBe('paragraph');
  });

  it('treats whitespace-only items as empty', () => {
    const d = doc(list([item(para('a', 0)), item(para(' ', 0))], 0));
    expect(withoutEmptyListItems(d).toJSON().content[0].content).toHaveLength(1);
  });

  it('prunes lists inside blockquote', () => {
    const d = doc({
      type: 'blockquote',
      attrs: { gap: 0, form: 'bq', bodyLead: '\n', bodyTail: '\n' },
      content: [list([item(para('a', 0)), item(para('', 0))], 0)],
    });
    const out = withoutEmptyListItems(d).toJSON();
    expect(out.content[0].content[0].content).toHaveLength(1);
  });

  it('returns the same instance when nothing is empty', () => {
    const d = doc(list([item(para('a', 0))], 0));
    expect(withoutEmptyListItems(d)).toBe(d);
  });
});

describe('saveWiki with the transient rule', () => {
  it("an empty trailing item is 'unchanged'", () => {
    const l = rich('* one');
    const json = structuredClone(l.doc) as J;
    const first = json.content?.[0] as J;
    first.content = [...(first.content ?? []), item(para('', 0))];
    const cur = wikiSchema.nodeFromJSON(json);
    expect(saveWiki(l, cur)).toEqual({ kind: 'unchanged', text: '* one' });
  });

  it('an empty item does not hide a real failure', () => {
    const l = rich('* one');
    const cur = doc(list([item(para('one', 0)), item(para('', 0))], 0), para('bq. x', 1));
    expect(saveWiki(l, cur).kind).toBe('failed');
  });
});
