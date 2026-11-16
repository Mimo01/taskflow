import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from '../corpus.fixtures';
import { isEquivalent } from '../equivalence';
import { emitWiki } from './emit';
import { loadWiki, saveWiki } from './engine';
import { wikiSchema } from './schema';

const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };
const N = wikiSchema.nodes;

const fixture = (path: string): string => {
  const f = WIKI_CORPUS.find((x) => x.path === path);
  if (!f) throw new Error(`missing fixture ${path}`);
  return f.wiki;
};

/** Loads a text, applies a scripted transaction, and saves. */
function edit(text: string, script: (tr: Transaction, doc: PMNode) => void): string {
  const loaded = loadWiki(text, MAPS);
  if (loaded.kind !== 'rich') throw new Error(`expected rich, got ${loaded.kind}`);
  const doc = wikiSchema.nodeFromJSON(loaded.doc);
  const state = EditorState.create({ doc, schema: wikiSchema });
  const tr = state.tr;
  script(tr, doc);
  expect(tr.docChanged).toBe(true);
  const out = saveWiki(loaded, tr.doc);
  expect(out).not.toBe(text);
  return out;
}

/** Position of the first occurrence of `needle` inside a single text node. */
function find(doc: PMNode, needle: string): number {
  let at = -1;
  doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text?.includes(needle))
      at = pos + (node.text.indexOf(needle) ?? 0);
  });
  if (at < 0) throw new Error(`text not found: ${needle}`);
  return at;
}

const lines = (s: string): string[] => s.split('\n');
const changed = (a: string, b: string): number[] => {
  const x = lines(a);
  const y = lines(b);
  const out: number[] = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) out.push(i);
  return out;
};
const para = (t: string) => N.paragraph.create(null, wikiSchema.text(t));

describe('edits re-emit only what changed (D-04, D-05)', () => {
  it('append a paragraph', () => {
    const orig = fixture('inline/formatting.wiki');
    const out = edit(orig, (tr, doc) => tr.insert(doc.content.size, para('Added')));
    const body = orig.replace(/\n$/, '');
    expect(out.startsWith(`${body}\n\nAdded`)).toBe(true);
    expect(isEquivalent(`${body}\n\nAdded`, out, MAPS)).toBe(true);
  });

  it('bold a word changes only that line', () => {
    const orig = fixture('inline/formatting.wiki');
    const out = edit(orig, (tr, doc) => {
      const from = find(doc, 'bare');
      tr.addMark(from, from + 4, wikiSchema.marks.bold.create());
    });
    expect(changed(orig, out)).toEqual([1]);
    expect(lines(out)[1]).toBe('A *bare* + sign and 1 + 2 = 3.');
  });

  it('change a table cell changes only that row', () => {
    const orig = fixture('tables/header-row.wiki');
    const out = edit(orig, (tr, doc) => {
      const from = find(doc, 'Pass');
      tr.insertText('Green', from, from + 4);
    });
    expect(changed(orig, out)).toEqual([1]);
    expect(lines(out)[1]).toBe('|Login|Green|');
  });

  it('add a list item under *#', () => {
    const orig = fixture('lists/mixed-nesting.wiki');
    const out = edit(orig, (tr, doc) => {
      const from = find(doc, 'Numbered child two');
      const $p = doc.resolve(from);
      let depth = $p.depth;
      while ($p.node(depth).type !== N.listItem) depth--;
      tr.insert($p.after(depth), N.listItem.create(null, para('New')));
    });
    const l = lines(out);
    expect(l).toContain('*# New');
    expect(l.filter((x) => x !== '*# New')).toEqual(lines(orig));
  });

  it('keeps h1. without a space when editing the heading text', () => {
    const orig = fixture('inline/heading-no-space.wiki');
    const out = edit(orig, (tr, doc) => {
      const from = find(doc, 'Title');
      tr.insertText('Big', from, from + 5);
    });
    expect(lines(out)[0]).toBe('h1.Big');
    expect(changed(orig, out)).toEqual([0]);
  });
});

describe('D-06 line endings', () => {
  const add = (tr: Transaction, doc: PMNode) => tr.insert(doc.content.size, para('Added'));
  it('CRLF stays CRLF on every line', () => {
    const out = edit(fixture('whitespace/crlf.wiki'), add);
    expect(out).toMatch(/Added/);
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
  it('mixed text emits its majority ending', () => {
    const out = edit(fixture('whitespace/mixed-eol.wiki'), add);
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(out).toMatch(/\r\n/);
  });
  it('a new empty doc emits LF', () => {
    const loaded = loadWiki('', MAPS);
    if (loaded.kind !== 'rich') throw new Error('expected rich');
    const doc = wikiSchema.nodeFromJSON(loaded.doc);
    const tr = EditorState.create({ doc, schema: wikiSchema }).tr.insertText('typed', 1);
    const out = saveWiki(loaded, tr.doc);
    expect(out).toBe('typed');
    expect(out).not.toContain('\r');
  });
});

describe('D-07 trailing whitespace', () => {
  const add = (tr: Transaction, doc: PMNode) => tr.insert(doc.content.size, para('Added'));
  it('prose lines lose trailing whitespace', () => {
    const out = edit(fixture('whitespace/trailing-whitespace.wiki'), add);
    for (const l of lines(out)) expect(l, JSON.stringify(l)).not.toMatch(/[ \t]$/);
  });
  it('code bodies keep theirs', () => {
    const out = edit(fixture('whitespace/code-trailing-ws.wiki'), add);
    const l = lines(out);
    expect(l[0]).toBe('Prose line');
    expect(l).toContain('foo  ');
    expect(l).toContain('bar\t');
  });
});

describe('D-08 new nodes use the app forms', () => {
  // Block gap defaults to 1 (a blank line before the block); the first block of a
  // document is built with gap 0, as the parser produces for the first block.
  const build = (block: PMNode): string =>
    emitWiki(
      N.doc.create(null, [
        block.type.create({ ...block.attrs, gap: 0 }, block.content, block.marks),
      ]),
    );
  const li = (t: string) => N.listItem.create(null, para(t));
  it('bullets, numbers, code, heading', () => {
    expect(build(N.bulletList.create(null, li('a')))).toBe('* a');
    expect(build(N.orderedList.create(null, li('a')))).toBe('# a');
    expect(build(N.heading.create({ level: 2 }, wikiSchema.text('x')))).toBe('h2. x');
    const code = N.codeBlock.create({ language: 'java' }, wikiSchema.text('int a;'));
    expect(build(code)).toBe('{code:java}\nint a;\n{code}');
  });
  it('bold, italic, mention', () => {
    const m = wikiSchema.marks;
    const p = (...c: PMNode[]) => N.paragraph.create(null, c);
    expect(build(p(wikiSchema.text('x', [m.bold.create()])))).toBe('*x*');
    expect(build(p(wikiSchema.text('x', [m.italic.create()])))).toBe('_x_');
    expect(build(p(N.mention.create({ id: 'jdoe' })))).toBe('[~jdoe]');
  });
});
