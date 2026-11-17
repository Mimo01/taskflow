import { describe, expect, it } from 'vitest';
import { ISSUE_KEY_EXACT_RE, ISSUE_KEY_LINK_CLASS, isKnownPrefix } from './issue-key';

describe('issue-key', () => {
  it('exact regex accepts and rejects the right shapes', () => {
    expect(ISSUE_KEY_EXACT_RE.test('DEMO-12')).toBe(true);
    expect(ISSUE_KEY_EXACT_RE.test('AB_C-1')).toBe(true);
    for (const bad of ['demo-1', 'DEMO-', 'D-1', 'DEMO-1a']) {
      expect(ISSUE_KEY_EXACT_RE.test(bad)).toBe(false);
    }
  });

  it('isKnownPrefix handles arrays, strings and null', () => {
    expect(isKnownPrefix('DEMO-1', ['DEMO'])).toBe(true);
    expect(isKnownPrefix('XYZ-1', ['DEMO'])).toBe(false);
    expect(isKnownPrefix('DEMO-1', [])).toBe(false);
    expect(isKnownPrefix('DEMO-1', 'DEMO')).toBe(true);
    expect(isKnownPrefix('DEMO-1', null)).toBe(false);
  });

  it('exports the link class', () => {
    expect(ISSUE_KEY_LINK_CLASS).toBe('text-primary hover:underline');
  });
});
