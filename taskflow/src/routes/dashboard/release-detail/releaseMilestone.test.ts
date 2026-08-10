import { describe, expect, it } from 'vitest';
import {
  buildMilestoneTitle,
  findDuplicateMilestone,
  formatMilestoneDueDate,
  isValidMilestoneTitle,
  type MilestoneLike,
  normalizeMilestoneTitle,
  ownProjectMilestones,
  RECENT_MILESTONE_LIMIT,
  recentMilestonesByDate,
} from './releaseMilestone';

function makeMilestone(overrides: Partial<MilestoneLike> = {}): MilestoneLike {
  return {
    title: '33.5.0 (21.07.2026)',
    project_id: 7,
    group_id: null,
    ...overrides,
  };
}

describe('MILESTONE_TITLE_FORMAT', () => {
  it('accepts the real X.Y.Z (DD.MM.YYYY) format', () => {
    expect(isValidMilestoneTitle('33.5.0 (21.07.2026)')).toBe(true);
  });

  it('rejects a bare semver (the documented-but-wrong REQUIREMENTS.md format)', () => {
    expect(isValidMilestoneTitle('1.1.0')).toBe(false);
  });

  it('rejects an ISO-date suffix', () => {
    expect(isValidMilestoneTitle('33.5.0 (2026-07-21)')).toBe(false);
  });

  it('rejects a missing space before the parenthesis', () => {
    expect(isValidMilestoneTitle('33.5.0(21.07.2026)')).toBe(false);
  });

  it('rejects trailing whitespace (anchored regex)', () => {
    expect(isValidMilestoneTitle('33.5.0 (21.07.2026) ')).toBe(false);
  });

  it('rejects leading text', () => {
    expect(isValidMilestoneTitle('Release 33.5.0 (21.07.2026)')).toBe(false);
  });
});

describe('formatMilestoneDueDate', () => {
  it('converts an ISO date to DD.MM.YYYY', () => {
    expect(formatMilestoneDueDate('2026-07-21')).toBe('21.07.2026');
  });

  it('zero-pads single-digit month/day', () => {
    expect(formatMilestoneDueDate('2026-01-05')).toBe('05.01.2026');
  });

  it('returns null for null, undefined, and a non-date string', () => {
    expect(formatMilestoneDueDate(null)).toBeNull();
    expect(formatMilestoneDueDate(undefined)).toBeNull();
    expect(formatMilestoneDueDate('not-a-date')).toBeNull();
  });
});

describe('buildMilestoneTitle', () => {
  it('builds a full title from version + ISO date', () => {
    expect(buildMilestoneTitle('33.5.0', '2026-07-21')).toBe('33.5.0 (21.07.2026)');
  });

  it('returns null when the date cannot be formatted (D-04 makes the date mandatory)', () => {
    expect(buildMilestoneTitle('33.5.0', null)).toBeNull();
  });
});

describe('ownProjectMilestones', () => {
  it('filters to only project_id-matched entries when project_id is present', () => {
    const milestones = [
      makeMilestone({ title: 'own', project_id: 7, group_id: null }),
      makeMilestone({ title: 'inherited', project_id: null, group_id: 3 }),
    ];
    const result = ownProjectMilestones(milestones, 7);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('own');
  });

  it('returns the input unfiltered when no element carries a numeric project_id', () => {
    const milestones = [
      makeMilestone({ title: 'a', project_id: undefined }),
      makeMilestone({ title: 'b', project_id: undefined }),
    ];
    const result = ownProjectMilestones(milestones, 7);
    expect(result).toHaveLength(2);
  });
});

describe('normalizeMilestoneTitle', () => {
  it('trims, collapses internal whitespace runs, and lowercases', () => {
    expect(normalizeMilestoneTitle('  33.5.0   (21.07.2026)  ')).toBe('33.5.0 (21.07.2026)');
  });
});

