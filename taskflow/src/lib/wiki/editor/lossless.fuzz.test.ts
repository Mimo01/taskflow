import { describe, expect, it } from 'vitest';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

/** Local seeded PRNG (mulberry32); no fast-check dependency. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOKENS = [
  '*',
  '#',
  '-',
  '_',
  '+',
  '^',
  '~',
  '??',
  '{{',
  '}}',
  '{code}',
  '{code:java}',
  '{noformat}',
  '{panel}',
  '{panel:title=T}',
  '{info}',
  '{tip}',
  '{quote}',
  '{color:red}',
  '{color}',
  '{status}',
  '|',
  '||',
  '[',
  ']',
  '[~jdoe]',
  '[^spec.pdf]',
  '!',
  '!diagram.png!',
  '(/)',
  '(x)',
  '\\\\',
  '\\*',
  'h1. ',
  'bq. ',
  '----',
  ' ',
  ' ',
  'word',
  'text',
  'a',
  '\n',
  '\n',
  '\n\n',
];

function generate(rand: () => number, count: number): string {
  let s = '';
  for (let i = 0; i < count; i++) s += TOKENS[Math.floor(rand() * TOKENS.length)];
  // Line-end whitespace is stripped on emit (D-07), so the generator trims it.
  return s.replace(/[ \t]+$/gm, '');
}

const inputs = Array.from({ length: 500 }, (_, i) => generate(mulberry32(1000 + i), 5 + (i % 60)));

describe('lossless fuzz', () => {
  it('500 seeded inputs parse, check, round-trip and tile', () => {
    for (const x of inputs) {
      const { doc, slices } = parseWiki(x);
      wikiSchema.nodeFromJSON(doc).check();
      expect(emitWiki(doc), JSON.stringify(x)).toBe(x);
      expect(slices.join(''), JSON.stringify(x)).toBe(x);
    }
  });

  it('the same inputs converted to CRLF round-trip byte-identically', () => {
    for (const x of inputs) {
      const crlf = x.replace(/\n/g, '\r\n');
      expect(emitWiki(parseWiki(crlf).doc), JSON.stringify(crlf)).toBe(crlf);
    }
  });

  it('a 200 KB input parses and emits in under 2000 ms', () => {
    const big = generate(mulberry32(42), 60_000);
    const t0 = performance.now();
    const { doc } = parseWiki(big);
    const out = emitWiki(doc);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(out).toBe(big);
  });
});
