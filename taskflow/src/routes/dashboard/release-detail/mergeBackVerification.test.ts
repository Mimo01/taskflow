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

/** Baseline `TrackingMR` fixture with `target_branch: 'develop'` — matches
 *  `makeParams`'s default `defaultBranch`, so existing pre-Task-1 cases keep
 *  their prior expectations unchanged. */
function makeMR(overrides: Partial<TrackingMR> = {}): TrackingMR {
  return {
    iid: 4821,
    state: 'merged',
    web_url: 'https://gitlab.example/mr/4821',
    target_branch: 'develop',
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
    const mr: TrackingMR = makeMR({ merged_at: '2026-07-21T09:14:00.000Z' });
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
    const mr: TrackingMR = makeMR();
    const result = resolveMergeBackVerdict(makeParams({ trackingMRs: [mr] }));
    expect(result).toMatchObject({ kind: 'merged', via: 'tracking-mr', mergedAt: null });
  });

  it('MERGE-02 precedence: a merged MR wins even when compareResult.diffCount is 12', () => {
    const mr: TrackingMR = makeMR({ merged_at: null });
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
    const mr: TrackingMR = makeMR({
      iid: 100,
      state: 'closed',
      web_url: 'https://gitlab.example/mr/100',
    });
    const result = resolveMergeBackVerdict(makeParams({ trackingMRs: [mr] }));
    expect(result).toEqual({
      kind: 'merged',
      via: 'content-compare',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
    });
  });

  it('a tracking MR with state opened and diffCount 3 yields likely-not-merged', () => {
    const mr: TrackingMR = makeMR({
      iid: 101,
      state: 'opened',
      web_url: 'https://gitlab.example/mr/101',
    });
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

describe('resolveMergeBackVerdict: CR-01/WR-02 target_branch filtering and deterministic MR selection', () => {
  it('CR-01: a merged MR targeting master with defaultBranch develop yields likely-not-merged, not merged', () => {
    const mr: TrackingMR = makeMR({ target_branch: 'master' });
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: [mr],
        defaultBranch: 'develop',
        compareResult: { diffCount: 3, commitCount: 12, timedOut: false },
      }),
    );
    expect(result.kind).not.toBe('merged');
    expect(result).toEqual({
      kind: 'likely-not-merged',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
      commitsNotInDefault: 12,
    });
  });

  it('CR-01: a merged MR targeting master with no tag yields couldnt-verify no-mr-no-tag, not merged', () => {
    const mr: TrackingMR = makeMR({ target_branch: 'master' });
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: [mr],
        defaultBranch: 'develop',
        tagName: null,
      }),
    );
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'no-mr-no-tag',
      expectedTagName: 'v33.7.0',
    });
  });

  it('CR-01: a merged MR targeting develop with defaultBranch develop yields merged via tracking-mr (happy path preserved)', () => {
    const mr: TrackingMR = makeMR({ target_branch: 'develop' });
    const result = resolveMergeBackVerdict(
      makeParams({ trackingMRs: [mr], defaultBranch: 'develop' }),
    );
    expect(result).toEqual({
      kind: 'merged',
      via: 'tracking-mr',
      defaultBranch: 'develop',
      mrIid: mr.iid,
      mrUrl: mr.web_url,
      mergedAt: null,
    });
  });

  it('WR-02: two develop-targeted merged MRs cite the later-merged_at MR regardless of input order', () => {
    const earlier: TrackingMR = makeMR({
      iid: 100,
      merged_at: '2026-01-01T00:00:00.000Z',
    });
    const later: TrackingMR = makeMR({
      iid: 200,
      merged_at: '2026-06-01T00:00:00.000Z',
    });

    const ascending = resolveMergeBackVerdict(
      makeParams({ trackingMRs: [earlier, later] }),
    );
    const descending = resolveMergeBackVerdict(
      makeParams({ trackingMRs: [later, earlier] }),
    );

    expect(ascending).toMatchObject({ kind: 'merged', via: 'tracking-mr', mrIid: 200 });
    expect(descending).toMatchObject({ kind: 'merged', via: 'tracking-mr', mrIid: 200 });
  });

  it('WR-02: two develop-targeted merged MRs with identical merged_at cite the higher iid', () => {
    const sameTime = '2026-06-01T00:00:00.000Z';
    const lowerIid: TrackingMR = makeMR({ iid: 100, merged_at: sameTime });
    const higherIid: TrackingMR = makeMR({ iid: 200, merged_at: sameTime });

    const result = resolveMergeBackVerdict(
      makeParams({ trackingMRs: [lowerIid, higherIid] }),
    );
    expect(result).toMatchObject({ kind: 'merged', via: 'tracking-mr', mrIid: 200 });
  });

  it('WR-02: a develop-targeted merged MR with merged_at null loses to one with a real timestamp', () => {
    const nullMergedAt: TrackingMR = makeMR({ iid: 100, merged_at: null });
    const realMergedAt: TrackingMR = makeMR({
      iid: 50,
      merged_at: '2026-06-01T00:00:00.000Z',
    });

    const result = resolveMergeBackVerdict(
      makeParams({ trackingMRs: [nullMergedAt, realMergedAt] }),
    );
    expect(result).toMatchObject({ kind: 'merged', via: 'tracking-mr', mrIid: 50 });
  });
});

