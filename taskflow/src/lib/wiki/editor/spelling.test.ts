import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from '../corpus.fixtures';
import { JIRA_EMOTICON_MAP, JIRA_EMOTICON_TOKENS } from '../preprocess';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { parseInline } from './parse/inline';

const fixture = (path: string): string => WIKI_CORPUS.find((f) => f.path === path)?.wiki ?? '';
const rt = (s: string): string => emitWiki(parseWiki(s).doc);

function atoms(node: JSONContent, type: string, into: JSONContent[] = []): JSONContent[] {
  if (node.type === type) into.push(node);
  for (const c of node.content ?? []) atoms(c, type, into);
  return into;
}
const doc = (path: string): JSONContent => parseWiki(fixture(path)).doc;
const attrsOf = (nodes: JSONContent[]): unknown[] => nodes.map((n) => n.attrs);

describe('emoticon tokens (SAFE-06)', () => {
  it('JIRA_EMOTICON_TOKENS agrees with JIRA_EMOTICON_MAP', () => {
    expect(JIRA_EMOTICON_TOKENS.length).toBe(JIRA_EMOTICON_MAP.length);
    JIRA_EMOTICON_TOKENS.forEach((token, i) => {
      const re = new RegExp((JIRA_EMOTICON_MAP[i] as [RegExp, string])[0].source, 'g');
      expect(token.match(re)?.length, token).toBe(1);
    });
  });

  it('models one atom per token and replays it', () => {
    const wiki = fixture('emoticons/all-emoticons.wiki');
    const found = atoms(parseWiki(wiki).doc, 'emoticon').map((n) => n.attrs?.src);
    expect([...found].sort()).toEqual([...JIRA_EMOTICON_TOKENS].sort());
    expect(rt(wiki)).toBe(wiki);
  });

  it('keeps (*r) as one atom', () => {
    expect(parseInline('(*r)')).toEqual([{ type: 'emoticon', attrs: { src: '(*r)' } }]);
  });

  it('keeps emoticons inside code bodies as text', () => {
    const d = parseWiki('{code}\n(/)\n{code}').doc;
    expect(atoms(d, 'emoticon')).toEqual([]);
  });
});

describe('mentions, escapes and breaks (SAFE-06)', () => {
  it('models mentions with exact src', () => {
    expect(attrsOf(atoms(doc('mentions/username.wiki'), 'mention')).slice(0, 2)).toEqual([
      { id: 'jdoe', src: '[~jdoe]' },
      { id: 'asmith', src: '[~asmith]' },
    ]);
    expect(attrsOf(atoms(doc('mentions/accountid.wiki'), 'mention'))).toEqual([
      { id: 'placeholder-0001', src: '[~accountId:placeholder-0001]' },
    ]);
    expect(attrsOf(atoms(doc('mentions/unknown-user.wiki'), 'mention'))).toEqual([
      { id: 'placeholder-missing', src: '[~placeholder-missing]' },
    ]);
    for (const p of ['username', 'accountid', 'unknown-user']) {
      const w = fixture(`mentions/${p}.wiki`);
      expect(rt(w)).toBe(w);
    }
  });

  it('emits a user-created mention as [~id]', () => {
    const d: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'jdoe', src: null } }] },
      ],
    };
    expect(emitWiki(d)).toBe('[~jdoe]');
  });

  it('models escapes and line breaks', () => {
    const esc = atoms(doc('escapes/escaped-chars.wiki'), 'escape').map((n) => n.attrs?.src);
    expect(esc).toEqual(['\\*', '\\*', '\\_', '\\_', '\\{', '\\}', '\\[', '\\]', '\\+']);
    const breaks = atoms(doc('escapes/line-breaks.wiki'), 'hardBreak').map((n) => n.attrs?.src);
    expect(breaks).toContain('\\\\');
    for (const p of ['escaped-chars', 'line-breaks']) {
      const w = fixture(`escapes/${p}.wiki`);
      expect(rt(w)).toBe(w);
    }
  });
});

describe('media and inline raw', () => {
  it('models images with name and raw params', () => {
    const imgs = attrsOf(atoms(doc('attachments/image-params.wiki'), 'image'));
    expect(imgs).toEqual([
      { name: 'diagram.png', params: 'thumbnail', src: '!diagram.png|thumbnail!' },
      { name: 'screenshot.png', params: 'width=300', src: '!screenshot.png|width=300!' },
    ]);
    for (const p of ['image', 'image-params', 'missing', 'file-link']) {
      const w = fixture(`attachments/${p}.wiki`);
      expect(rt(w)).toBe(w);
    }
  });

  it('uses the URL as image name', () => {
    const [n] = parseInline('!https://example.com/a.png!');
    expect(n?.attrs?.name).toBe('https://example.com/a.png');
  });

  it('models attachments with and without label', () => {
    expect(attrsOf(atoms(doc('attachments/file-link.wiki'), 'attachment'))).toEqual([
      { name: 'spec.pdf', label: null, src: '[^spec.pdf]' },
      { name: 'spec.pdf', label: 'Spec', src: '[Spec|^spec.pdf]' },
    ]);
  });

  it('keeps missing files as atoms, not raw', () => {
    const d = doc('attachments/missing.wiki');
    expect(atoms(d, 'image')).toHaveLength(1);
    expect(atoms(d, 'attachment')).toHaveLength(1);
    expect(atoms(d, 'rawBlock')).toHaveLength(0);
  });

  it('makes unknown inline macros rawInline and keeps text editable', () => {
    const d = doc('macros/inline-status.wiki');
    expect(atoms(d, 'rawInline').map((n) => n.attrs?.raw)).toEqual([
      '{status:colour=Green|title=Done}',
      '{anchor:top}',
    ]);
    expect(atoms(d, 'rawBlock')).toHaveLength(0);
    expect(atoms(d, 'paragraph')[0]?.content?.[0]).toEqual({ type: 'text', text: 'Build is ' });
  });

  it('does not treat exclamation text as images', () => {
    expect(parseInline('Wow!!!')).toEqual([{ type: 'text', text: 'Wow!!!' }]);
    expect(atoms({ type: 'x', content: parseInline('a ! b ! c') }, 'image')).toEqual([]);
  });

  it('emits user-created image and attachment canonical forms', () => {
    const d: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'image', attrs: { name: 'diagram.png', params: null, src: null } },
            { type: 'attachment', attrs: { name: 'a.pdf', label: null, src: null } },
          ],
        },
      ],
    };
    expect(emitWiki(d)).toBe('!diagram.png![^a.pdf]');
  });

  it('scans a long line of openers in linear time', () => {
    const t = Date.now();
    parseInline(`${'{a:'.repeat(60000)}${'[~'.repeat(60000)}${'!a'.repeat(30000)}`);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});
