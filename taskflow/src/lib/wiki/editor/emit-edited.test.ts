import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WikiEmitError, emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { checkSaved } from './save-check';
import type { WikiDocJSON } from './types';

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

const B = [{ type: 'bold' }];
const I = [{ type: 'italic' }];
const hb = (): JSONContent => ({ type: 'hardBreak' });
const parsed = (s: string): JSONContent => parseWiki(s).doc;
const heading = (...kids: JSONContent[]): JSONContent => ({
  type: 'heading',
  attrs: { level: 1 },
  content: kids,
});
const nodeTypes = (n: JSONContent): string[] => [
  n.type ?? '',
  ...(n.content ?? []).flatMap(nodeTypes),
];

describe('CR-04 cells and breaks', () => {
  it('an empty unpadded user-created cell emits a single space', () => {
    const out = emitWiki(doc(table(true, row(cell(para()), cell(para(text('b')))))));
    expect(out).toBe('| |b|');
    const t = parsed(out).content?.[0];
    expect(t?.type).toBe('table');
    expect(t?.content?.[0]?.content).toHaveLength(2);
  });

  it('clearing a parsed cell keeps the row a table', () => {
    const d = parsed('|a|b|c|');
    const middle = d.content?.[0]?.content?.[0]?.content?.[1];
    const p = middle?.content?.[0];
    if (!p) throw new Error('no paragraph');
    delete p.content;
    const out = emitWiki(d);
    expect(out).toBe('|a| |c|');
    expect(parsed(out).content?.[0]?.content?.[0]?.content).toHaveLength(3);
  });

  it('empty header cells get a space too', () => {
    const t = table(
      false,
      row(
        { type: 'tableHeader', content: [para()] },
        { type: 'tableHeader', content: [para(text('h'))] },
      ),
    );
    expect(emitWiki(doc(t))).toBe('|| ||h||');
  });

  it('a cell with recorded padding is unchanged', () => {
    expect(emitWiki(parsed('| a |'))).toBe('| a |');
  });

  it('hard breaks use the line-safe spelling per context', () => {
    expect(emitWiki(oneCell(para(text('a'), hb(), text('b'))))).toBe('|a\\\\b|');
    expect(emitWiki(doc(heading(text('a'), hb(), text('b'))))).toBe('h1. a\\\\b');
    expect(emitWiki(doc({ type: 'blockquote', content: [para(text('a'), hb(), text('b'))] }))).toBe(
      'bq. a\\\\b',
    );
    expect(emitWiki(doc(para(text('a'), hb(), text('b'))))).toBe('a\nb');
    expect(emitWiki(doc(list(item(para(text('a'), hb(), text('b'))))))).toBe('* a\nb');
  });

  it('a parsed open-row continuation break keeps its newline spelling in a cell', () => {
    const src = '|a\nb|';
    expect(emitWiki(parsed(src))).toBe(src);
  });

  it('re-parses the emitted shapes with a hard break inside', () => {
    for (const [d, outer] of [
      [oneCell(para(text('a'), hb(), text('b'))), 'table'],
      [doc(heading(text('a'), hb(), text('b'))), 'heading'],
      [doc({ type: 'blockquote', content: [para(text('a'), hb(), text('b'))] }), 'blockquote'],
    ] as [JSONContent, string][]) {
      const back = parsed(emitWiki(d));
      expect(back.content).toHaveLength(1);
      expect(back.content?.[0]?.type).toBe(outer);
      expect(nodeTypes(back)).toContain('hardBreak');
    }
  });
});

describe('edge whitespace outside marks', () => {
  const marked = (d: JSONContent): string[] =>
    (d.content?.[0]?.content ?? []).filter((n) => n.marks?.length).map((n) => n.text ?? '');

  it.each([
    [[text('hello ', B), text('world')], '*hello* world'],
    [[text('say'), text(' hello', B)], 'say *hello*'],
    [[text('x'), text(' a b ', I), text('y')], 'x _a b_ y'],
    [[text('hello\t', B), text('z')], '*hello*\tz'],
    [[text('see '), text('hello ', B)], 'see *hello*'],
  ] as [JSONContent[], string][])('hoists spaces out of case %#', (kids, expected) => {
    const out = emitWiki(doc(para(...kids)));
    expect(out).toBe(expected);
    const back = parsed(out);
    expect(marked(back).every((t) => t === t.trim())).toBe(true);
    expect(marked(back).length).toBeGreaterThan(0);
  });

  it('a whitespace-only canonical run emits no delimiters', () => {
    expect(emitWiki(doc(para(text('a'), text(' ', B), text('b'))))).toBe('a b');
  });

  it('does not mutate the input document', () => {
    const d = doc(para(text('hello ', B), text('world')));
    const before = JSON.stringify(d);
    emitWiki(d);
    expect(JSON.stringify(d)).toBe(before);
  });

  it.each([
    '{*} a {*}',
    '{_} a {_}',
    '{-} a {-}',
    '{+} a {+}',
    '^ a ^',
    '~ a ~',
    '{color:red} a {color}',
  ])('keeps %s byte-identical after an unrelated edit', (first) => {
    const d = parsed(`${first}\n\nother`);
    const last = d.content?.[d.content.length - 1]?.content?.[0];
    if (!last) throw new Error('no text');
    last.text = 'otherx';
    expect(emitWiki(d)).toBe(`${first}\n\notherx`);
  });

  it('user-created sup/sub/color over edge spaces is not hoisted', () => {
    expect(emitWiki(doc(para(text(' a ', [{ type: 'sup' }]))))).toBe('^ a ^');
    expect(emitWiki(doc(para(text(' a ', [{ type: 'sub' }]))))).toBe('~ a ~');
    expect(emitWiki(doc(para(text(' a ', [{ type: 'color', attrs: { value: 'red' } }]))))).toBe(
      '{color:red} a {color}',
    );
  });
});

