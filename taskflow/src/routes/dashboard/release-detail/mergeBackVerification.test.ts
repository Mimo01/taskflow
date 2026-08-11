import { describe, expect, it } from 'vitest';
import type { MergeBackCompareInput, TrackingMR } from './mergeBackVerification';
import {
  formatEvidenceDate,
  formatVerdictDate,
  resolveMergeBackVerdict,
} from './mergeBackVerification';

/**
 * Baseline params: released, matched milestone, defaultBranch `develop`, no
 * tracking MRs, tag `v33.7.0`, expectedTagName `v33.7.0`, compare result
 * `{ diffCount: 0, commitCount: 0, timedOut: false }`, neither check failed.
 * Each `it()` overrides only the field(s) under test.
 */
function makeParams(overrides: Partial<Parameters<typeof resolveMergeBackVerdict>[0]> = {}) {
  const defaultCompare: MergeBackCompareInput = { diffCount: 0, commitCount: 0, timedOut: false };
  return {
    releasedVersion: true,
    hasMatchedMilestone: true,
    defaultBranch: 'develop',
    trackingMRs: [] as readonly TrackingMR[],
    trackingMRsCheckFailed: false,
    tagName: 'v33.7.0',
    expectedTagName: 'v33.7.0',
    compareResult: defaultCompare,
    compareCheckFailed: false,
    ...overrides,
  };
}

