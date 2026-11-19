import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from '../corpus.fixtures';
import { wikiToHtml } from '../pipeline';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { checkSaved } from './save-check';
import { wikiSchema } from './schema';

const fixture = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';
const parse = (s: string): JSONContent => parseWiki(s).doc;
const rt = (s: string): string => emitWiki(parse(s));

type Marked = { text: string; marks: { type: string; attrs?: Record<string, unknown> }[] };
function inlines(node: JSONContent, out: Marked[] = []): Marked[] {
  if (node.type === 'text') out.push({ text: node.text ?? '', marks: node.marks ?? [] });
  for (const c of node.content ?? []) inlines(c, out);
  return out;
}
const withMark = (s: string, type: string): Marked[] =>
  inlines(parse(s)).filter((m) => m.marks.some((k) => k.type === type));
const markTypes = (s: string): Set<string> =>
  new Set(inlines(parse(s)).flatMap((m) => m.marks.map((k) => k.type)));

describe('formatting marks', () => {
  it('models each delimiter pair and replays it byte-identically', () => {
    const wiki = fixture('inline/formatting.wiki');
    const types = markTypes(wiki);
    for (const t of ['bold', 'italic', 'strike', 'underline', 'sup', 'sub'])
      expect(types.has(t), t).toBe(true);
    expect(withMark(wiki, 'bold')[0]?.text).toBe('bold');
    expect(rt(wiki)).toBe(wiki);
    wikiSchema.nodeFromJSON(parse(wiki)).check();
  });

  it('records brace spellings', () => {
    const wiki = fixture('inline/brace-bold.wiki');
    const b = withMark(wiki, 'bold');
    expect(b[0]?.marks[0]?.attrs).toMatchObject({ open: '{*}', close: '{*}' });
    expect(withMark(wiki, 'italic')[0]?.marks[0]?.attrs).toMatchObject({ open: '{_}' });
    expect(rt(wiki)).toBe(wiki);
  });

  it('models monospace, including teletype braces, and not a plain-space opener', () => {
    const tt = fixture('monospace/teletype-braces.wiki');
    const mono = withMark(tt, 'mono');
    expect(mono.some((m) => m.marks[0]?.attrs?.open === '{{{}')).toBe(true);
    expect(mono[0]?.marks[0]?.attrs?.close).toBe('{}}}');
    expect(rt(tt)).toBe(tt);
    const plain = fixture('monospace/plain-space.wiki');
    expect(withMark(plain, 'mono').map((m) => m.text)).toEqual(['code']);
    expect(rt(plain)).toBe(plain);
    const nbsp = fixture('monospace/nbsp.wiki');
    expect(withMark(nbsp, 'mono').map((m) => m.text)).toEqual([' code']);
    expect(rt(nbsp)).toBe(nbsp);
  });

  it('reads {{word}} as monospace even when the word is not a known macro name', () => {
    const wiki = 'a {{word}} b';
    expect(withMark(wiki, 'mono').map((m) => m.text)).toEqual(['word']);
    expect(rt(wiki)).toBe(wiki);
  });

  it('nests marks and keeps their recorded order', () => {
    const t = inlines(parse('*_both_*'));
    expect(t).toHaveLength(1);
    expect(t[0]?.marks.map((m) => m.type).sort()).toEqual(['bold', 'italic']);
    for (const s of ['*_both_*', '_*both*_', '*a _b_ c*', '{{a}}{{b}}', '*a*_b_', '-a- -b- *x*'])
      expect(rt(s), s).toBe(s);
  });

  it('shows a mark only where the renderer does', () => {
    for (const s of ['2 * 3 * 4', 'a_b_c', 'a + b + c', '-a- b', '??cite??']) {
      expect(markTypes(s).size, s).toBe(0);
      expect(wikiToHtml(s), s).not.toMatch(/<(strong|em|ins|del|cite)>/);
      expect(rt(s), s).toBe(s);
    }
    for (const [s, tag, type] of [
      ['a*b*c', 'strong', 'bold'],
      ['a ^ b ^ c', 'sup', 'sup'],
      ['x ~a b~ y', 'sub', 'sub'],
      ['a +b+ c', 'ins', 'underline'],
    ] as const) {
      expect(markTypes(s).has(type), s).toBe(true);
      expect(wikiToHtml(s), s).toContain(`<${tag}>`);
    }
  });

  it('keeps atoms inside marks', () => {
    const wiki = '*done (/) now*';
    const nodes = parse(wiki).content?.[0]?.content ?? [];
    expect(nodes.map((n) => n.type)).toEqual(['text', 'emoticon', 'text']);
    expect(nodes.every((n) => n.marks?.[0]?.type === 'bold')).toBe(true);
    expect(rt(wiki)).toBe(wiki);
  });

  it('stays linear on delimiter-heavy lines', () => {
    const start = Date.now();
    for (const d of ['*a ', '_a ', '-a ', '+a ', '{*}', '{{', '^', '~']) parse(d.repeat(50_000));
    expect(Date.now() - start).toBeLessThan(5000);
  });
});

