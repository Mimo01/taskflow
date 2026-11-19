import { describe, expect, it } from 'vitest';
import { byteSize, capText, safeStringify } from './json-preview';

describe('safeStringify', () => {
  it('serialises Map, Set and BigInt', () => {
    const out = safeStringify({ m: new Map([['a', 1]]), s: new Set([1, 2]), b: 10n }, 0);
    expect(out).toBe('{"m":{"a":1},"s":[1,2],"b":"10"}');
  });

  it('falls back to String() on cycles', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(safeStringify(a)).toBe('[object Object]');
  });

  it('handles undefined and primitives', () => {
    expect(safeStringify(undefined)).toBe('undefined');
    expect(safeStringify(null)).toBe('null');
    expect(safeStringify('x')).toBe('"x"');
  });

  it('does not treat a repeated non-cyclic reference as a cycle', () => {
    const shared = { a: 1 };
    expect(safeStringify([shared, shared], 0)).toBe('[{"a":1},{"a":1}]');
  });
});

describe('capText', () => {
  it('leaves text at the boundary untouched', () => {
    expect(capText('abcde', 5)).toEqual({ text: 'abcde', truncated: false, totalBytes: 5 });
  });

  it('truncates just past the boundary', () => {
    const r = capText('abcdef', 5);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe('abcde');
    expect(r.totalBytes).toBe(6);
  });

  it('byteSize counts UTF-8 bytes', () => {
    expect(byteSize('é')).toBe(2);
  });
});
