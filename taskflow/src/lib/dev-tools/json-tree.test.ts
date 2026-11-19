import { describe, expect, it, vi } from 'vitest';
import {
  ARRAY_PAGE,
  collectContainerKeys,
  findJsonMatches,
  formatJsonPath,
  MAX_TREE_BYTES,
  nodeSummary,
  parseJsonBody,
  pathKey,
} from './json-tree';

describe('parseJsonBody', () => {
  it('parses valid JSON', () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ kind: 'json', value: { a: 1 } });
  });
  it('flags invalid and empty text', () => {
    expect(parseJsonBody('not json')).toEqual({ kind: 'text', reason: 'invalid' });
    expect(parseJsonBody('')).toEqual({ kind: 'text', reason: 'empty' });
    expect(parseJsonBody('   \n')).toEqual({ kind: 'text', reason: 'empty' });
  });
  it('rejects oversized bodies without calling JSON.parse', () => {
    const spy = vi.spyOn(JSON, 'parse');
    const big = `"${'a'.repeat(MAX_TREE_BYTES)}"`;
    expect(parseJsonBody(big)).toEqual({ kind: 'text', reason: 'too-large' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('formatJsonPath', () => {
  it('formats identifiers, indexes and odd keys', () => {
    expect(formatJsonPath(['fields', 'status', 'name'])).toBe('fields.status.name');
    expect(formatJsonPath(['issues', 3, 'key'])).toBe('issues[3].key');
    expect(formatJsonPath([0, 'id'])).toBe('[0].id');
    expect(formatJsonPath(['a b'])).toBe('["a b"]');
    expect(formatJsonPath([])).toBe('$');
  });
  it('pathKey is a stable JSON id', () => {
    expect(pathKey(['a', 1])).toBe('["a",1]');
  });
});

describe('nodeSummary', () => {
  it('summarises objects and arrays', () => {
    const obj = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i]));
    expect(nodeSummary(obj)).toBe('{…} 12 keys');
    expect(nodeSummary({ a: 1 })).toBe('{…} 1 key');
    expect(nodeSummary({})).toBe('{} empty');
    expect(nodeSummary(Array.from({ length: 50 }, (_, i) => i))).toBe('[…] 50 items');
    expect(nodeSummary([1])).toBe('[…] 1 item');
    expect(nodeSummary([])).toBe('[] empty');
  });
});

describe('findJsonMatches', () => {
  const doc = { fields: { status: { name: 'Done' }, summary: 'x' }, other: [1, 2] };

  it('matches values and expands every ancestor, root included', () => {
    const r = findJsonMatches(doc, 'done');
    expect(r.count).toBe(1);
    expect(r.matches.has(pathKey(['fields', 'status', 'name']))).toBe(true);
    expect(r.expand).toEqual(
      new Set([pathKey([]), pathKey(['fields']), pathKey(['fields', 'status'])]),
    );
  });

  it('matches keys case-insensitively', () => {
    const r = findJsonMatches(doc, 'STATUS');
    expect(r.matches.has(pathKey(['fields', 'status']))).toBe(true);
  });

  it('returns empty sets for an empty needle', () => {
    const r = findJsonMatches(doc, '');
    expect(r.count).toBe(0);
    expect(r.matches.size).toBe(0);
    expect(r.expand.size).toBe(0);
  });

  it('caps the match count', () => {
    const r = findJsonMatches(
      Array.from({ length: 10 }, () => 'hit'),
      'hit',
      3,
    );
    expect(r.count).toBe(3);
    expect(r.capped).toBe(true);
  });
});

describe('collectContainerKeys', () => {
  it('collects root and nested containers', () => {
    const keys = collectContainerKeys({ a: { b: [1, { c: 1 }] }, d: 1 });
    expect(keys).toEqual(
      new Set([pathKey([]), pathKey(['a']), pathKey(['a', 'b']), pathKey(['a', 'b', 1])]),
    );
  });
  it('respects maxNodes', () => {
    const keys = collectContainerKeys({ a: {}, b: {}, c: {}, d: {} }, 2);
    expect(keys.size).toBe(2);
  });
  it('does not descend past ARRAY_PAGE children', () => {
    const arr = Array.from({ length: ARRAY_PAGE + 5 }, () => ({}));
    const keys = collectContainerKeys(arr);
    expect(keys.has(pathKey([ARRAY_PAGE - 1]))).toBe(true);
    expect(keys.has(pathKey([ARRAY_PAGE]))).toBe(false);
  });
});
