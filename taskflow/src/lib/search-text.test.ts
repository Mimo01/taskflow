import fuzzysort from 'fuzzysort';
import { describe, expect, it } from 'vitest';
import {
  buildSnippet,
  compareTextMatch,
  matchText,
  runsFromIndexes,
  stripWikiMarkup,
  tokenize,
} from './search-text';

const TITLE = 'Checkout fails when cart empty';

describe('import spike', () => {
  it('resolves fuzzysort v4 ESM', () => {
    const r = fuzzysort.single('chk', 'checkout');
    expect(r).not.toBeNull();
    expect(r?.indexes.length).toBeGreaterThan(0);
  });
});

describe('fuzzy', () => {
  it('tokenizes', () => {
    expect(tokenize('  Cart  EMPTY ')).toEqual(['cart', 'empty']);
  });
  it('exact phrase', () => {
    const m = matchText('cart empty', TITLE);
    expect(m?.kind).toBe('exact');
    expect(m?.indexes).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
  });
  it('word-start tokens', () => {
    expect(matchText('fail cart', TITLE)?.kind).toBe('word-start');
  });
  it('tolerates typos', () => {
    expect(matchText('chekout', TITLE)?.kind).toBe('fuzzy');
  });
  it('short tokens need substring', () => {
    expect(matchText('xq', TITLE)).toBeNull();
  });
  it('every token must match', () => {
    expect(matchText('cart zebra', TITLE)).toBeNull();
  });
  it('suppresses scattered-letter noise on long titles', () => {
    const long =
      'Refactor the notification dispatcher so that retries are batched across several workers and queues';
    expect(matchText('checkout', long)).toBeNull();
    expect(matchText('zqxjk', long)).toBeNull();
  });
  it('orders exact < word-start < fuzzy, then by score', () => {
    const e = matchText('cart empty', TITLE);
    const w = matchText('fail cart', TITLE);
    const f = matchText('chekout', TITLE);
    if (!e || !w || !f) throw new Error('missing match');
    expect(compareTextMatch(e, w)).toBeLessThan(0);
    expect(compareTextMatch(w, f)).toBeLessThan(0);
    expect(compareTextMatch({ ...f, score: 0.9 }, { ...f, score: 0.5 })).toBeLessThan(0);
  });
  it('fuzzy:false only accepts substrings', () => {
    const desc = `${'lorem ipsum '.repeat(20)}the cart is broken`;
    expect(matchText('cart', desc, { fuzzy: false })).not.toBeNull();
    expect(matchText('crt', desc, { fuzzy: false })).toBeNull();
  });
});

describe('highlight', () => {
  it('merges runs', () => {
    expect(runsFromIndexes([0, 1, 2, 5, 6, 9])).toEqual([
      [0, 3],
      [5, 7],
      [9, 10],
    ]);
  });
  it('caps at 6 and handles unsorted input', () => {
    const idx = [20, 0, 2, 4, 6, 8, 10, 12, 14];
    const runs = runsFromIndexes(idx);
    expect(runs).toHaveLength(6);
    expect(runs[0]).toEqual([0, 1]);
  });
});

describe('snippet', () => {
  const text = `${'a'.repeat(200)}   needle   \n  ${'b'.repeat(200)}`;
  it('builds ellipsised window with relative ranges', () => {
    const s = buildSnippet(text, 'needle');
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.text.startsWith('…')).toBe(true);
    expect(s.text.endsWith('…')).toBe(true);
    expect(s.text).not.toMatch(/\s{2,}/);
    const [a, b] = s.ranges[0];
    expect(s.text.slice(a, b)).toBe('needle');
  });
  it('returns null without a hit', () => {
    expect(buildSnippet(text, 'zebra')).toBeNull();
  });
});

describe('wiki strip', () => {
  it('removes markup', () => {
    const src =
      'h2. Title\n{code:java}x{code} {color:red}hi{color} !a.png|thumbnail! ping [~jdoe] see [docs|http://x]';
    const out = stripWikiMarkup(src);
    expect(out).not.toMatch(/h2\.|\{code|\{color|!a\.png|\|http/);
    expect(out).toContain('jdoe');
    expect(out).toContain('docs');
    expect(out).not.toContain('[~');
  });
});

describe('buildSnippet lead-in', () => {
  const text =
    'As a customer I want correct totals. Currently when the cart is empty the provider returns a stale total.';

  it('keeps only `before` chars ahead of the match so it stays visible when truncated', () => {
    const snip = buildSnippet(text, 'cart empty', 64, 16);
    expect(snip).not.toBeNull();
    const firstMark = snip?.ranges[0]?.[0] ?? -1;
    expect(firstMark).toBeGreaterThan(0);
    expect(firstMark).toBeLessThanOrEqual(1 + 16);
  });

  it('never opens mid-word', () => {
    const snip = buildSnippet(text, 'cart empty', 64, 16);
    // "…" + a whole word: the char after the ellipsis starts a word.
    expect(snip?.text.startsWith('…')).toBe(true);
    const idx = text.indexOf(snip?.text.slice(1, 10) ?? '');
    expect(idx === 0 || text[idx - 1] === ' ').toBe(true);
  });
});
