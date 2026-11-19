import { describe, expect, it } from 'vitest';
import { parseQueryParams } from './query-params';

describe('parseQueryParams', () => {
  it('keeps order and duplicates and decodes percent-encoding', () => {
    expect(parseQueryParams('https://h/p?jql=a%20b&x=1&x=2')).toEqual([
      ['jql', 'a b'],
      ['x', '1'],
      ['x', '2'],
    ]);
  });

  it('decodes + as a space', () => {
    expect(parseQueryParams('https://h/p?q=a+b')).toEqual([['q', 'a b']]);
  });

  it('returns [] when there is no query', () => {
    expect(parseQueryParams('https://h/p')).toEqual([]);
    expect(parseQueryParams('https://h/p?')).toEqual([]);
  });

  it('keeps the raw text for a malformed percent sequence', () => {
    expect(parseQueryParams('https://h/p?a=%E0%A4%A')).toEqual([['a', '%E0%A4%A']]);
  });

  it('tolerates invalid URLs and strips the fragment', () => {
    expect(parseQueryParams('/rest/api?x=1#frag')).toEqual([['x', '1']]);
  });

  it('handles keys without values', () => {
    expect(parseQueryParams('/p?flag&x=1')).toEqual([
      ['flag', ''],
      ['x', '1'],
    ]);
  });
});
