import { describe, expect, it } from 'vitest';
import {
  checkCorpus,
  formatCorpusFailures,
  formatEquivalenceDiff,
  isEquivalent,
  normalizeHastForCompare,
} from './equivalence';
import type { HastElement, HastText } from './pipeline';

const el = (
  tagName: string,
  properties: Record<string, unknown>,
  children: Array<HastText | HastElement> = [],
): HastElement => ({ type: 'element', tagName, properties, children });
const text = (value: string): HastText => ({ type: 'text', value });

describe('normalizeHastForCompare', () => {
  it('attribute order', () => {
    const inner = el('span', { z: 1, y: 2 });
    const div = el('div', { b: '2', a: '1' }, [inner]);
    normalizeHastForCompare(div);
    expect(Object.keys(div.properties ?? {})).toEqual(['a', 'b']);
    expect(Object.keys(inner.properties ?? {})).toEqual(['y', 'z']);
  });

  it('whitespace', () => {
    const t = text('a  \n\t b');
    normalizeHastForCompare(el('p', {}, [t]));
    expect(t.value).toBe('a b');
  });

  it('keeps whitespace under pre and pre > code', () => {
    const t1 = text('a  b');
    const t2 = text('c \n d');
    normalizeHastForCompare(el('pre', {}, [t1, el('code', {}, [t2])]));
    expect(t1.value).toBe('a  b');
    expect(t2.value).toBe('c \n d');
  });

  it('does not collapse nbsp', () => {
    const t = text('a\u00a0\u00a0b');
    normalizeHastForCompare(el('p', {}, [t]));
    expect(t.value).toBe('a\u00a0\u00a0b');
  });

  it('skips childless nodes (comment, doctype, raw)', () => {
    const t = text('a  b');
    const root = {
      type: 'root',
      children: [
        { type: 'doctype' },
        { type: 'comment', value: 'x' },
        { type: 'raw', value: '<b>' },
        el('p', {}, [t]),
      ],
    } as unknown as Parameters<typeof normalizeHastForCompare>[0];
    expect(() => normalizeHastForCompare(root)).not.toThrow();
    expect(t.value).toBe('a b');
  });
});

describe('isEquivalent', () => {
  it('ignores whitespace runs', () => {
    expect(isEquivalent('alpha  beta', 'alpha beta')).toBe(true);
  });
  it('pre whitespace is significant', () => {
    expect(isEquivalent('{code}a  b{code}', '{code}a b{code}')).toBe(false);
  });
  it('emoticon vs text differs', () => {
    expect(isEquivalent('(/) done', 'OK done')).toBe(false);
  });
  it('bold vs italic differs', () => {
    expect(isEquivalent('*bold*', '_bold_')).toBe(false);
  });
  it('CRLF equals LF', () => {
    expect(isEquivalent('line one\r\nline two', 'line one\nline two')).toBe(true);
  });
  it('fails closed when the oracle throws', () => {
    // A non-string reaching the oracle makes preprocess throw (TypeError).
    expect(isEquivalent('a', 42 as unknown as string)).toBe(false);
  });
});

describe('formatEquivalenceDiff', () => {
  it('prints a unified diff', () => {
    const d = formatEquivalenceDiff('x.wiki', '<p>a</p>', '<p>b</p>');
    for (const s of ['x.wiki', '---', '+++', '@@', '-<p>a</p>', '+<p>b</p>']) {
      expect(d).toContain(s);
    }
  });
});

describe('checkCorpus', () => {
  const corpus = [{ path: 'p.wiki', wiki: '(/) a' }];
  it('reports a lossy round trip', () => {
    const f = checkCorpus(corpus, (s) => s.split('(/)').join('OK'));
    expect(f).toHaveLength(1);
    expect(f[0].path).toBe('p.wiki');
    expect(f[0].diff).not.toBe('');
    expect(f[0].emitted).toBe('OK a');
  });
  it('identity passes', () => {
    expect(checkCorpus(corpus, (s) => s)).toEqual([]);
  });
  it('turns a throwing round trip into a failure', () => {
    const f = checkCorpus(corpus, () => {
      throw new Error('boom');
    });
    expect(f[0].diff).toContain('boom');
  });
  it('turns an oracle throw into a per-fixture failure', () => {
    const two = [...corpus, { path: 'q.wiki', wiki: '(/) b' }];
    const f = checkCorpus(two, (s) => (s.includes('b') ? s.split('(/)').join('OK') : 42) as string);
    expect(f.map((x) => x.path)).toEqual(['p.wiki', 'q.wiki']);
    expect(f[0].diff).toContain('oracle threw');
    expect(f[1].diff).toContain('@@');
  });
  it('formats failures', () => {
    const f = checkCorpus(corpus, (s) => s.split('(/)').join('OK'));
    const out = formatCorpusFailures(f);
    expect(out).toContain('p.wiki');
    expect(out).toContain(f[0].diff);
    expect(out).toContain('Emitted wiki:');
    expect(formatCorpusFailures([])).toBe('');
  });
});
