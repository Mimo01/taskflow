import { describe, expect, it } from 'vitest';

import { rankIssue } from './rank';

/**
 * Compare two rank strings using bucket-aware ordering.
 * Bucket (the integer before '|') takes precedence over value.
 * If buckets are equal, the value portion (between '|' and ':') is compared lexically.
 * This correctly handles cross-bucket assertions: '0|zzzzzzg:' < '1|000000:' because
 * bucket 0 < bucket 1 regardless of the value portions.
 */
function rankLt(a: string, b: string): boolean {
  const parseRank = (r: string) => {
    const pipeIdx = r.indexOf('|');
    const colonIdx = r.indexOf(':');
    const bkt = pipeIdx === -1 ? '0' : r.slice(0, pipeIdx);
    const val = r.slice(pipeIdx + 1, colonIdx === -1 ? undefined : colonIdx);
    return { bucket: parseInt(bkt, 10), val };
  };
  const ra = parseRank(a);
  const rb = parseRank(b);
  if (ra.bucket < rb.bucket) return true;
  if (ra.bucket > rb.bucket) return false;
  return ra.val < rb.val;
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

  it('E7: different buckets — result is strictly between before and after', () => {
    const before = '0|zzzzzz:';
    const after = '1|000000:';
    const result = rankIssue(before, after);
    expect(rankLt(before, result)).toBe(true);
    expect(rankLt(result, after)).toBe(true);
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

  it('E10: CR-02 — 12-char rank string — no precision collapse', () => {
    const before = '0|aaaaaaaaaaaa:'; // 12 chars
    const after = '0|zzzzzzzzzzzz:'; // 12 chars
    const result = rankIssue(before, after);
    expect(rankLt(before, result)).toBe(true);
    expect(rankLt(result, after)).toBe(true);
  });

  it('E11: CR-01 — 0|zzzzzz before 1|000000 — strict ordering', () => {
    const before = '0|zzzzzz:';
    const after = '1|000000:';
    const result = rankIssue(before, after);
    expect(rankLt(before, result)).toBe(true);
    expect(rankLt(result, after)).toBe(true);
  });

  it('E12: repeated midpoint — insert 5 items between a and b — all strictly ordered', () => {
    let lo = '0|aaaaaa:';
    let hi = '0|bbbbbb:';
    const inserted: string[] = [];
    for (let i = 0; i < 5; i++) {
      const mid = rankIssue(lo, hi);
      inserted.push(mid);
      lo = mid;
    }
    for (let i = 0; i < inserted.length - 1; i++) {
      expect(rankLt(inserted[i], inserted[i + 1])).toBe(true);
    }
  });
});
