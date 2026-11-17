import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from '../corpus.fixtures';
import { wikiToHtml } from '../pipeline';
import * as preprocess from '../preprocess';
import { ESCAPABLE_CHARS, unspellableReason } from './escape';
import { loadWiki, saveWiki } from './engine';
import { wikiSchema } from './schema';
import type { WikiDocJSON } from './types';

type J = WikiDocJSON;

const t = (text: string): J => ({ type: 'text', text });
const p = (...content: J[]): J => ({ type: 'paragraph', attrs: { gap: 1 }, content });
const doc = (...content: J[]): J => ({ type: 'doc', attrs: { eol: 'lf', tail: 0 }, content });
const item = (...content: J[]): J => ({ type: 'listItem', content });
const ul = (...items: J[]): J => ({ type: 'bulletList', attrs: { gap: 1 }, content: items });
const cell = (...content: J[]): J => ({ type: 'tableCell', content });
const table = (...rows: J[][]): J => ({
  type: 'table',
  attrs: { gap: 1, headerless: true },
  content: rows.map((cells) => ({ type: 'tableRow', content: cells })),
});

const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };
const load = (text: string) => {
  const loaded = loadWiki(text, MAPS);
  if (loaded.kind === 'failed') throw new Error('expected an editable load');
  return loaded;
};

const render = (wiki: string) => {
  const html = wikiToHtml(wiki);
  const el = document.createElement('div');
  el.innerHTML = html;
  return { html, visible: (el.textContent ?? '').replace(/\s+/g, ' ').trim() };
};

/** Save a JSON doc as the user's edit and render the saved text. */
function roundTrip(d: J) {
  const r = saveWiki(load('seed'), wikiSchema.nodeFromJSON(d as never));
  expect(r.kind).toBe('saved');
  if (r.kind !== 'saved') throw new Error(JSON.stringify(r));
  return { text: r.text, ...render(r.text) };
}

const FORBIDDEN = [
  '<pre',
  '<code',
  'data-callout',
  '<blockquote',
  '<strong',
  '<em',
  '<span',
  '<mention',
  '<img',
  '&#x3C;',
];
const expectNoGenerated = (html: string) => {
  for (const f of FORBIDDEN) expect(html, f).not.toContain(f);
};

describe('typed text renders as typed (97 gaps 1+2)', () => {
  const ROWS = [
    'a {code}x{code} b',
    'a {info}x{info} b',
    'a {quote}q{quote} b',
    'a {noformat}x{noformat} b',
    'a *b* c',
    'a _b_ c',
    'ping [~admin] now',
    '{color:red}x{color}',
  ];
  for (const typed of ROWS) {
    it(`paragraph: ${typed}`, () => {
      const { html, visible } = roundTrip(doc(p(t(typed))));
      expect(visible).toBe(typed);
      expectNoGenerated(html);
    });
  }

  for (const x of ESCAPABLE_CHARS) {
    it(`escapable character ${x}`, () => {
      const typed = `a ${x}b${x} c`;
      const r = saveWiki(load('seed'), wikiSchema.nodeFromJSON(doc(p(t(typed))) as never));
      if (r.kind === 'failed') {
        expect(unspellableReason(typed, false), r.reason).not.toBeNull();
        return;
      }
      expect(r.kind).toBe('saved');
      if (r.kind !== 'saved') return;
      const { html, visible } = render(r.text);
      expect(visible).toBe(typed);
      expectNoGenerated(html);
    });
  }

  const MACROS = ['a {code}x{code} b', 'a {info}x{info} b', 'a {quote}q{quote} b'];

  for (const typed of MACROS) {
    it(`list item: ${typed}`, () => {
      const { html, visible } = roundTrip(doc(ul(item(p(t(typed))), item(p(t('second'))))));
      expect(visible).toBe(`${typed} second`);
      expect(html.match(/<li/g)?.length).toBe(2);
      expectNoGenerated(html);
    });
  }

  for (const typed of ['a {info}x{info} b', 'a {quote}q{quote} b']) {
    it(`table cell: ${typed}`, () => {
      const { html, visible } = roundTrip(doc(table([cell(p(t(typed))), cell(p(t('z')))])));
      expect(visible).toBe(`${typed}z`); // adjacent cells carry no separator in textContent
      expect(html.match(/<td/g)?.length).toBe(2);
      expectNoGenerated(html);
    });
  }

  // Known limitation (97-16 deviation 4): parseCell treats any cell containing
  // {code}/{noformat} as a raw table, escaped or not, so it cannot be spelled
  // safely. The save check must refuse rather than write text that renders a block.
  for (const typed of ['a {code}x{code} b', 'a {noformat}x{noformat} b']) {
    it(`table cell fails closed: ${typed}`, () => {
      const r = saveWiki(
        load('seed'),
        wikiSchema.nodeFromJSON(doc(table([cell(p(t(typed))), cell(p(t('z')))])) as never),
      );
      expect(r.kind).toBe('failed');
    });
  }

  it('typed image syntax produces no <img', () => {
    const { html } = roundTrip(doc(p(t('img !http://e.example/p.png! x'))));
    expect(html).not.toContain('<img');
  });

  it('parsed mid-line callouts survive an edit elsewhere', () => {
    const fx = WIKI_CORPUS.find((f) => f.path.endsWith('panels/panel-mid-line.wiki'));
    if (!fx) throw new Error('panel-mid-line fixture missing');
    const count = (html: string) => html.match(/data-callout/g)?.length ?? 0;
    const before = count(wikiToHtml(fx.wiki));
    expect(before).toBe(3);

    const loaded = load(fx.wiki);
    const node = wikiSchema.nodeFromJSON(loaded.doc);
    let at = -1;
    node.descendants((n, pos) => {
      if (n.isTextblock && n.type.name !== 'codeBlock') at = pos + n.nodeSize - 1;
      return true;
    });
    const edited = EditorState.create({ doc: node, schema: wikiSchema }).tr.insertText('x', at).doc;
    const r = saveWiki(loaded, edited);
    expect(r.kind).toBe('saved');
    if (r.kind !== 'saved') return;
    expect(count(wikiToHtml(r.text))).toBe(before);
  });

  it('renderer and editor escape sets agree', () => {
    expect(preprocess.JIRA_ESCAPE_CHARS).toEqual(ESCAPABLE_CHARS);
  });
});

describe('typed bare URLs with underscores (WR-01)', () => {
  const typed = 'see http://a.com/_a_ and _b_';

  it('saves to text that renders a working link with the typed href', () => {
    const { html, visible } = roundTrip(doc(p(t(typed))));
    const el = document.createElement('div');
    el.innerHTML = html;
    expect(el.querySelector('a')?.getAttribute('href')).toBe('http://a.com/_a_');
    expect(visible).toBe(typed);
    expect(el.querySelector('em')).toBeNull();
  });

  it('reloads as the same rich paragraph', () => {
    const r = saveWiki(load('seed'), wikiSchema.nodeFromJSON(doc(p(t(typed))) as never));
    expect(r.kind).toBe('saved');
    if (r.kind !== 'saved') return;
    expect(loadWiki(r.text, MAPS).kind).toBe('rich');
  });

  it('keeps trailing sentence punctuation outside the link', () => {
    const el = document.createElement('div');
    el.innerHTML = wikiToHtml('go to http://a.com/\\_a\\_.');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('http://a.com/_a_');
    expect(el.textContent?.trim()).toBe('go to http://a.com/_a_.');
  });
});
