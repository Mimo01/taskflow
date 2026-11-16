import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WikiEmitError, emitWiki } from './emit';
import { parseWiki } from './parse/blocks';

const text = (t: string, marks?: JSONContent['marks']): JSONContent =>
  marks ? { type: 'text', text: t, marks } : { type: 'text', text: t };
const para = (...kids: JSONContent[]): JSONContent =>
  kids.length ? { type: 'paragraph', content: kids } : { type: 'paragraph' };
const doc = (...blocks: JSONContent[]): JSONContent => ({ type: 'doc', content: blocks });
const raw = (r: string): JSONContent => ({ type: 'rawBlock', attrs: { raw: r } });
const code = (body: string): JSONContent => ({
  type: 'codeBlock',
  content: [{ type: 'text', text: body }],
});
const panel = (...kids: JSONContent[]): JSONContent => ({
  type: 'panel',
  attrs: { type: 'info' },
  content: kids,
});
const item = (...kids: JSONContent[]): JSONContent => ({ type: 'listItem', content: kids });
const list = (...items: JSONContent[]): JSONContent => ({ type: 'bulletList', content: items });
const cell = (...kids: JSONContent[]): JSONContent => ({ type: 'tableCell', content: kids });
const row = (...cells: JSONContent[]): JSONContent => ({ type: 'tableRow', content: cells });
const table = (headerless: boolean, ...rows: JSONContent[]): JSONContent => ({
  type: 'table',
  attrs: { headerless },
  content: rows,
});
const oneCell = (...kids: JSONContent[]): JSONContent => doc(table(true, row(cell(...kids))));

describe('CR-03 container children', () => {
  it('emits a rawBlock after an item paragraph verbatim', () => {
    const out = emitWiki(doc(list(item(para(text('a')), raw('{status:x}')))));
    expect(out).toBe('* a\n{status:x}');
    expect(JSON.stringify(parseWiki(out).doc)).toContain('"rawInline"');
  });

  it('emits a raw-only cell verbatim', () => {
    expect(emitWiki(oneCell(raw('{foo}')))).toBe('|{foo}|');
  });

  it('joins a paragraph and a raw block in a cell with a hard break', () => {
    expect(emitWiki(oneCell(para(text('a')), raw('{foo}')))).toBe('|a\\\\{foo}|');
  });

  it('throws for a code block or panel inside a list item', () => {
    expect(() => emitWiki(doc(list(item(para(text('a')), code('x = 1')))))).toThrow(WikiEmitError);
    expect(() => emitWiki(doc(list(item(para(text('a')), panel(para(text('p')))))))).toThrow(
      /list item/,
    );
  });

  it.each([
    ['code block', code('x')],
    ['table', table(true, row(cell(para(text('z')))))],
    ['heading', { type: 'heading', attrs: { level: 1 }, content: [text('h')] }],
    ['blockquote', { type: 'blockquote', content: [para(text('q'))] }],
  ] as [string, JSONContent][])('throws for a %s inside a table cell', (_n, kid) => {
    expect(() => emitWiki(oneCell(kid))).toThrow(WikiEmitError);
  });

  it('throws for a multi-line raw block in an item and a newline or pipe raw in a cell', () => {
    expect(() => emitWiki(doc(list(item(para(text('a')), raw('{x}\ny{x}')))))).toThrow(
      WikiEmitError,
    );
    expect(() => emitWiki(oneCell(raw('{a}\nb{a}')))).toThrow(WikiEmitError);
    expect(() => emitWiki(oneCell(raw('{a|b}')))).toThrow(WikiEmitError);
  });

  it('throws for an unknown node type instead of flattening to text', () => {
    expect(() => emitWiki(doc({ type: 'bogus', content: [text('lost')] }))).toThrow(WikiEmitError);
    expect(() => emitWiki(doc(para({ type: 'bogus' })))).toThrow(WikiEmitError);
  });

  it('still emits a panel in a cell inline', () => {
    expect(emitWiki(oneCell(panel(para(text('x')))))).toBe('|{info}\nx\n{info}|');
  });
});
