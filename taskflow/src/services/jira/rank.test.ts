import { describe, expect, it } from 'vitest';

import { rankIssue } from './rank';

// Helper: lexicographic comparison of two full rank strings
function rankLt(a: string, b: string): boolean {
  return a < b;
}

describe('rankIssue', () => {
  it('E1: before=null, after=rank — result is less than after', () => {
    const after = '0|hzzzzz:';
    const result = rankIssue(null, after);
    expect(rankLt(result, after)).toBe(true);
  });

  it('E2: before=rank, after=null — result is greater than before', () => {
    const before = '0|hzzzzz:';
    const result = rankIssue(before, null);
    expect(rankLt(before, result)).toBe(true);
  });

  it('E3: before=null, after=null — returns a valid rank string (contains | and :)', () => {
    const result = rankIssue(null, null);
    expect(result).toMatch(/\|/);
    expect(result).toContain(':');
  });

  it('E4: before=aaaaaa, after=zzzzzz — result is strictly between', () => {
    const before = '0|aaaaaa:';
    const after = '0|zzzzzz:';
    const result = rankIssue(before, after);
    expect(rankLt(before, result)).toBe(true);
    expect(rankLt(result, after)).toBe(true);
  });

  it('E5: adjacent ranks with no integer gap — result is strictly between (digit extension)', () => {
    const before = '0|aaaaaa:';
    const after = '0|aaaaaab:';
    const result = rankIssue(before, after);
    expect(rankLt(before, result)).toBe(true);
    expect(rankLt(result, after)).toBe(true);
  });

  it('E6: before=aaaaaa, after=aaaaaa1 — result is strictly between', () => {
    const before = '0|aaaaaa:';
    const after = '0|aaaaaa1:';
    const result = rankIssue(before, after);
    expect(rankLt(before, result)).toBe(true);
    expect(rankLt(result, after)).toBe(true);
  });

  it("E7: different buckets — result uses before's bucket (0|)", () => {
    const before = '0|hzzzzz:';
    const after = '1|hzzzzz:';
    const result = rankIssue(before, after);
    expect(result.startsWith('0|')).toBe(true);
  });

  it('E8: near-zero boundary — before=000000, after=000001 — result is strictly between', () => {
    const before = '0|000000:';
    const after = '0|000001:';
    const result = rankIssue(before, after);
    expect(rankLt(before, result)).toBe(true);
    expect(rankLt(result, after)).toBe(true);
  });

  it('E9: near-max boundary — before=zzzzzz, after=null — result is greater than before', () => {
    const before = '0|zzzzzz:';
    const result = rankIssue(before, null);
    expect(rankLt(before, result)).toBe(true);
  });
});
