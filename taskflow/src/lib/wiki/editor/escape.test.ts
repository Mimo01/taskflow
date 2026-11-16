import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { WIKI_CORPUS } from '../corpus.fixtures';
import { emitWiki } from './emit';
import { ESCAPABLE_CHARS, escapeText } from './escape';
import { parseWiki } from './parse/blocks';

/** Local seeded PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = ['*', '_', '-', '+', '^', '~', '?', '{', '}', '[', ']', '|', '!', '\\', '(', ')'];
const PARTS = [...ALPHABET, '#', 'a', 'b', 'word', 'x', ' ', ' ', 'h1.', 'bq.', '(/)', '[~u]'];

/**
 * Typed sequences with no Jira spelling that shows the same characters
 * (Open Question 3). Excluded from the generators, each with its reason.
 */
const UNSPELLABLE: ReadonlyArray<{ reason: string; test: (t: string) => boolean }> = [
  {
    reason:
      'a typed backslash before an escapable char or another backslash fuses with it (`\\\\` is a line break)',
    test: (t) => new RegExp(`\\\\[${ESCAPABLE_CHARS.replace(/[\]\\^-]/g, '\\$&')}\\\\]`).test(t),
  },
  {
    reason: 'a heading (`h1. `) or quote (`bq. `) prefix at a line start has no escape spelling',
    test: (t) => /^(h[0-6]\.|bq\.)/.test(t),
  },
];

/** Cell only: a trailing backslash fuses with the closing `|` into an escaped pipe. */
const CELL_UNSPELLABLE = (t: string): boolean => t.endsWith('\\');

const spellable = (t: string, inCell: boolean): boolean =>
  !UNSPELLABLE.some((u) => u.test(t)) && !(inCell && CELL_UNSPELLABLE(t));

function typed(rand: () => number, lineStart: boolean, inCell: boolean): string {
  for (;;) {
    let s = '';
    const n = 1 + Math.floor(rand() * 9);
    for (let i = 0; i < n; i++) s += PARTS[Math.floor(rand() * PARTS.length)];
    if (lineStart)
      s = (['* ', '# ', '----', '- ', '|', '** ', '#* '][Math.floor(rand() * 7)] ?? '') + s;
    s = s.trim();
    if (s !== '' && spellable(s, inCell)) return s;
  }
}

const para = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const cellDoc = (text: string): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'table',
      content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para(text)] }] }],
    },
  ],
});
const paraDoc = (text: string): JSONContent => ({ type: 'doc', content: [para(text)] });

function display(nodes: readonly JSONContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text ?? '';
      if (n.type === 'escape') return String(n.attrs?.src).slice(1);
      if (n.type === 'rawInline') return String(n.attrs?.raw);
      if (n.type === 'hardBreak') return '\n';
      return String(n.attrs?.src ?? '');
    })
    .join('');
}

function shown(doc: JSONContent, inCell: boolean): string | null {
  const blocks = doc.content ?? [];
  const b = blocks[0];
  if (blocks.length !== 1 || !b) return null;
  if (!inCell) return b.type === 'paragraph' ? display(b.content ?? []) : null;
  const cells = b.type === 'table' && b.content?.length === 1 ? b.content[0]?.content : undefined;
  const p = cells?.length === 1 ? cells[0]?.content?.[0] : undefined;
  return p?.type === 'paragraph' ? display(p.content ?? []) : null;
}

function check(
  label: string,
  make: (t: string) => JSONContent,
  inCell: boolean,
  lineStart: boolean,
  seed: number,
): void {
  const rand = mulberry32(seed);
  for (let i = 0; i < 1000; i++) {
    const t = typed(rand, lineStart, inCell);
    const wiki = emitWiki(make(t));
    expect(
      shown(parseWiki(wiki).doc, inCell),
      `${label} ${JSON.stringify(t)} -> ${JSON.stringify(wiki)}`,
    ).toBe(t);
  }
}

describe('typed text escaping (SAFE-06)', () => {
  it('paragraph: 1000 typed strings re-parse to the same characters', () => {
    check('para', paraDoc, false, false, 11);
  });

  it('table cell: 1000 typed strings re-parse to the same characters', () => {
    check('cell', cellDoc, true, false, 22);
  });

  it('line start: block prefixes never become markup', () => {
    check('line-start', paraDoc, false, true, 33);
  });

  it('escapes minimally and spells escapes as atoms', () => {
    expect(emitWiki(paraDoc('*bold*'))).toBe('\\*bold\\*');
    expect(emitWiki(paraDoc('a * b'))).toBe('a * b');
    expect(emitWiki(cellDoc('a|b'))).toBe('|a\\|b|');
    expect(emitWiki(paraDoc('# not a list'))).toBe('\\# not a list');
    expect(emitWiki(paraDoc('plain text, 2 - 1'))).toBe('plain text, 2 - 1');
  });

  it('never escapes inside monospace', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'a*b*c',
              marks: [{ type: 'mono', attrs: { open: null, close: null } }],
            },
          ],
        },
      ],
    };
    expect(emitWiki(doc)).toBe('{{a*b*c}}');
  });

  it('escapeText is table-driven and pure', () => {
    const ctx = { lineStart: false, inCell: false, prev: '', next: '' };
    expect(escapeText('*b*', ctx)).toBe('\\*b\\*');
    expect(escapeText('a|b', ctx)).toBe('a|b');
    expect(escapeText('a|b', { ...ctx, inCell: true })).toBe('a\\|b');
    expect(escapeText('*b*', ctx, new Set(['*']))).toBe('*b*');
  });

  it('leaves parsed text alone: corpus emit is unchanged', () => {
    for (const { path, wiki } of WIKI_CORPUS) {
      const once = emitWiki(parseWiki(wiki).doc);
      expect(emitWiki(parseWiki(once).doc), path).toBe(once);
    }
  });
});