describe('findDuplicateMilestone', () => {
  it('returns the colliding milestone for an exact-title match', () => {
    const milestones = [makeMilestone({ title: '33.5.0 (21.07.2026)', project_id: 7 })];
    const result = findDuplicateMilestone(milestones, '33.5.0 (21.07.2026)', 7);
    expect(result?.title).toBe('33.5.0 (21.07.2026)');
  });

  it('returns the colliding milestone for a whitespace-variant match', () => {
    const milestones = [makeMilestone({ title: ' 33.5.0  (21.07.2026) ', project_id: 7 })];
    const result = findDuplicateMilestone(milestones, '33.5.0 (21.07.2026)', 7);
    expect(result?.title).toBe(' 33.5.0  (21.07.2026) ');
  });

  it('returns null when no title collides', () => {
    const milestones = [makeMilestone({ title: '33.5.0 (21.07.2026)', project_id: 7 })];
    const result = findDuplicateMilestone(milestones, '33.6.0 (28.07.2026)', 7);
    expect(result).toBeNull();
  });

  it('returns null for a colliding title that belongs to an inherited group milestone (D-06)', () => {
    const milestones = [
      // at least one project-owned entry so the numeric-project_id detection
      // in ownProjectMilestones triggers real filtering (not the "no field
      // present at all" unfiltered fallback)
      makeMilestone({ title: '33.6.0 (28.07.2026)', project_id: 7, group_id: null }),
      makeMilestone({ title: '33.5.0 (21.07.2026)', project_id: null, group_id: 3 }),
    ];
    const result = findDuplicateMilestone(milestones, '33.5.0 (21.07.2026)', 7);
    expect(result).toBeNull();
  });
});

describe('recentMilestonesByDate', () => {
  it('returns the newest milestones first', () => {
    const milestones = [
      makeMilestone({ title: '33.5.0 (21.07.2026)', due_date: '2026-07-21' }),
      makeMilestone({ title: '33.7.0 (11.08.2026)', due_date: '2026-08-11' }),
      makeMilestone({ title: '33.6.0 (04.08.2026)', due_date: '2026-08-04' }),
    ];
    const result = recentMilestonesByDate(milestones);
    expect(result.map((m) => m.title)).toEqual([
      '33.7.0 (11.08.2026)',
      '33.6.0 (04.08.2026)',
      '33.5.0 (21.07.2026)',
    ]);
  });

  it('caps the list at the requested limit', () => {
    const milestones = Array.from({ length: 12 }, (_, i) =>
      makeMilestone({ title: `33.${i}.0`, due_date: `2026-08-${String(i + 1).padStart(2, '0')}` }),
    );
    expect(recentMilestonesByDate(milestones, 5)).toHaveLength(5);
  });

  it('defaults to RECENT_MILESTONE_LIMIT entries', () => {
    const milestones = Array.from({ length: 12 }, (_, i) =>
      makeMilestone({ title: `33.${i}.0`, due_date: `2026-08-${String(i + 1).padStart(2, '0')}` }),
    );
    expect(recentMilestonesByDate(milestones)).toHaveLength(RECENT_MILESTONE_LIMIT);
  });

  it('falls back to start_date when due_date is absent', () => {
    const milestones = [
      makeMilestone({ title: 'older', due_date: null, start_date: '2026-01-01' }),
      makeMilestone({ title: 'newer', due_date: null, start_date: '2026-06-01' }),
    ];
    expect(recentMilestonesByDate(milestones).map((m) => m.title)).toEqual(['newer', 'older']);
  });

  it('sorts undated milestones last rather than dropping them', () => {
    const milestones = [
      makeMilestone({ title: 'undated', due_date: null, start_date: null }),
      makeMilestone({ title: 'dated', due_date: '2026-08-11' }),
    ];
    expect(recentMilestonesByDate(milestones).map((m) => m.title)).toEqual(['dated', 'undated']);
  });

  it('returns an empty list for a non-positive limit', () => {
    const milestones = [makeMilestone({ title: '33.7.0 (11.08.2026)', due_date: '2026-08-11' })];
    expect(recentMilestonesByDate(milestones, 0)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const milestones = [
      makeMilestone({ title: 'a', due_date: '2026-01-01' }),
      makeMilestone({ title: 'b', due_date: '2026-06-01' }),
    ];
    const snapshot = milestones.map((m) => m.title);
    recentMilestonesByDate(milestones);
    expect(milestones.map((m) => m.title)).toEqual(snapshot);
  });
});
