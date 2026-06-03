/**
 * LexoRank midpoint calculator.
 *
 * Pure function — no side effects, no API calls.
 * Phase 78 (drag-to-rank) consumes `rankIssue` directly.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Compute a LexoRank string strictly between `before` and `after`.
 *
 * - Pass null for `before` to rank before all items (insert at start).
 * - Pass null for `after` to rank after all items (insert at end).
 *
 * The returned string is suitable for use with Jira's rank field
 * (Phase 78 will call the PUT rank API; this function only produces the rank value).
 *
 * Pure function — no side effects, no API calls.
 */
export function rankIssue(before: string | null, after: string | null): string {
  const beforeVal = extractValue(before);
  const afterVal = extractValue(after);
  const beforeBucket = bucket(before);
  const afterBucket = bucket(after);

  // CR-01: when neighbours are in different buckets, stay in the lower bucket
  // and extend before's value with the alphabet midpoint character ('i', index 18).
  // Result is strictly > before (same bucket, longer value) and < after (higher bucket).
  if (before !== null && after !== null && beforeBucket !== afterBucket) {
    const midChar = ALPHABET[Math.floor(ALPHABET.length / 2)]; // 'i'
    return `${beforeBucket}|${beforeVal}${midChar}:`;
  }

  const targetBucket = beforeBucket || afterBucket || '0';
  const effectiveAfterVal = afterVal || pad(beforeVal, beforeVal.length + 1);
  return `${targetBucket}|${midpoint(beforeVal, effectiveAfterVal)}:`;
}

function extractValue(rank: string | null): string {
  if (!rank) return '';
  const pipeIdx = rank.indexOf('|');
  const colonIdx = rank.indexOf(':');
  if (pipeIdx === -1) return rank;
  return rank.slice(pipeIdx + 1, colonIdx === -1 ? undefined : colonIdx);
}

function bucket(rank: string | null): string {
  if (!rank) return '0';
  const pipeIdx = rank.indexOf('|');
  return pipeIdx === -1 ? '0' : rank.slice(0, pipeIdx);
}

function pad(s: string, len: number): string {
  return s.padEnd(len, ALPHABET[ALPHABET.length - 1]); // pad with 'z'
}

// CR-02: digit-by-digit BigInt parse to avoid float64 precision loss from parseInt
function parseBase36(s: string): bigint {
  let result = 0n;
  for (const c of s) {
    result = result * 36n + BigInt(ALPHABET.indexOf(c));
  }
  return result;
}

function toBase36(n: bigint, minLen: number): string {
  if (n === 0n) return '0'.padStart(minLen, '0');
  let s = '';
  let v = n;
  while (v > 0n) {
    s = ALPHABET[Number(v % 36n)] + s;
    v = v / 36n;
  }
  return s.padStart(minLen, '0');
}

function midpoint(a: string, b: string): string {
  // Pad to equal length (right-pad with '0')
  const len = Math.max(a.length, b.length);
  const pa = a.padEnd(len, '0');
  const pb = b.padEnd(len, '0');

  // CR-02: use digit-by-digit BigInt parsing for arbitrary-precision arithmetic
  const ia = parseBase36(pa || '0');
  const ib = parseBase36(pb || '0');
  const mid = (ia + ib) / 2n;

  // Convert back to base-36, left-padded to original length
  let result = toBase36(mid, len);

  // Adjacent-gap guard (RESEARCH Pitfall 3): if mid == before after integer division,
  // extend with a character at the alphabet midpoint ('i', index 18) to create a
  // value strictly between them. This handles e.g. before='aaaaaa', after='aaaaaab'.
  if (result === pa) {
    result = result + ALPHABET[Math.floor(ALPHABET.length / 2)];
  }

  return result;
}
