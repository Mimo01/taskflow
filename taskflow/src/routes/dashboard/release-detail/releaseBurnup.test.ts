import { describe, expect, it } from 'vitest';
import type { JiraFixVersion, JiraIssue } from '@/services/jira';
import {
  type BurnupAxis,
  deriveReleaseBurnup,
  previousVersion,
  releaseBurnupAxis,
} from './releaseBurnup';
import { computeIssueStatusCounts } from './releaseSummaries';

const SP = 'customfield_10016';

function ver(id: string, releaseDate?: string, released = false): JiraFixVersion {
  return { id, name: `Release ${id}`, releaseDate, released };
}

function issue(
  n: number,
  cat: 'new' | 'indeterminate' | 'done',
  created?: string,
  resolutiondate?: string | null,
  sp?: number,
): JiraIssue {
  return {
    id: String(n),
    key: `PROJ-${n}`,
    fields: {
      summary: 'x',
      status: { id: '1', name: 'S', statusCategory: { key: cat } },
      created,
      resolutiondate,
      ...(sp !== undefined ? { [SP]: sp } : {}),
    },
  } as unknown as JiraIssue;
}

describe('previousVersion', () => {
  const all = [
    ver('1', '2026-01-10'),
    ver('2', '2026-02-10', true),
    ver('3', '2026-03-10'),
    ver('4', '2026-03-10'),
    ver('5'),
  ];
  it('picks the max strictly earlier dated version, released or not', () => {
    expect(previousVersion(all, all[2])?.id).toBe('2');
    expect(previousVersion(all, all[1])?.id).toBe('1');
  });
  it('ignores same-date siblings and itself', () => {
    expect(previousVersion(all, all[3])?.id).toBe('2');
  });
  it('returns null when undated or no earlier version', () => {
    expect(previousVersion(all, all[4])).toBeNull();
    expect(previousVersion(all, all[0])).toBeNull();
    expect(previousVersion(undefined, all[0])).toBeNull();
  });
});

describe('releaseBurnupAxis', () => {
  const prev = ver('p', '2026-01-01', true);
  const today = '2026-01-20';
  it('released past: ends at release date, no TODAY', () => {
    const a = releaseBurnupAxis({
      version: ver('a', '2026-01-10', true),
      previous: prev,
      issues: [],
      today,
    });
    expect(a).toMatchObject({
      start: '2026-01-01',
      end: '2026-01-10',
      seriesEnd: '2026-01-10',
      showToday: false,
      showRelease: true,
      previousName: 'Release p',
    });
  });
  it('future: TODAY inside, RELEASE at end', () => {
    const a = releaseBurnupAxis({
      version: ver('a', '2026-02-01'),
      previous: prev,
      issues: [],
      today,
    });
    expect(a).toMatchObject({
      end: '2026-02-01',
      seriesEnd: today,
      showToday: true,
      showRelease: true,
    });
  });
  it('overdue: ends today, RELEASE before TODAY', () => {
    const a = releaseBurnupAxis({
      version: ver('a', '2026-01-10'),
      previous: prev,
      issues: [],
      today,
    });
    expect(a).toMatchObject({ end: today, showToday: true, showRelease: true });
  });
  it('undated: ends today, no RELEASE', () => {
    const a = releaseBurnupAxis({ version: ver('a'), previous: prev, issues: [], today });
    expect(a).toMatchObject({ end: today, showToday: true, showRelease: false, releaseDate: null });
  });
  it('falls back to earliest created day, null when none', () => {
    const issues = [issue(1, 'new', '2026-01-05T10:00:00.000+0100'), issue(2, 'new', '2026-01-03')];
    expect(releaseBurnupAxis({ version: ver('a'), previous: null, issues, today })?.start).toBe(
      '2026-01-03',
    );
    expect(releaseBurnupAxis({ version: ver('a'), previous: null, issues: [], today })).toBeNull();
    expect(
      releaseBurnupAxis({
        version: ver('a'),
        previous: null,
        issues: [issue(1, 'new', 'garbage')],
        today,
      }),
    ).toBeNull();
  });
});

describe('deriveReleaseBurnup', () => {
  const axis: BurnupAxis = {
    start: '2026-01-01',
    end: '2026-01-05',
    seriesEnd: '2026-01-05',
    previousName: null,
    releaseDate: '2026-01-05',
    showToday: false,
    showRelease: true,
  };
  it('builds one point per day with clamped scope and done', () => {
    const pts = deriveReleaseBurnup(
      [
        issue(1, 'done', '2025-12-01', '2026-01-02', 3),
        issue(2, 'new', '2026-01-03'),
        issue(3, 'done', '2026-01-02', '2026-02-01', 2),
      ],
      axis,
      SP,
    );
    expect(pts.map((p) => p.day)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
    ]);
    expect(pts.map((p) => p.scope)).toEqual([1, 2, 3, 3, 3]);
    expect(pts.map((p) => p.done)).toEqual([0, 1, 1, 1, 2]);
    expect(pts.map((p) => p.doneSp)).toEqual([0, 3, 3, 3, 5]);
    expect(pts[0].t).toBe(Date.UTC(2026, 0, 1));
  });
  it('D-16: done without resolutiondate counts on the last day', () => {
    const pts = deriveReleaseBurnup([issue(1, 'done', '2026-01-01', null)], axis, SP);
    expect(pts.map((p) => p.done)).toEqual([0, 0, 0, 0, 1]);
  });
  it('reopened issue with stale resolutiondate is never done', () => {
    const pts = deriveReleaseBurnup(
      [issue(1, 'indeterminate', '2026-01-01', '2026-01-02')],
      axis,
      SP,
    );
    expect(pts[pts.length - 1]?.done).toBe(0);
  });
  it('empty issues and empty/single-day axes', () => {
    expect(deriveReleaseBurnup([], axis, SP).every((p) => p.scope === 0 && p.done === 0)).toBe(
      true,
    );
    expect(deriveReleaseBurnup([], { ...axis, seriesEnd: '2025-12-31' }, SP)).toEqual([]);
    expect(deriveReleaseBurnup([], { ...axis, seriesEnd: '2026-01-01' }, SP)).toHaveLength(1);
  });
  it('invariant: last point equals header counts for every axis state', () => {
    const issues = [
      issue(1, 'done', '2025-12-20', '2026-01-02'),
      issue(2, 'done', '2026-01-03', null),
      issue(3, 'done', '2026-01-04', '2026-03-01'),
      issue(4, 'indeterminate', '2026-01-02', '2026-01-03'),
      issue(5, 'new'),
    ];
    const prev = ver('p', '2026-01-01', true);
    const today = '2026-01-20';
    const versions = [
      ver('released', '2026-01-10', true),
      ver('future', '2026-02-01'),
      ver('overdue', '2026-01-10'),
      ver('undated'),
    ];
    for (const version of versions) {
      const a = releaseBurnupAxis({ version, previous: prev, issues, today });
      expect(a).not.toBeNull();
      const pts = deriveReleaseBurnup(issues, a as BurnupAxis, SP);
      const last = pts[pts.length - 1];
      expect(last?.done, version.id).toBe(computeIssueStatusCounts(issues).done);
      expect(last?.scope, version.id).toBe(issues.length);
    }
  });
});
