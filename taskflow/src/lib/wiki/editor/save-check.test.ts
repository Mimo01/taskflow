import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from '../corpus.fixtures';
import { emitWiki } from './emit';
import { loadWiki, saveWiki } from './engine';
import { parseWiki } from './parse/blocks';
import { blockSource, checkSaved, diagnoseSave } from './save-check';
import { wikiSchema } from './schema';
import type { WikiDocJSON } from './types';

type J = WikiDocJSON;

const t = (text: string, ...marks: string[]): J => ({
  type: 'text',
  text,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: J[]): J => ({ type: 'paragraph', attrs: { gap: 1 }, content });
const doc = (...content: J[]): J => ({ type: 'doc', attrs: { eol: 'lf', tail: 0 }, content });
const br = (marks: string[] = []): J => ({
  type: 'hardBreak',
  attrs: { src: '\n' },
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const item = (...content: J[]): J => ({ type: 'listItem', content });
const ul = (...items: J[]): J => ({ type: 'bulletList', attrs: { gap: 1 }, content: items });
const cell = (...content: J[]): J => ({ type: 'tableCell', content });
const table = (...rows: J[][]): J => ({
  type: 'table',
  attrs: { gap: 1, headerless: true },
  content: rows.map((cells) => ({ type: 'tableRow', content: cells })),
});

/** checkSaved of a doc against its own emit. */
const check = (d: J): string | null => checkSaved(d, emitWiki(d));

describe('checkSaved accepts legitimate shapes', () => {
  it('a parsed doc', () => {
    const text = 'h1. Title\n\nSome *bold* and _it_ text\\\\next\n\n* a\n* b\n\n|x|y|\n|1|2|';
    const { doc: d } = parseWiki(text);
    expect(checkSaved(d, emitWiki(d))).toBeNull();
  });
  it('trailing spaces on a paragraph', () => {
    expect(check(doc(p(t('hello   '))))).toBeNull();
  });
  it('an empty paragraph between two paragraphs', () => {
    expect(check(doc(p(t('a')), p(), p(t('b'))))).toBeNull();
  });
  it('a cell holding two paragraphs', () => {
    expect(check(doc(table([cell(p(t('a')), p(t('b'))), cell(p(t('c')))])))).toBeNull();
  });
  it('an item holding a paragraph and a single-line rawBlock', () => {
    const raw: J = { type: 'rawBlock', attrs: { raw: '{status:x}', gap: 1 } };
    expect(check(doc(ul(item(p(t('item')), raw))))).toBeNull();
  });
  it('a user-created mention', () => {
    const m: J = { type: 'mention', attrs: { id: 'admin', src: null } };
    expect(check(doc(p(t('ping '), m, t(' now'))))).toBeNull();
  });
  it('bold over interior edge whitespace', () => {
    expect(check(doc(p(t('x'), t(' hello ', 'bold'), t('y'))))).toBeNull();
  });
  it('bold over trailing whitespace of the first word', () => {
    expect(check(doc(p(t('hello ', 'bold'), t('world'))))).toBeNull();
  });
  it('a top-level rawBlock whose source is modelled on re-parse', () => {
    const raw: J = { type: 'rawBlock', attrs: { raw: 'h2. Title', gap: 0 } };
    expect(check(doc(raw, p(t('after'))))).toBeNull();
  });
});

describe('checkSaved rejects unwritable shapes (WR-01)', () => {
  it('intraword italic is written in brace form and saves', () => {
    const d = doc(p(t('x'), t('a', 'italic'), t('y')));
    expect(emitWiki(d).trim()).toBe('x{_}a{_}y');
    expect(check(d)).toBeNull();
  });
  it('bold across a hard break', () => {
    expect(check(doc(p(t('one', 'bold'), br(['bold']), t('two', 'bold'))))).not.toBeNull();
  });
  it('mono containing a closing brace', () => {
    expect(check(doc(p(t('a}b', 'mono'))))).not.toBeNull();
  });
  it('a link href containing a closing bracket', () => {
    const link: J = {
      type: 'text',
      text: 't',
      marks: [{ type: 'link', attrs: { href: 'https://x.example/a]b' } }],
    };
    expect(check(doc(p(link)))).not.toBeNull();
  });
  it('typed heading prefix names the prefix and the monospace workaround', () => {
    const reason = check(doc(p(t('h1. hi'))));
    expect(reason).toContain('h1.');
    expect(reason).toContain('{{h1. hi}}');
  });
  it('typed double backslash names the line break and the code-block workaround', () => {
    // The saved \\ reads back as a hard break, so the paragraph is empty and dropped.
    const reason = check(doc(p(t('intro')), p(t('\\\\'))));
    expect(reason).toContain('block 1:');
    expect(reason).toContain('`\\\\`');
    expect(reason).toContain('a line break');
    expect(reason).toContain('code block');
    expect(reason).toContain('the saved text has 1 top-level blocks, the edit has 2');
  });
  it('typed backslash before a markup character says the backslash is dropped', () => {
    const reason = check(doc(p(t('a \\* b'))));
    expect(reason).toContain('`\\*`');
    expect(reason).toContain('drops the backslash');
  });
  it('a backslash split across two marked text nodes still names the fusion', () => {
    const bold: J = { type: 'text', text: '\\b', marks: [{ type: 'bold' }] };
    const reason = check(doc(p(t('a\\'), bold)));
    expect(reason).toContain('a line break');
  });
  it('typed unspellable emoticon names the token and says monospace does not help', () => {
    const reason = check(doc(p(t('see (x) here'))));
    expect(reason).toContain('(x)');
    expect(reason).toContain('monospace does not help');
  });
  it('typed (i) is unspellable too', () => {
    expect(check(doc(p(t('see (i) here'))))).toContain('(i)');
  });
  it('a different top-level block count names both counts', () => {
    const reason = checkSaved(doc(p(t('a')), p(t('b'))), 'a');
    expect(reason).toContain('1');
    expect(reason).toContain('2');
  });
  it('a newline hard break moved into a table cell (shape a) is verified by re-parse', () => {
    // 97-13 keeps the `\n` spelling in cells. The parser reads `|a\nb|c|` back as
    // ONE cell holding a break (open-row merge), so the structure matches and the
    // check accepts it; a doc whose re-parse differs would be refused instead.
    for (const cells of [
      [cell(p(t('a'), br(), t('b'))), cell(p(t('c')))],
      [cell(p(t('c'))), cell(p(t('a'), br(), t('b')))],
    ]) {
      const d = doc(table(cells));
      expect(emitWiki(d)).toMatch(/\n/);
      expect(check(d)).toBeNull();
    }
    // Same emitted text but a doc that claims two rows must be refused.
    const twoRows = doc(table([cell(p(t('a')))], [cell(p(t('b')))]));
    expect(checkSaved(twoRows, '|a\nb|')).not.toBeNull();
  });
  it('multi-mark text over edge whitespace (shape b) braces the inner mark', () => {
    const d = doc(p(t('hello ', 'bold', 'italic'), t('world')));
    const emitted = emitWiki(d);
    // `*_hello _*world` would not read back; the brace form accepts the edge space.
    expect(emitted.trim()).toBe('*{_}hello {_}*world');
    expect(checkSaved(d, emitted)).toBeNull();
  });
});

describe('shape rules', () => {
  const reparsed = (text: string): J => parseWiki(text).doc;

  it('rule 1: spelling attrs are not structure', () => {
    const a = reparsed('* one\n* two');
    const b = reparsed('- one\n- two');
    expect(checkSaved(a, '- one\n- two')).toBeNull();
    expect(checkSaved(b, '* one\n* two')).toBeNull();
    expect(checkSaved(a, '# one\n# two')).not.toBeNull();
  });
  it('rule 2: an escape atom is its character, trailing spaces trim', () => {
    const d = reparsed('a\\*c');
    expect(checkSaved(d, 'a\\*c')).toBeNull();
    expect(checkSaved(doc(p(t('a*c'))), 'a\\*c')).toBeNull();
    expect(checkSaved(doc(p(t('a  '))), 'a')).toBeNull();
    expect(checkSaved(doc(p(t('ab'))), 'ac')).not.toBeNull();
  });
  it('rule 3: item and cell paragraphs flatten into one stream with breaks', () => {
    const d = doc(table([cell(p(t('a')), p(t('b')))]));
    expect(checkSaved(d, '|a\\\\b|')).toBeNull();
    expect(checkSaved(d, '|a b|')).not.toBeNull();
  });
  it('rule 4: empty paragraphs are blank lines', () => {
    expect(checkSaved(doc(p(t('a')), p(), p(t('b'))), 'a\n\nb')).toBeNull();
    expect(checkSaved(doc(p(t('a')), p(t('c')), p(t('b'))), 'a\n\nb')).not.toBeNull();
  });
  it('rule 5: edge whitespace of a canonical mark run is unmarked on both sides', () => {
    expect(checkSaved(doc(p(t('hello ', 'bold'), t('w'))), '*hello* w')).toBeNull();
    // brace spelling keeps the spaces inside the mark; both sides still compare equal
    const braced = reparsed('{*} a {*}');
    expect(checkSaved(braced, '{*} a {*}')).toBeNull();
    // near miss: a mark on a non-space character is never dropped
    expect(checkSaved(doc(p(t('hello', 'bold'))), 'hello')).not.toBeNull();
  });
});

describe('blockSource', () => {
  it('strips the leading gap and trailing blank lines', () => {
    expect(blockSource('\n\nabc\n\n')).toBe('abc');
  });
});

describe('saveWiki (WR-01)', () => {
  const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };
  const load = (text: string) => {
    const loaded = loadWiki(text, MAPS);
    if (loaded.kind === 'failed') throw new Error('expected an editable load');
    return loaded;
  };
  /** Save a JSON doc (rich load of `seed`) as if the user had produced it. */
  const saveDoc = (d: J, seed = 'seed') =>
    saveWiki(load(seed), wikiSchema.nodeFromJSON(d as never));
  const saved = (r: ReturnType<typeof saveWiki>): string => {
    if (r.kind !== 'saved') throw new Error(`expected saved, got ${JSON.stringify(r)}`);
    return r.text.replace(/^\n+/, '');
  };
  /** Append "x" at the end of the first non-code textblock; null when there is none. */
  const appendX = (doc: PMNode): PMNode | null => {
    let at = -1;
    doc.descendants((node, pos) => {
      if (at < 0 && node.isTextblock && node.type.name !== 'codeBlock')
        at = pos + node.nodeSize - 1;
      return at < 0;
    });
    if (at < 0) return null;
    return EditorState.create({ doc, schema: wikiSchema }).tr.insertText('x', at).doc;
  };

  /** Fixtures where appending one character legitimately cannot be written; each needs a reason. */
  const EXCLUDED: { path: string; reason: string }[] = [];

  it('every EXCLUDED entry names a corpus fixture and a reason', () => {
    for (const e of EXCLUDED) {
      expect(
        WIKI_CORPUS.some((f) => f.path === e.path),
        e.path,
      ).toBe(true);
      expect(e.reason.length, e.path).toBeGreaterThan(10);
    }
  });

  it('corpus: one appended character saves for every rich fixture', () => {
    const bad: string[] = [];
    let n = 0;
    for (const { path, wiki } of WIKI_CORPUS) {
      if (EXCLUDED.some((e) => e.path === path)) continue;
      const loaded = loadWiki(wiki, MAPS);
      if (loaded.kind === 'failed') continue;
      const edited = appendX(wikiSchema.nodeFromJSON(loaded.doc));
      if (!edited) continue;
      n++;
      const r = saveWiki(loaded, edited);
      if (r.kind !== 'saved') bad.push(`${path}: ${JSON.stringify(r)}`);
    }
    expect(n).toBeGreaterThan(40);
    expect(bad).toEqual([]);
  });

  it('rich-demoted: raw block verbatim, other block edited', () => {
    const text = 'h2. Title\n\nBody';
    const { doc: d, slices } = parseWiki(text);
    const blocks = [...(d.content ?? [])];
    blocks[0] = { type: 'rawBlock', attrs: { raw: blockSource(slices[0] ?? ''), gap: 0 } };
    const loaded = {
      kind: 'rich-demoted' as const,
      original: text,
      doc: { ...d, content: blocks },
      demoted: [0],
    };
    const node = wikiSchema.nodeFromJSON(loaded.doc);
    const edited = appendX(node);
    expect(edited).not.toBeNull();
    const r = saveWiki(loaded, edited as PMNode);
    expect(saved(r)).toBe('h2. Title\n\nBodyx');
  });

  it('user edits save', () => {
    const mention: J = { type: 'mention', attrs: { id: 'admin', src: null } };
    const raw: J = { type: 'rawBlock', attrs: { raw: '{status:x}', gap: 1 } };
    expect(saved(saveDoc(doc(p(t('a')), p(), p(t('b')))))).toMatch(/^a\n\n+b$/);
    expect(saved(saveDoc(doc(p(t('end   ')))))).toBe('end');
    expect(saved(saveDoc(doc(ul(item(p(t('a'))), item(p(t('new')))))))).toContain('* new');
    expect(
      saved(saveDoc(doc(table([cell(p(t('a')), p()), cell(p())], [cell(p()), cell(p())])))),
    ).toBeTruthy();
    expect(saved(saveDoc(doc(p(t('all'.toString(), 'bold')))))).toBe('*all*');
    expect(saved(saveDoc(doc(p(t('hello', 'bold'), t(' world')))))).toBe('*hello* world');
    expect(saved(saveDoc(doc(p(t('ping '), mention, t(' now')))))).toBe('ping [~admin] now');
    expect(saved(saveDoc(doc(ul(item(p(t('item')), raw)))))).toContain('{status:x}');
    expect(saved(saveDoc(doc(p(t('ping [~admin] now')))))).toBe('ping \\[~admin] now');
  });

  it('edge-whitespace bold saves as *hello* world', () => {
    const loaded = load('hello world');
    const node = wikiSchema.nodeFromJSON(loaded.doc);
    const tr = EditorState.create({ doc: node, schema: wikiSchema }).tr.addMark(
      1,
      7,
      wikiSchema.marks.bold.create(),
    );
    expect(saved(saveWiki(loaded, tr.doc))).toBe('*hello* world');
  });

  it('corruptions fail with a reason and never throw', () => {
    const cases: [string, J][] = [
      ['bold across break', doc(p(t('one', 'bold'), br(['bold']), t('two', 'bold')))],
      ['mono with brace', doc(p(t('a}b', 'mono')))],
      [
        'link href with bracket',
        doc(
          p({
            type: 'text',
            text: 't',
            marks: [{ type: 'link', attrs: { href: 'https://x.example/a]b' } }],
          }),
        ),
      ],
      ['typed h1.', doc(p(t('h1. hi')))],
      ['typed (x)', doc(p(t('see (x) here')))],
    ];
    for (const [name, d] of cases) {
      const r = saveDoc(d);
      expect(r.kind, name).toBe('failed');
    }
    const h1 = saveDoc(doc(p(t('h1. hi'))));
    expect(h1.kind === 'failed' && h1.reason).toContain('{{h1. hi}}');
    const x = saveDoc(doc(p(t('see (x) here'))));
    expect(x.kind === 'failed' && x.reason).toContain('monospace does not help');
    const code: J = { type: 'codeBlock', content: [t('c')] };
    const r = saveDoc(doc(ul(item(p(t('a')), code))));
    expect(r.kind).toBe('failed');
    expect(r.kind === 'failed' && r.reason).toContain('list item');
  });
});

describe('live macro look-alikes (gap 1)', () => {
  const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };

  it('backstop: an unescaped typed token fails the check', () => {
    const d = doc(p(t('a {info}x{info} b')));
    expect(checkSaved(d, 'a {info}x{info} b')).not.toBeNull();
  });

  it('a typed {code} in a table cell saves escaped (98-01)', () => {
    const d = doc(table([cell(p(t('a {code}x{code} b')))]));
    expect(check(d)).toBeNull();
  });

  it('a typed {code} paragraph saves escaped', () => {
    const loaded = loadWiki('seed', MAPS);
    if (loaded.kind === 'failed') throw new Error('expected an editable load');
    const r = saveWiki(loaded, wikiSchema.nodeFromJSON(doc(p(t('a {code}x{code} b'))) as never));
    expect(r.kind).toBe('saved');
    expect(r.kind === 'saved' && r.text.trim()).toBe('a \\{code}x\\{code} b');
  });

  it('editing panel-mid-line keeps the parsed callouts unescaped', () => {
    const src = WIKI_CORPUS.find((f) => f.path === 'panels/panel-mid-line.wiki');
    if (!src) throw new Error('fixture missing');
    const loaded = loadWiki(src.wiki, MAPS);
    if (loaded.kind === 'failed') throw new Error('expected an editable load');
    const node = wikiSchema.nodeFromJSON(loaded.doc);
    let at = -1;
    node.descendants((n, pos) => {
      if (n.isTextblock && n.type.name !== 'codeBlock') at = pos + n.nodeSize - 1;
      return true;
    });
    const edited = EditorState.create({ doc: node, schema: wikiSchema }).tr.insertText('x', at).doc;
    const r = saveWiki(loaded, edited);
    expect(r.kind).toBe('saved');
    const text = r.kind === 'saved' ? r.text : '';
    expect(text).toContain('{note}nested note{note}');
    expect(text).toContain('{warning}careful{warning}');
    expect(text).toContain('{info}inline info{info}');
  });
});

describe('line-break-only paragraphs', () => {
  it('are blank lines, not blocks', () => {
    expect(check(doc(p(t('a')), p(br()), p(br(), br()), p(t('b'))))).toBeNull();
    expect(check(doc(p(t('a')), p(br())))).toBeNull();
  });
});

describe('diagnoseSave', () => {
  it('names the first differing block, both projections and its saved text', () => {
    const d = doc(p(t('intro')), p(t('h1. not a heading')));
    const dx = diagnoseSave(d, 'intro\n\nh1. not a heading');
    expect(dx?.reason).toBe(checkSaved(d, 'intro\n\nh1. not a heading'));
    expect(dx?.block).toBe(1);
    expect(dx?.blockType).toBe('paragraph');
    expect(dx?.expected).toMatchObject({ type: 'paragraph' });
    expect(dx?.readBack).toMatchObject({ type: 'heading', level: 1 });
    expect(dx?.savedSlice).toContain('h1. not a heading');
  });

  it('agrees with checkSaved on block-count mismatches and clean saves', () => {
    const d = doc(p(t('one')));
    expect(diagnoseSave(d, 'one\n\ntwo')?.reason).toBe(checkSaved(d, 'one\n\ntwo'));
    expect(diagnoseSave(d, emitWiki(d))).toBeNull();
  });
});