/** The first node (depth-first) of `type` in a parsed doc. */
function firstOf(d: JSONContent, type: string): JSONContent {
  const hit = (n: JSONContent): JSONContent | undefined => {
    if (n.type === type) return n;
    for (const k of n.content ?? []) {
      const r = hit(k);
      if (r) return r;
    }
    return undefined;
  };
  const found = hit(d);
  if (!found) throw new Error(`no ${type} in doc`);
  return found;
}

/** Parses `src`, sets attributes on the first `type` node (spelling untouched), and emits. */
function editedAttrs(src: string, type: string, attrs: Record<string, unknown>): string {
  const d = parseWiki(src).doc;
  const n = firstOf(d, type);
  n.attrs = { ...n.attrs, ...attrs };
  return emitWiki(d);
}

function editedMark(src: string, value: string): string {
  const d = parseWiki(src).doc;
  const walk = (n: JSONContent): void => {
    for (const m of n.marks ?? []) if (m.type === 'color') m.attrs = { ...m.attrs, value };
    for (const k of n.content ?? []) walk(k);
  };
  walk(d);
  return emitWiki(d);
}

describe('WR-02 edited attributes', () => {
  it('writes an edited mention id instead of the recorded spelling', () => {
    expect(editedAttrs('[~jdoe]', 'mention', { id: 'asmith' })).toBe('[~asmith]');
    expect(editedAttrs('[~accountid:placeholder-0001]', 'mention', { id: 'asmith' })).toBe(
      '[~asmith]',
    );
  });

  it('keeps an untouched mention spelling', () => {
    expect(emitWiki(parseWiki('[~accountid:placeholder-0001]').doc)).toBe(
      '[~accountid:placeholder-0001]',
    );
  });

  it('writes an edited image name or params', () => {
    expect(editedAttrs('!a.png|width=3!', 'image', { name: 'b.png' })).toBe('!b.png|width=3!');
    expect(editedAttrs('!a.png|width=3!', 'image', { params: 'thumbnail' })).toBe(
      '!a.png|thumbnail!',
    );
  });

  it('writes an edited attachment label', () => {
    expect(editedAttrs('[x|^f.pdf]', 'attachment', { label: 'y' })).toBe('[y|^f.pdf]');
  });

  it('writes an edited color value', () => {
    expect(editedMark('{color:red}a{color}', 'blue')).toBe('{color:blue}a{color}');
    expect(editedMark('{color:red}a\n\nb{color}', 'blue')).toBe('{color:blue}a\n\nb{color}');
  });

  it('writes an edited code language', () => {
    expect(editedAttrs('{code:java}\nx\n{code}', 'codeBlock', { language: 'python' })).toBe(
      '{code:python}\nx\n{code}',
    );
  });

  it('keeps an unedited image and attachment spelling', () => {
    expect(emitWiki(parseWiki('!a.png|width=3!').doc)).toBe('!a.png|width=3!');
    expect(emitWiki(parseWiki('[x|^f.pdf]').doc)).toBe('[x|^f.pdf]');
  });

  it('keeps an unedited code opener', () => {
    expect(emitWiki(parseWiki('{code:java}\nx\n{code}').doc)).toBe('{code:java}\nx\n{code}');
  });
});

describe('breaks that would leave a blank line', () => {
  const br: JSONContent = { type: 'hardBreak' };
  const cases: [string, JSONContent, string][] = [
    ['trailing', doc(para(text('vsmvofo'), br)), 'vsmvofo\\\\'],
    ['leading', doc(para(br, text('a'))), '\\\\a'],
    ['doubled', doc(para(text('a'), br, br, text('b'))), 'a\\\\\\\\b'],
    ['blank-only line', doc(para(text('a'), br, text('  '), br, text('b'))), 'a\\\\  \\\\b'],
    ['trailing in a list item', doc(list(item(para(text('a'), br)))), '* a\\\\'],
  ];
  it.each(cases)('%s break is spelled \\\\ and reads back', (_, d, out) => {
    const emitted = emitWiki(d);
    expect(emitted).toBe(out);
    expect(checkSaved(d as WikiDocJSON, emitted)).toBeNull();
  });

  it('keeps a single break between text as a newline', () => {
    expect(emitWiki(doc(para(text('a'), br, text('b'))))).toBe('a\nb');
  });
});
