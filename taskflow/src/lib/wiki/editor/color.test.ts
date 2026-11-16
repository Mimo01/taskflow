import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from '../corpus.fixtures';
import { isEquivalent } from '../equivalence';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { COLOR_VALUE, isSafeColor } from './parse/color';
import { wikiSchema } from './schema';

const fixture = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';
const parse = (s: string): JSONContent => parseWiki(s).doc;
const rt = (s: string): string => emitWiki(parse(s));
const blocks = (s: string): JSONContent[] => parse(s).content ?? [];

function find(node: JSONContent, type: string, into: JSONContent[] = []): JSONContent[] {
  if (node.type === type) into.push(node);
  for (const c of node.content ?? []) find(c, type, into);
  return into;
}
const colorMarks = (s: string): JSONContent[] => {
  const out: JSONContent[] = [];
  const walk = (n: JSONContent): void => {
    for (const m of n.marks ?? []) if (m.type === 'color') out.push(m);
    for (const c of n.content ?? []) walk(c);
  };
  walk(parse(s));
  return out;
};

describe('color value allowlist', () => {
  it('accepts hex and names only', () => {
    expect(COLOR_VALUE.source).toContain('#[0-9a-fA-F]{3,8}');
    for (const v of ['red', '#00875a', '#fff', '#12345678']) expect(isSafeColor(v)).toBe(true);
    for (const v of ['red;background:url(x)', 'expression(1)', '#12', '', 'a b', '#ggg', 'red\n']) {
      expect(isSafeColor(v)).toBe(false);
    }
  });
});

describe('intra-paragraph color', () => {
  it('round-trips macros/color.wiki as color marks with value and opener', () => {
    const wiki = fixture('macros/color.wiki');
    expect(JSON.stringify(parse(wiki))).not.toContain('rawBlock');
    expect(JSON.stringify(parse(wiki))).not.toContain('rawInline');
    wikiSchema.nodeFromJSON(parse(wiki)).check();
    expect(rt(wiki)).toBe(wiki);
    const marks = colorMarks(wiki);
    expect(marks.map((m) => m.attrs?.value)).toEqual(['red', '#0052cc']);
    expect(marks[1]?.attrs?.open).toBe('{color:#0052cc}');
  });

  it('nests other marks inside', () => {
    const wiki = '{color:red}*bold*{color}';
    expect(rt(wiki)).toBe(wiki);
    const p = blocks(wiki)[0];
    expect(p?.type).toBe('paragraph');
    const t = p?.content?.[0];
    expect(t?.marks?.map((m) => m.type).sort()).toEqual(['bold', 'color']);
    const mid = 'a *{color:blue}b{color}* c';
    expect(rt(mid)).toBe(mid);
  });

  it.each([
    'x {color:red;background:url(x)}a{color} y',
    '{color:expression(1)}a{color}',
    'x {color:#12}a{color}',
  ])('keeps an unsafe value raw: %s', (wiki) => {
    expect(rt(wiki)).toBe(wiki);
    expect(colorMarks(wiki)).toEqual([]);
    const raws = find(parse(wiki), 'rawInline').map((n) => n.attrs?.raw);
    expect(raws.length).toBe(1);
    expect(String(raws[0]).startsWith('{color:')).toBe(true);
    expect(String(raws[0]).endsWith('{color}')).toBe(true);
  });

  it('leaves an unclosed opener as text', () => {
    const wiki = 'x {color:red} y';
    expect(colorMarks(wiki)).toEqual([]);
    expect(find(parse(wiki), 'rawInline')).toEqual([]);
    expect(rt(wiki)).toBe(wiki);
  });

  it('emits a user-created mark in canonical form', () => {
    const doc: JSONContent = {
      type: 'doc',
      attrs: { eol: 'lf', tail: 0 },
      content: [
        {
          type: 'paragraph',
          attrs: { gap: 0 },
          content: [
            {
              type: 'text',
              text: 'hi',
              marks: [{ type: 'color', attrs: { value: '#ff0000', open: null, span: null } }],
            },
          ],
        },
      ],
    };
    wikiSchema.nodeFromJSON(doc).check();
    expect(emitWiki(doc)).toBe('{color:#ff0000}hi{color}');
  });
});

