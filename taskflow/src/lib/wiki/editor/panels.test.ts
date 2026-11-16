import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from '../corpus.fixtures';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

const fixture = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';
const parse = (s: string): JSONContent => parseWiki(s).doc;
const blocks = (s: string): JSONContent[] => parse(s).content ?? [];
const kinds = (nodes: readonly JSONContent[] | undefined): string[] =>
  (nodes ?? []).map((n) => n.type ?? '');

describe('panels', () => {
  it.each(
    WIKI_CORPUS.filter((f) => f.path.startsWith('panels/')).map((f) => f.path),
  )('round-trips %s byte-identically with no raw atoms', (path) => {
    const wiki = fixture(path);
    expect(JSON.stringify(parse(wiki))).not.toContain('rawBlock');
    wikiSchema.nodeFromJSON(parse(wiki)).check();
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('records type and params', () => {
    const tip = blocks(fixture('panels/tip.wiki'))[0];
    expect(tip?.type).toBe('panel');
    expect(tip?.attrs).toMatchObject({ type: 'tip', params: null });
    const info = blocks(fixture('panels/info-titled.wiki'))[0];
    expect(info?.attrs).toMatchObject({ type: 'info', params: 'title=Heads up' });
  });

  it('models lists and panels inside panels', () => {
    const list = blocks(fixture('panels/panel-list-items.wiki'))[0];
    expect(kinds(list?.content)).toEqual(['bulletList']);
    const items = list?.content?.[0]?.content;
    expect(kinds(items?.[1]?.content)).toEqual(['paragraph', 'bulletList']);
    const nested = blocks(fixture('panels/list-in-panel-nested.wiki'))[0];
    expect(nested?.attrs?.type).toBe('info');
    expect(
      kinds(
        nested?.content?.[0]?.content?.[0]?.content?.[1]
          ? [nested?.content?.[0]?.content?.[0]?.content?.[1] as JSONContent]
          : [],
      ),
    ).toEqual(['orderedList']);
    const pip = blocks(fixture('panels/panel-in-panel.wiki'))[0];
    expect(kinds(pip?.content)).toEqual(['paragraph', 'panel']);
    expect(pip?.content?.[1]?.attrs?.type).toBe('info');
  });

  it('keeps ambiguous and unsupported forms raw', () => {
    for (const src of ['{panel}a{panel}b{panel}c{panel}', '{panel:bgColor=red}x{panel}']) {
      expect(kinds(blocks(src))).toEqual(['rawBlock']);
      expect(emitWiki(parse(src))).toBe(src);
    }
  });

  it('places a panel after a list item as a sibling block (renderer: div after the list)', () => {
    const top = blocks(fixture('lists/panel-after-item.wiki'));
    expect(kinds(top)).toEqual(['bulletList', 'panel', 'bulletList']);
    expect(top[1]?.attrs?.gap).toBe(0);
    expect(emitWiki(parse(fixture('lists/panel-after-item.wiki')))).toBe(
      fixture('lists/panel-after-item.wiki'),
    );
  });

  it('keeps the title on emit (lost-title regression)', () => {
    expect(emitWiki(parse(fixture('escapes/regressions.wiki')))).toContain(
      '{panel:title=Keep me}x{panel}',
    );
  });

  it('emits a user-created panel in canonical form (D-08)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'panel',
          attrs: { type: 'info' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
        },
      ],
    };
    expect(emitWiki(doc)).toBe('{info}\nhi\n{info}');
  });
});
