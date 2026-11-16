import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from '../corpus.fixtures';
import { emitBlockNode, emitWiki } from './emit';
import { parseContainerBody, parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

const fixture = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';
const parse = (s: string): JSONContent => parseWiki(s).doc;
const blocks = (s: string): JSONContent[] => parse(s).content ?? [];
const kinds = (nodes: readonly JSONContent[] | undefined): string[] =>
  (nodes ?? []).map((n) => n.type ?? '');

describe('lists', () => {
  it('models mixed nesting like the D-01 renderer', () => {
    const wiki = fixture('lists/mixed-nesting.wiki');
    const top = blocks(wiki);
    expect(kinds(top)).toEqual(['bulletList', 'orderedList']);
    const first = top[0]?.content?.[0];
    expect(kinds(first?.content)).toEqual(['paragraph', 'orderedList', 'bulletList']);
    expect(first?.content?.[1]?.content).toHaveLength(2);
    const second = top[1]?.content?.[0];
    expect(kinds(second?.content)).toEqual(['paragraph', 'bulletList', 'orderedList']);
    expect(second?.content?.[1]?.content).toHaveLength(2);
    expect(top[1]?.attrs?.gap).toBe(0);
    wikiSchema.nodeFromJSON(parse(wiki)).check();
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it.each([
    'lists/mixed-deep.wiki',
    'lists/nested-bullets.wiki',
    'lists/numbered-nested.wiki',
    'lists/dash-bullets.wiki',
    'lists/continuation.wiki',
  ])('round-trips %s byte-identically with no raw atoms', (path) => {
    const wiki = fixture(path);
    expect(JSON.stringify(parse(wiki))).not.toContain('rawBlock');
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('records the dash marker and continuation hard break', () => {
    expect(blocks(fixture('lists/dash-bullets.wiki'))[0]?.attrs?.marker).toBe('-');
    const item = blocks(fixture('lists/continuation.wiki'))[0]?.content?.[0];
    expect(kinds(item?.content?.[0]?.content)).toEqual(['text', 'hardBreak', 'text']);
  });

  it('keeps leading indentation through the item prefix', () => {
    const wiki = '  * a\n  ** b';
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('keeps a non-contiguous run as one rawBlock', () => {
    for (const wiki of ['* a\n*** c', '## g\n#*# x', '** a']) {
      expect(kinds(blocks(wiki)), wiki).toEqual(['rawBlock']);
      expect(emitWiki(parse(wiki)), wiki).toBe(wiki);
    }
  });

  it('gives a paragraph followed by a list gap 0', () => {
    const b = blocks('intro\n* a');
    expect(kinds(b)).toEqual(['paragraph', 'bulletList']);
    expect(b[1]?.attrs?.gap).toBe(0);
  });

  it('re-emits the canonical marker run when an item changes depth', () => {
    const doc = parse('* a\n* b');
    const list = doc.content?.[0] as JSONContent;
    const [a, b] = list.content as JSONContent[];
    const moved: JSONContent = {
      ...(a as JSONContent),
      content: [
        ...((a as JSONContent).content ?? []),
        {
          type: 'bulletList',
          content: [{ ...(b as JSONContent), attrs: { prefix: '* ' } }],
        },
      ],
    };
    const edited = { ...doc, content: [{ ...list, content: [moved] }] };
    wikiSchema.nodeFromJSON(edited).check();
    expect(emitWiki(edited)).toBe('* a\n** b');
  });

  it('uses canonical markers for new lists', () => {
    const item = (t: string): JSONContent => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
    });
    const mk = (type: string): JSONContent => ({
      type: 'doc',
      content: [{ type, content: [item('item')] }],
    });
    expect(emitWiki(mk('bulletList'))).toBe('* item');
    expect(emitWiki(mk('orderedList'))).toBe('# item');
  });
});

describe('blockquote', () => {
  it('models bq. with its separator', () => {
    const wiki = 'bq. Quoted text';
    const q = blocks(wiki)[0];
    expect(q?.type).toBe('blockquote');
    expect(q?.attrs).toMatchObject({ form: 'bq', bodyLead: ' ' });
    expect(kinds(q?.content)).toEqual(['paragraph']);
    expect(emitWiki(parse(wiki))).toBe(wiki);
    expect(emitWiki(parse('bq.tight'))).toBe('bq.tight');
  });

  it('models the quote macro fixture byte-identically', () => {
    const wiki = fixture('macros/quote.wiki');
    const b = blocks(wiki);
    expect(b[0]?.type).toBe('blockquote');
    expect(b[0]?.attrs?.form).toBe('macro');
    expect(JSON.stringify(parse(wiki))).not.toContain('rawBlock');
    wikiSchema.nodeFromJSON(parse(wiki)).check();
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('holds block content such as lists', () => {
    const wiki = '{quote}\n* a\n* b\n{quote}';
    const q = blocks(wiki)[0];
    expect(kinds(q?.content)).toEqual(['bulletList']);
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('handles same-line bodies with empty lead and tail', () => {
    const wiki = '{quote}inline{quote}';
    const q = blocks(wiki)[0];
    expect(q?.attrs).toMatchObject({ bodyLead: '', bodyTail: '' });
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('keeps same-name nesting ambiguity raw', () => {
    const wiki = '{quote}a{quote}b{quote}c{quote}';
    expect(kinds(blocks(wiki))).toEqual(['rawBlock']);
    expect(emitWiki(parse(wiki))).toBe(wiki);
  });

  it('parseContainerBody splits lead and tail so the source rebuilds', () => {
    for (const src of ['\nfoo\n', '', 'x', '\n\n a\n\nb\n\n', '  \n', '\n* a\n* b\n']) {
      const r = parseContainerBody(src);
      const body = (r.content ?? [])
        .map(
          (n, i) =>
            `${i > 0 ? '\n' : ''}${'\n'.repeat(Number(n.attrs?.gap ?? 0))}${emitBlockNode(n)}`,
        )
        .join('');
      expect(r.bodyLead + body + r.bodyTail, JSON.stringify(src)).toBe(src);
    }
  });

  it('emits canonical forms for user-created quotes', () => {
    const p = (t: string): JSONContent => ({
      type: 'paragraph',
      content: [{ type: 'text', text: t }],
    });
    expect(emitWiki({ type: 'doc', content: [{ type: 'blockquote', content: [p('one')] }] })).toBe(
      'bq. one',
    );
    expect(
      emitWiki({ type: 'doc', content: [{ type: 'blockquote', content: [p('one'), p('two')] }] }),
    ).toBe('{quote}\none\n\ntwo\n{quote}');
  });
});