describe('multi-block color (D-09)', () => {
  const wiki = fixture('macros/color-multi-block.wiki');
  const pair = '{color:red}First paragraph\n\nSecond paragraph{color}';
  const doc = (): JSONContent => parse(pair);

  it('models two paragraphs sharing one span id and round-trips', () => {
    expect(JSON.stringify(parse(wiki))).not.toContain('rawBlock');
    wikiSchema.nodeFromJSON(parse(wiki)).check();
    expect(emitWiki(parse(wiki))).toBe(wiki);
    const marks = colorMarks(wiki).filter((m) => typeof m.attrs?.span === 'string');
    expect(marks.length).toBe(2);
    expect(marks[0]?.attrs?.span).toBe(marks[1]?.attrs?.span);
    expect(typeof marks[0]?.attrs?.span).toBe('string');
    expect(isEquivalent(wiki, emitWiki(parse(wiki)))).toBe(true);
  });

  const editText = (d: JSONContent, from: string, to: string): JSONContent =>
    JSON.parse(JSON.stringify(d).replace(from, to));

  it('Edit A: changing a word keeps one opener and closer', () => {
    const out = emitWiki(editText(doc(), 'Second paragraph', 'Second chapter'));
    expect(out).toBe('{color:red}First paragraph\n\nSecond chapter{color}');
    expect(isEquivalent(out, '{color:red}First paragraph\n\nSecond chapter{color}')).toBe(true);
    expect(emitWiki(parse(out))).toBe(out);
  });

  it('Edit B: an uncoloured paragraph between closes and reopens the span', () => {
    const d = doc();
    const content = [...(d.content ?? [])];
    content.splice(1, 0, {
      type: 'paragraph',
      attrs: { gap: 1 },
      content: [{ type: 'text', text: 'Plain' }],
    });
    content[2] = { ...(content[2] as JSONContent), attrs: { gap: 1 } };
    const out = emitWiki({ ...d, content });
    const want = '{color:red}First paragraph{color}\n\nPlain\n\n{color:red}Second paragraph{color}';
    expect(out).toBe(want);
    expect(isEquivalent(out, want)).toBe(true);
    expect(emitWiki(parse(out))).toBe(out);
  });

  it('Edit C: removing the mark from the first paragraph gives the second its own pair', () => {
    const d = doc();
    const content = [...(d.content ?? [])];
    content[0] = {
      ...(content[0] as JSONContent),
      content: (content[0]?.content ?? []).map((n) => ({ type: n.type, text: n.text })),
    };
    const out = emitWiki({ ...d, content });
    expect(out).toBe('First paragraph\n\n{color:red}Second paragraph{color}');
    expect(isEquivalent(out, 'First paragraph\n\n{color:red}Second paragraph{color}')).toBe(true);
  });

  it('spans a heading in the middle and a multi-line paragraph', () => {
    const w = '{color:blue}one\ntwo\n\nh2. Mid\n\nthree{color}';
    expect(JSON.stringify(parse(w))).not.toContain('rawBlock');
    expect(rt(w)).toBe(w);
    expect(blocks(w).map((b) => b.type)).toEqual(['paragraph', 'heading', 'paragraph']);
    expect(parseWiki(w).slices.join('')).toBe(w);
  });

  it.each([
    '{color:red}intro\n\n* item\n\nend{color}',
    '{color:red}intro\n\n|a|b|\n\nend{color}',
    '{color:red}intro\n\n{panel}x{panel}\n\nend{color}',
    '{color:red}\n\nend{color}',
    '{color:red}intro\n\nend{color} trailing',
    '{color:red;x:y}intro\n\nend{color}',
  ])('stays raw when it cannot be modelled: %s', (w) => {
    expect(rt(w)).toBe(w);
    expect(colorMarks(w).filter((m) => typeof m.attrs?.span === 'string')).toEqual([]);
    expect(JSON.stringify(parse(w))).toContain('rawBlock');
  });
});