describe('resolveMergeBackVerdict: CR-03/CR-04 terminal fallbacks for permanently-unavailable channels', () => {
  it('CR-04: defaultBranch null with defaultBranchCheckFailed true yields couldnt-verify check-failed, not loading', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ defaultBranch: null, defaultBranchCheckFailed: true }),
    );
    expect(result.kind).not.toBe('loading');
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'check-failed',
      expectedTagName: 'v33.7.0',
    });
  });

  it('CR-04: defaultBranch null with defaultBranchCheckFailed omitted still yields loading (genuine in-flight preserved)', () => {
    const result = resolveMergeBackVerdict(makeParams({ defaultBranch: null }));
    expect(result).toEqual({ kind: 'loading' });
  });

  it('CR-03: trackingMRsUnavailable true with no tag yields couldnt-verify no-mr-no-tag, not loading', () => {
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: undefined,
        trackingMRsCheckFailed: false,
        trackingMRsUnavailable: true,
        tagName: null,
      }),
    );
    expect(result.kind).not.toBe('loading');
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'no-mr-no-tag',
      expectedTagName: 'v33.7.0',
    });
  });

  it('CR-03: trackingMRsUnavailable true with a tag and diffCount 0 yields merged via content-compare', () => {
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: undefined,
        trackingMRsCheckFailed: false,
        trackingMRsUnavailable: true,
        compareResult: { diffCount: 0, commitCount: 0, timedOut: false },
      }),
    );
    expect(result).toEqual({
      kind: 'merged',
      via: 'content-compare',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
    });
  });

  it('CR-03: trackingMRs undefined with both new flags false/omitted still yields loading (genuine in-flight preserved)', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ trackingMRs: undefined, trackingMRsCheckFailed: false }),
    );
    expect(result).toEqual({ kind: 'loading' });
  });
});

describe('resolveMergeBackVerdict: tag-channel loading and failure guards (91-VERIFICATION truth 5)', () => {
  it('tagName null with tagLookupPending true and no merged MR yields loading, not couldnt-verify', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ tagName: null, tagLookupPending: true }),
    );
    expect(result.kind).not.toBe('couldnt-verify');
    expect(result).toEqual({ kind: 'loading' });
  });

  it('tagName null with tagCheckFailed true yields couldnt-verify check-failed, not no-mr-no-tag', () => {
    const result = resolveMergeBackVerdict(makeParams({ tagName: null, tagCheckFailed: true }));
    expect(result.kind).toBe('couldnt-verify');
    expect((result as { reason?: string }).reason).toBe('check-failed');
    expect((result as { reason?: string }).reason).not.toBe('no-mr-no-tag');
  });

  it('tagName null with both flags false yields couldnt-verify no-mr-no-tag (D-01 regression lock)', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ tagName: null, tagLookupPending: false, tagCheckFailed: false }),
    );
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'no-mr-no-tag',
      expectedTagName: 'v33.7.0',
    });
  });

  it('a merged MR targeting the default branch still wins with tagLookupPending true (precedence lock — step 4.5 sits below step 4)', () => {
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: [makeMR()],
        tagName: null,
        tagLookupPending: true,
      }),
    );
    expect(result).toEqual({
      kind: 'merged',
      via: 'tracking-mr',
      defaultBranch: 'develop',
      mrIid: 4821,
      mrUrl: 'https://gitlab.example/mr/4821',
      mergedAt: null,
    });
  });

  it('a merged MR targeting the default branch still wins with tagCheckFailed true', () => {
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: [makeMR()],
        tagName: null,
        tagCheckFailed: true,
      }),
    );
    expect(result.kind).toBe('merged');
  });

  it('tagCheckFailed wins over tagLookupPending when both flags are true simultaneously', () => {
    const result = resolveMergeBackVerdict(
      makeParams({ tagName: null, tagLookupPending: true, tagCheckFailed: true }),
    );
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'check-failed',
      expectedTagName: 'v33.7.0',
    });
  });

  it('omitting both tag-channel params entirely reproduces the pre-change verdict (default-compatibility lock)', () => {
    const result = resolveMergeBackVerdict(makeParams({ tagName: null }));
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'no-mr-no-tag',
      expectedTagName: 'v33.7.0',
    });
  });
});

describe('resolveMergeBackVerdict: WR-01 step 10 requires a healthy tracking-MR channel', () => {
  it('trackingMRsUnavailable true with a resolved tag and non-empty diff yields couldnt-verify check-failed, not likely-not-merged', () => {
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: undefined,
        trackingMRsCheckFailed: false,
        trackingMRsUnavailable: true,
        compareResult: { diffCount: 3, commitCount: 5, timedOut: false },
      }),
    );
    expect(result.kind).not.toBe('likely-not-merged');
    expect(result).toEqual({
      kind: 'couldnt-verify',
      reason: 'check-failed',
      expectedTagName: 'v33.7.0',
    });
  });

  it('trackingMRsUnavailable false with a resolved tag and non-empty diff yields likely-not-merged (guard does not over-fire)', () => {
    const result = resolveMergeBackVerdict(
      makeParams({
        trackingMRs: [],
        trackingMRsCheckFailed: false,
        trackingMRsUnavailable: false,
        compareResult: { diffCount: 3, commitCount: 5, timedOut: false },
      }),
    );
    expect(result).toEqual({
      kind: 'likely-not-merged',
      defaultBranch: 'develop',
      tagName: 'v33.7.0',
      commitsNotInDefault: 5,
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
