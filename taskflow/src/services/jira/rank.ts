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
  const afterVal = extractValue(after) || pad(beforeVal, beforeVal.length + 1);
  return `${bucket(before)}|${midpoint(beforeVal, afterVal)}:`;
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

function midpoint(a: string, b: string): string {
  // Pad to equal length (right-pad with '0')
  const len = Math.max(a.length, b.length);
  const pa = a.padEnd(len, '0');
  const pb = b.padEnd(len, '0');

  // Convert to BigInt (base-36) for precise integer arithmetic
  const ia = BigInt(parseInt(pa || '0', 36));
  const ib = BigInt(parseInt(pb || '0', 36));
  const mid = (ia + ib) / 2n;

  // Convert back to base-36, left-padded to original length
  let result = mid.toString(36).padStart(len, '0');

  // Adjacent-gap guard (RESEARCH Pitfall 3): if mid == before after integer division,
  // extend with a character at the alphabet midpoint ('i', index 18) to create a
  // value strictly between them. This handles e.g. before='aaaaaa', after='aaaaaab'.
  if (result === pa) {
    result = result + ALPHABET[Math.floor(ALPHABET.length / 2)];
  }

  return result;
}