describe('links', () => {
  it('models named and bare bracket links', () => {
    const wiki = fixture('inline/links-underscores.wiki');
    const links = withMark(wiki, 'link');
    expect(links.map((l) => l.marks[0]?.attrs)).toMatchObject([
      { form: 'named', href: 'https://example.com/a_b_c' },
      { form: 'bare', href: 'https://example.com/x_y' },
    ]);
    expect(links[0]?.text).toBe('label');
    expect(rt(wiki)).toBe(wiki);
  });

  it('leaves non-links as text', () => {
    for (const s of ['[a|b|c]', '[foo]', '[|x]', '[x|]']) {
      expect(markTypes(s).has('link'), s).toBe(false);
      expect(rt(s), s).toBe(s);
    }
  });
});

describe('user-created marks (D-08)', () => {
  const para = (...content: JSONContent[]): JSONContent => ({
    type: 'doc',
    content: [{ type: 'paragraph', attrs: { gap: 0 }, content }],
  });
  const m = (type: string, attrs?: Record<string, unknown>) => ({ type, attrs });

  it('emits the toolbar spellings', () => {
    expect(emitWiki(para({ type: 'text', text: 'x', marks: [m('bold')] }))).toBe('*x*');
    expect(emitWiki(para({ type: 'text', text: 'x', marks: [m('italic')] }))).toBe('_x_');
    expect(emitWiki(para({ type: 'text', text: 'x', marks: [m('mono')] }))).toBe('{{x}}');
    expect(
      emitWiki(
        para({ type: 'text', text: 'label', marks: [m('link', { href: 'https://example.com' })] }),
      ),
    ).toBe('[label|https://example.com]');
  });

  it('emits a mark across a run of children once', () => {
    const doc = para(
      { type: 'text', text: 'a', marks: [m('bold')] },
      { type: 'emoticon', attrs: { src: '(/)' }, marks: [m('bold')] },
      { type: 'text', text: 'b' },
    );
    expect(emitWiki(wikiSchema.nodeFromJSON(doc))).toBe('*a(/)*b');
  });

  // Monospace content is literal (no nested marks), so mono must be the innermost mark and
  // must close where the other marks of its run change (debug: mono-bold-literal).
  it('keeps monospace innermost so marks inside it read back', () => {
    const cases: JSONContent[][] = [
      [
        { type: 'text', text: 'dv', marks: [m('bold'), m('mono')] },
        { type: 'text', text: 'fdv', marks: [m('mono')] },
      ],
      [
        { type: 'text', text: 'ab', marks: [m('mono')] },
        { type: 'text', text: 'cd', marks: [m('italic'), m('mono')] },
      ],
      [{ type: 'text', text: 'x', marks: [m('mono', { span: 0 }), m('bold')] }],
      [
        ...Array.from({ length: 7 }, () => ({ type: 'hardBreak' })),
        { type: 'text', text: 'dv', marks: [m('bold'), m('mono')] },
        { type: 'text', text: 'fdv', marks: [m('mono')] },
      ],
    ];
    for (const content of cases) {
      const doc = wikiSchema.nodeFromJSON(para(...content));
      const out = emitWiki(doc);
      expect(checkSaved(doc.toJSON(), out), out).toBeNull();
    }
  });
});
