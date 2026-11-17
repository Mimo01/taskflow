import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from '../corpus.fixtures';
import { wikiToHtml } from '../pipeline';
import { emitWiki } from './emit';
import { loadWiki, saveWiki } from './engine';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

const fixture = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';
const parse = (s: string): JSONContent => parseWiki(s).doc;
const blocks = (s: string): JSONContent[] => parse(s).content ?? [];
const kinds = (nodes: readonly JSONContent[] | undefined): string[] =>
  (nodes ?? []).map((n) => n.type ?? '');
const cellText = (cell: JSONContent | undefined): string =>
  (cell?.content?.[0]?.content ?? [])
    .map((n) => {
      const link = n.marks?.find((m) => m.type === 'link');
      if (link && typeof link.attrs?.src === 'string') return link.attrs.src;
      return n.text ?? (typeof n.attrs?.src === 'string' ? n.attrs.src : '\n');
    })
    .join('');

const MODELLED = [
  'tables/headerless.wiki',
  'tables/header-row.wiki',
  'tables/headerless-with-links.wiki',
  'tables/inline-callout-cell.wiki',
  'tables/panel-in-cell-multi.wiki',
  'tables/open-row-merge.wiki',
  'tables/cell-formatting.wiki',
];

describe('tables', () => {
  it.each(MODELLED)('round-trips %s byte-identically with no raw atoms', (path) => {
    const wiki = fixture(path);
    expect(JSON.stringify(parse(wiki))).not.toContain('rawBlock');
    wikiSchema.nodeFromJSON(parse(wiki)).check();
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('models a header-less table without a synthetic header row', () => {
    const wiki = fixture('tables/headerless.wiki');
    const t = blocks(wiki)[0];
    expect(t?.type).toBe('table');
    expect(t?.attrs?.headerless).toBe(true);
    expect(t?.content).toHaveLength(3);
    expect(kinds(t?.content?.[0]?.content)).toEqual(['tableCell', 'tableCell']);
    expect(emitWiki(parse(wiki))).not.toContain('||');
  });

  it('models a header row as tableHeader cells', () => {
    const t = blocks(fixture('tables/header-row.wiki'))[0];
    expect(t?.attrs?.headerless).toBe(false);
    expect(kinds(t?.content?.[0]?.content)).toEqual(['tableHeader', 'tableHeader']);
  });

  it('splits cells bracket-aware and keeps escaped pipes', () => {
    const t = blocks(fixture('tables/headerless-with-links.wiki'))[0];
    expect(t?.content?.[0]?.content).toHaveLength(2);
    expect(cellText(t?.content?.[0]?.content?.[0])).toBe('[Docs|https://example.com/docs]');
    const e = blocks('|a\\|b|c|')[0];
    expect(e?.content?.[0]?.content).toHaveLength(2);
    expect(cellText(e?.content?.[0]?.content?.[0])).toBe('a\\|b');
    expect(emitWiki(parse('|a\\|b|c|'))).toBe('|a\\|b|c|');
  });

  it('models panels in cells', () => {
    const t = blocks(fixture('tables/panel-in-cell-multi.wiki'))[0];
    const same = t?.content?.[1]?.content?.[1]?.content?.[0];
    expect(same?.type).toBe('panel');
    expect(same?.attrs).toMatchObject({ bodyLead: '', bodyTail: '' });
    const multi = t?.content?.[2]?.content?.[1]?.content?.[0];
    expect(multi?.attrs).toMatchObject({ type: 'panel', params: 'title=T' });
    expect(multi?.content?.[0]?.content?.map((n) => n.type)).toEqual(['text', 'hardBreak', 'text']);
  });

  it.each([
    'tables/mixed-header-row.wiki',
    'tables/code-in-cell.wiki',
    'tables/single-line-inline.wiki',
  ])('keeps %s raw (D-10)', (path) => {
    const wiki = fixture(path);
    expect(kinds(blocks(wiki))).toEqual(['rawBlock']);
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('keeps a row that never closes within 50 lines raw', () => {
    const src = `|open\n${Array.from({ length: 60 }, () => 'more').join('\n')}`;
    expect(kinds(blocks(src))).toEqual(['rawBlock']);
    expect(emitWiki(parse(src))).toBe(src);
  });

  it('records cell padding', () => {
    const src = '| a | b |';
    const cell = blocks(src)[0]?.content?.[0]?.content?.[0];
    expect(cell?.attrs).toMatchObject({ padL: ' ', padR: ' ' });
    expect(emitWiki(parse(src))).toBe(src);
  });

  it('re-emits only the edited row differently', () => {
    const wiki = fixture('tables/cell-formatting.wiki');
    const doc = parse(wiki);
    const row = doc.content?.[0]?.content?.[1];
    const first = row?.content?.[0]?.content?.[0];
    if (first) first.content = [{ type: 'text', text: 'Changed' }];
    const lines = wiki.split('\n');
    const out = emitWiki(doc).split('\n');
    expect(out[1]).toBe('|Changed|_Italic description_|');
    expect(out.filter((l, i) => l !== lines[i])).toHaveLength(1);
  });

  it('emits a user-created table with a header row and no padding (D-08)', () => {
    const cell = (type: string, text: string): JSONContent => ({
      type,
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [cell('tableHeader', 'h1'), cell('tableHeader', 'h2')] },
            { type: 'tableRow', content: [cell('tableCell', 'c1'), cell('tableCell', 'c2')] },
          ],
        },
      ],
    };
    expect(emitWiki(doc)).toBe('||h1||h2||\n|c1|c2|');
  });
});

describe('escape-aware cell openers (98-01)', () => {
  it('models a cell with an escaped {code} and round-trips it', () => {
    const wiki = '|a \\{code}x\\{code} b|';
    const doc = parse(wiki);
    expect(kinds(doc.content)).toEqual(['table']);
    expect(emitWiki(doc)).toBe(wiki);
  });

  it('keeps an unescaped {code} cell raw (D-10)', () => {
    expect(kinds(blocks('|a {code}x{code} b|'))).toEqual(['rawBlock']);
  });

  it('treats escaped and unescaped {noformat} the same way', () => {
    expect(kinds(blocks('|a \\{noformat}x\\{noformat} b|'))).toEqual(['table']);
    expect(kinds(blocks('|a {noformat}x{noformat} b|'))).toEqual(['rawBlock']);
  });

  it('WR-02: an even backslash run before {panel} is a real opener, odd is escaped', () => {
    const hasPanel = (wiki: string): boolean =>
      JSON.stringify(parse(wiki)).includes('"type":"panel"');
    const hasCallout = (wiki: string): boolean => wikiToHtml(wiki).includes('data-callout');
    expect(hasPanel('|a \\\\{panel}x{panel} b|')).toBe(true);
    expect(hasPanel('|a \\{panel}x{panel} b|')).toBe(false);
    expect(hasCallout('|a \\\\{panel}x{panel} b|')).toBe(hasPanel('|a \\\\{panel}x{panel} b|'));
    expect(hasCallout('|a \\{panel}x{panel} b|')).toBe(hasPanel('|a \\{panel}x{panel} b|'));
  });

  it('saves a user-typed {code} cell instead of failing closed', () => {
    const load = loadWiki('|a|b|');
    if (load.kind === 'failed') throw new Error('load failed');
    const doc = wikiSchema.nodeFromJSON(load.doc).toJSON();
    const cell = doc.content[0].content[0].content[0];
    cell.content = [{ type: 'paragraph', content: [{ type: 'text', text: '{code}x{code}' }] }];
    const res = saveWiki(load, wikiSchema.nodeFromJSON(doc));
    expect(res.kind).toBe('saved');
    if (res.kind !== 'saved') return;
    // The emitter escapes the opener, so the text reads back as a modelled table.
    expect(res.text).toContain('\\{code}');
    const again = loadWiki(res.text);
    expect(again.kind).toBe('rich');
    expect(kinds(blocks(res.text))).toEqual(['table']);
    expect(emitWiki(parse(res.text))).toBe(res.text);
  });
});
