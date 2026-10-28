import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import {
  buildStoryPointOptions,
  matchesStoryPointsFilter,
  NO_ESTIMATE_FILTER,
  NO_ESTIMATE_LABEL,
  readStoryPoints,
} from './story-points-filter';

const KEY = 'customfield_10028';
const mk = (fields: Record<string, unknown>) => ({ fields }) as unknown as JiraIssue;
const sp = (n: number | null) => mk({ customfield_10016: n });

describe('constants', () => {
  it('exposes sentinel and label', () => {
    expect(NO_ESTIMATE_FILTER).toBe('__no_estimate__');
    expect(NO_ESTIMATE_LABEL).toBe('No estimate');
  });
});

describe('readStoryPoints', () => {
  it('reads the configured field', () => {
    expect(readStoryPoints(mk({ [KEY]: 5 }), KEY)).toBe(5);
  });
  it('falls back to customfield_10016', () => {
    expect(readStoryPoints(mk({ [KEY]: null, customfield_10016: 3 }), KEY)).toBe(3);
    expect(readStoryPoints(mk({ customfield_10016: 3 }), KEY)).toBe(3);
  });
  it('returns null when both missing', () => {
    expect(readStoryPoints(mk({}), KEY)).toBeNull();
  });
  it('returns null for non-finite or non-number', () => {
    expect(readStoryPoints(mk({ [KEY]: Number.NaN }), KEY)).toBeNull();
    expect(readStoryPoints(mk({ [KEY]: '5' }), KEY)).toBeNull();
  });
  it('keeps 0', () => {
    expect(readStoryPoints(mk({ [KEY]: 0 }), KEY)).toBe(0);
  });
});

describe('buildStoryPointOptions', () => {
  it('dedupes, sorts numerically, pins sentinel first', () => {
    const issues = [5, 13, 2, 0.5, 5, null].map(sp);
    expect(buildStoryPointOptions(issues, KEY)).toEqual(['__no_estimate__', '0.5', '2', '5', '13']);
  });
  it('omits sentinel when all estimated; empty gives []', () => {
    expect(buildStoryPointOptions([sp(1), sp(2)], KEY)).toEqual(['1', '2']);
    expect(buildStoryPointOptions([], KEY)).toEqual([]);
  });
});

describe('matchesStoryPointsFilter', () => {
  it('empty set matches all', () => {
    expect(matchesStoryPointsFilter(sp(null), new Set(), KEY)).toBe(true);
    expect(matchesStoryPointsFilter(sp(5), new Set(), KEY)).toBe(true);
  });
  it('exact numeric match', () => {
    const a = new Set(['5']);
    expect(matchesStoryPointsFilter(sp(5), a, KEY)).toBe(true);
    expect(matchesStoryPointsFilter(sp(13), a, KEY)).toBe(false);
    expect(matchesStoryPointsFilter(sp(0.5), a, KEY)).toBe(false);
    expect(matchesStoryPointsFilter(sp(null), a, KEY)).toBe(false);
    expect(matchesStoryPointsFilter(sp(0.5), new Set(['0.5']), KEY)).toBe(true);
    expect(matchesStoryPointsFilter(sp(13), new Set(['1']), KEY)).toBe(false);
  });
  it('sentinel matches only unestimated, not 0', () => {
    const a = new Set([NO_ESTIMATE_FILTER]);
    expect(matchesStoryPointsFilter(sp(null), a, KEY)).toBe(true);
    expect(matchesStoryPointsFilter(sp(0), a, KEY)).toBe(false);
  });
  it('OR semantics', () => {
    const a = new Set([NO_ESTIMATE_FILTER, '8']);
    expect(matchesStoryPointsFilter(sp(null), a, KEY)).toBe(true);
    expect(matchesStoryPointsFilter(sp(8), a, KEY)).toBe(true);
    expect(matchesStoryPointsFilter(sp(3), a, KEY)).toBe(false);
  });
  it('unparseable value never matches', () => {
    const a = new Set(['abc']);
    expect(matchesStoryPointsFilter(sp(3), a, KEY)).toBe(false);
    expect(matchesStoryPointsFilter(sp(null), a, KEY)).toBe(false);
  });
});
