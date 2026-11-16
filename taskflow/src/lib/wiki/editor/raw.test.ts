import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

const blocks = (text: string): JSONContent[] => parseWiki(text).doc.content ?? [];
const types = (text: string): string[] => blocks(text).map((b) => b.type ?? '');

function check(text: string): void {
  const { doc, slices } = parseWiki(text);
  wikiSchema.nodeFromJSON(doc).check();
  expect(slices.join('')).toBe(text.replace(/\r\n?/g, '\n'));
}

describe('parseWiki segmenter', () => {
  it('unknown macro with a closer is one raw block', () => {
    const src = '{expand:title=More}\nhidden\n{expand}';
    check(src);
    expect(blocks(src)).toHaveLength(1);
    expect(blocks(src)[0]?.type).toBe('rawBlock');
    expect(blocks(src)[0]?.attrs?.raw).toBe(src);
  });

  it('unclosed known macro runs to the end of its block', () => {
    const src = '{panel:title=T}\nbody\n\nAfter';
    check(src);
    expect(types(src)).toEqual(['rawBlock', 'paragraph']);
    expect(blocks(src)[0]?.attrs?.raw).toBe('{panel:title=T}\nbody');
  });

  it('mismatched closers become raw spans', () => {
    for (const src of ['{noformat}a {code}b{code} c{noformat}', '{noformat}x{code}']) {
      check(src);
      expect(types(src)).toEqual(['rawBlock']);
      expect(blocks(src)[0]?.attrs?.raw).toBe(src);
    }
  });

  it('code openers outside the jira2md grammar are raw, inside are code blocks', () => {
    const outside = '{code:language=java}\nx\n{code}';
    check(outside);
    expect(types(outside)).toEqual(['rawBlock']);
    const titled = '{code:title=a.java|borderStyle=solid}\nx\n{code}';
    check(titled);
    expect(types(titled)).toEqual(['codeBlock']);
    expect(blocks(titled)[0]?.attrs?.open).toBe('{code:title=a.java|borderStyle=solid}');
  });

  it('code block keeps trailing spaces and body spelling', () => {
    const src = '{code:java}\nint a;  \n{code}';
    check(src);
    const b = blocks(src)[0];
    expect(b?.type).toBe('codeBlock');
    expect(b?.attrs?.language).toBe('java');
    expect(b?.attrs?.bodyLead).toBe('\n');
    expect(b?.attrs?.bodyTail).toBe('\n');
    expect(b?.content?.[0]?.text).toBe('int a;  ');
  });

  it('headings, rules, gaps and hard breaks', () => {
    expect(blocks('h1.Title')[0]?.attrs).toMatchObject({ level: 1, sep: '' });
    expect(blocks('h2.  Two')[0]?.attrs).toMatchObject({ level: 2, sep: '  ' });
    expect(blocks('----')[0]).toMatchObject({ type: 'horizontalRule', attrs: { src: '----' } });
    expect(types('a ---- b')).toEqual(['paragraph']);
    const gaps = blocks('a\n\n\n\nb');
    expect(gaps.map((b) => b.attrs?.gap)).toEqual([0, 3]);
    expect(types('h3. X\nBody')).toEqual(['heading', 'paragraph']);
    expect(blocks('h3. X\nBody')[1]?.attrs?.gap).toBe(0);
    expect(blocks('a\nb')[0]?.content).toEqual([
      { type: 'text', text: 'a' },
      { type: 'hardBreak', attrs: { src: '\n' } },
      { type: 'text', text: 'b' },
    ]);
  });

  it('unmodelled families are grouped into raw runs', () => {
    const src = '* a\n* b\n\nbq. quote\n\n|a|b|\n\n{quote}\nq\n{quote}\n\n{color:red}x{color}';
    check(src);
    expect(types(src)).toEqual(['rawBlock', 'rawBlock', 'rawBlock', 'rawBlock', 'rawBlock']);
  });

  it('raw atoms are substrings of the source', () => {
    const src = 'p\n{info}\nx\n{info}\n\n- item\n{unknown}\nq\n{unknown}';
    check(src);
    for (const b of blocks(src)) {
      if (b.type === 'rawBlock') expect(src).toContain(String(b.attrs?.raw));
    }
  });

  it('never throws on degenerate input', () => {
    for (const src of ['', '\n\n', '{', '{code}', 'x'.repeat(50_000), '\r\n\r\n', '  \n ']) {
      check(src);
    }
  });
});
