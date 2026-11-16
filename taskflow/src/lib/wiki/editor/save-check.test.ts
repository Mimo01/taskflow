import { describe, expect, it } from 'vitest';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { blockSource, checkSaved } from './save-check';
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
  it('intraword italic', () => {
    expect(check(doc(p(t('x'), t('a', 'italic'), t('y'))))).toMatch(/block 0/);
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
  it('multi-mark text over edge whitespace (shape b) fails closed', () => {
    const d = doc(p(t('hello ', 'bold', 'italic'), t('world')));
    const emitted = emitWiki(d);
    // The emitter writes `*_hello _*world`, which does not read back as
    // bold+italic over `hello`, so the check must refuse it.
    expect(emitted.trim()).toBe('*_hello _*world');
    expect(checkSaved(d, emitted)).not.toBeNull();
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