describe('resolveMergeBackVerdict', () => {
  it('D-11: releasedVersion false yields hidden', () => {
    expect(resolveMergeBackVerdict(makeParams({ releasedVersion: false }))).toEqual({
      kind: 'hidden',
    });
  });

  it('D-11: hasMatchedMilestone false yields hidden', () => {
    expect(resolveMergeBackVerdict(makeParams({ hasMatchedMilestone: false }))).toEqual({
      kind: 'hidden',
    });
  });

  it('P-05: defaultBranch null yields loading', () => {
    expect(resolveMergeBackVerdict(makeParams({ defaultBranch: null }))).toEqual({
      kind: 'loading',
    });
  });

  it('trackingMRs undefined with trackingMRsCheckFailed false yields loading', () => {
    expect(
      resolveMergeBackVerdict(
        makeParams({ trackingMRs: undefined, trackingMRsCheckFailed: false }),
      ),
    ).toEqual({ kind: 'loading' });
  });

  it('D-02: a tracking MR with state merged yields merged via tracking-mr with matching fields', () => {
    const mr: TrackingMR = {
      iid: 4821,
      state: 'merged',
      web_url: 'https://gitlab.example/mr/4821',
      merged_at: '2026-07-21T09:14:00.000Z',
    };
    const result = resolveMergeBackVerdict(makeParams({ trackingMRs: [mr] }));
    expect(result).toEqual({
      kind: 'merged',
      via: 'tracking-mr',
      defaultBranch: 'develop',
      mrIid: 4821,
      mrUrl: 'https://gitlab.example/mr/4821',
      mergedAt: '2026-07-21T09:14:00.000Z',
    });
  });

  it('D-02/P-03: a tracking MR with state merged and no merged_at yields mergedAt null', () => {
    const mr: TrackingMR = {
      iid: 4821,
      state: 'merged',
      web_url: 'https://gitlab.example/mr/4821',
    };
    const result = resolveMergeBackVerdict(makeParams({ trackingMRs: [mr] }));
    expect(result).toMatchObject({ kind: 'merged', via: 'tracking-mr', mergedAt: null });
  });

  it('MERGE-02 precedence: a merged MR wins even when compareResult.diffCount is 12', () => {
    const mr: TrackingMR = {
      iid: 4821,
      state: 'merged',
      web_url: 'https://gitlab.example/mr/4821',
      merged_at: null,
    };
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: [mr],
        compareResult: { diffCount: 12, commitCount: 12, timedOut: false },
      }),
    );
    expect(result.kind).toBe('merged');
    expect((result as { via: string }).via).toBe('tracking-mr');
  });

  it('D-02: a tracking MR with state closed and diffCount 0 yields merged via content-compare', () => {
    const mr: TrackingMR = { iid: 100, state: 'closed', web_url: 'https://gitlab.example/mr/100' };
    const result = resolveMergeBackVerdict(makeParams({ trackingMRs: [mr] }));
    expect(result).toEqual({
      kind: 'merged',
      via: 'content-compare',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
    });
  });

  it('a tracking MR with state opened and diffCount 3 yields likely-not-merged', () => {
    const mr: TrackingMR = { iid: 101, state: 'opened', web_url: 'https://gitlab.example/mr/101' };
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: [mr],
        compareResult: { diffCount: 3, commitCount: 3, timedOut: false },
      }),
    );
    expect(result).toEqual({
      kind: 'likely-not-merged',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
      commitsNotInDefault: 3,
    });
  });

  it('D-01: tagName null with no merged MR yields couldnt-verify no-mr-no-tag', () => {
    const result = resolveMergeBackVerdict(makeParams({ tagName: null }));
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'no-mr-no-tag',
      expectedTagName: 'v33.7.0',
    });
  });

  it('D-01: tagName null and trackingMRsCheckFailed true yields couldnt-verify check-failed', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ tagName: null, trackingMRsCheckFailed: true }),
    );
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'check-failed',
      expectedTagName: 'v33.7.0',
    });
  });

  it('compareResult undefined with compareCheckFailed false yields loading', () => {
    expect(
      resolveMergeBackVerdict(makeParams({ compareResult: undefined, compareCheckFailed: false })),
    ).toEqual({ kind: 'loading' });
  });

  it('compareCheckFailed true yields couldnt-verify check-failed', () => {
    const result = resolveMergeBackVerdict(makeParams({ compareCheckFailed: true }));
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'check-failed',
      expectedTagName: 'v33.7.0',
    });
  });

  it('D-04: timedOut true with diffCount 0 yields couldnt-verify, not merged', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ compareResult: { diffCount: 0, commitCount: 0, timedOut: true } }),
    );
    expect(result.kind).not.toBe('merged');
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'check-failed',
      expectedTagName: 'v33.7.0',
    });
  });

  it('D-04: diffCount 0 yields merged via content-compare carrying defaultBranch and tagName', () => {
    const result = resolveMergeBackVerdict(makeParams());
    expect(result).toEqual({
      kind: 'merged',
      via: 'content-compare',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
    });
  });

  it('D-04: diffCount 4, commitCount 12 yields likely-not-merged with commitsNotInDefault 12', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ compareResult: { diffCount: 4, commitCount: 12, timedOut: false } }),
    );
    expect(result).toEqual({
      kind: 'likely-not-merged',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
      commitsNotInDefault: 12,
    });
  });

  it('P-04: diffCount 4 with trackingMRsCheckFailed true yields couldnt-verify, not likely-not-merged', () => {
    const result = resolveMergeBackVerdict(
      makeParams({
        compareResult: { diffCount: 4, commitCount: 4, timedOut: false },
        trackingMRsCheckFailed: true,
      }),
    );
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'check-failed',
      expectedTagName: 'v33.7.0',
    });
  });
});

describe('formatVerdictDate', () => {
  it('formats an ISO timestamp as day-of-month + short month', () => {
    expect(formatVerdictDate('2026-07-21T09:14:00.000Z')).toBe('21 Jul');
  });

  it('does not zero-pad a single-digit day', () => {
    expect(formatVerdictDate('2026-07-03T09:14:00.000Z')).toBe('3 Jul');
  });

  it('returns null for null, empty string, and an invalid date', () => {
    expect(formatVerdictDate(null)).toBeNull();
    expect(formatVerdictDate('')).toBeNull();
    expect(formatVerdictDate('not-a-date')).toBeNull();
  });
});

describe('formatEvidenceDate', () => {
  it('formats an ISO timestamp as zero-padded DD.MM.YYYY', () => {
    expect(formatEvidenceDate('2026-07-21T09:14:00.000Z')).toBe('21.07.2026');
  });

  it('zero-pads a single-digit day and month', () => {
    expect(formatEvidenceDate('2026-01-03T09:14:00.000Z')).toBe('03.01.2026');
  });

  it('returns null for null, empty string, and an invalid date', () => {
    expect(formatEvidenceDate(null)).toBeNull();
    expect(formatEvidenceDate('')).toBeNull();
    expect(formatEvidenceDate('not-a-date')).toBeNull();
  });
});
