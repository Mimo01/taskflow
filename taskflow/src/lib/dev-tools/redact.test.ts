import { describe, expect, it } from 'vitest';
import { redactHeaders, redactUrl } from './redact';

describe('redactHeaders', () => {
  it('redacts secrets in a plain object and keeps casing and other headers', () => {
    const out = redactHeaders({ Authorization: 'Bearer x', Accept: 'a' });
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.Accept).toBe('a');
  });

  it('handles a Headers instance (lower-case names)', () => {
    const h = new Headers();
    h.set('Set-Cookie', 'sid=1');
    h.set('Content-Type', 'application/json');
    const out = redactHeaders(h);
    expect(out['set-cookie']).toBe('[REDACTED]');
    expect(out['content-type']).toBe('application/json');
  });

  it('handles tuple arrays', () => {
    const out = redactHeaders([
      ['PRIVATE-TOKEN', 'abc'],
      ['X', '1'],
    ]);
    expect(out['PRIVATE-TOKEN']).toBe('[REDACTED]');
    expect(out.X).toBe('1');
  });

  it('redacts by name pattern', () => {
    expect(redactHeaders({ 'X-Session-Id': 's' })['X-Session-Id']).toBe('[REDACTED]');
  });

  it('returns {} for undefined and null', () => {
    expect(redactHeaders(undefined)).toEqual({});
    expect(redactHeaders(null)).toEqual({});
  });
});

describe('redactUrl', () => {
  it('redacts token-like params', () => {
    expect(redactUrl('https://h/p?private_token=abc&x=1')).toBe(
      'https://h/p?private_token=REDACTED&x=1',
    );
    expect(redactUrl('https://h/p?a=1&password=pw&secret=s')).toBe(
      'https://h/p?a=1&password=REDACTED&secret=REDACTED',
    );
  });

  it('leaves clean URLs unchanged', () => {
    expect(redactUrl('https://h/p?x=1&y=2')).toBe('https://h/p?x=1&y=2');
  });
});
