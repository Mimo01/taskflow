import { describe, expect, it } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import {
  buildAssigneeOptions,
  matchesAssigneeFilter,
  UNASSIGNED_FILTER,
  UNASSIGNED_LABEL,
} from './assignee-filter';

const unassigned = { fields: { assignee: null } } as unknown as JiraIssue;
const alice = {
  fields: { assignee: { displayName: 'Alice Smith' } },
} as unknown as JiraIssue;
const bob = {
  fields: { assignee: { displayName: 'Bob Jones' } },
} as unknown as JiraIssue;

describe('assignee-filter constants', () => {
  it('exposes a reserved sentinel string and human label', () => {
    expect(UNASSIGNED_FILTER).toBe('__unassigned__');
    expect(UNASSIGNED_LABEL).toBe('Unassigned');
  });
});

describe('matchesAssigneeFilter', () => {
  it('returns true for any issue when no filter is active', () => {
    expect(matchesAssigneeFilter(unassigned, new Set())).toBe(true);
    expect(matchesAssigneeFilter(alice, new Set())).toBe(true);
  });

  it('matches an unassigned issue when the sentinel is selected', () => {
    expect(matchesAssigneeFilter(unassigned, new Set([UNASSIGNED_FILTER]))).toBe(true);
  });

  it('does not match an assigned issue when only the sentinel is selected', () => {
    expect(matchesAssigneeFilter(alice, new Set([UNASSIGNED_FILTER]))).toBe(false);
  });

  it('matches a named assignee via case-insensitive substring', () => {
    expect(matchesAssigneeFilter(alice, new Set(['alice']))).toBe(true);
    expect(matchesAssigneeFilter(alice, new Set(['SMITH']))).toBe(true);
    expect(matchesAssigneeFilter(bob, new Set(['alice']))).toBe(false);
  });

  it('never matches an unassigned issue via the named substring pass (sentinel excluded)', () => {
    // An empty displayName ('') would substring-match any query under naive logic;
    // the sentinel must be matched strictly via assignee === null, never substring.
    expect(matchesAssigneeFilter(unassigned, new Set(['alice']))).toBe(false);
  });

  it('applies OR semantics across the sentinel and a named assignee', () => {
    const active = new Set([UNASSIGNED_FILTER, 'alice']);
    expect(matchesAssigneeFilter(unassigned, active)).toBe(true);
    expect(matchesAssigneeFilter(alice, active)).toBe(true);
    expect(matchesAssigneeFilter(bob, active)).toBe(false);
  });
});

describe('buildAssigneeOptions', () => {
  it('returns deduped named display names', () => {
    expect(buildAssigneeOptions([alice, bob, alice])).toEqual(['Alice Smith', 'Bob Jones']);
  });

  it('pins the sentinel to the top when at least one issue is unassigned', () => {
    expect(buildAssigneeOptions([alice, unassigned, bob])).toEqual([
      UNASSIGNED_FILTER,
      'Alice Smith',
      'Bob Jones',
    ]);
  });

  it('omits the sentinel when every issue is assigned', () => {
    const opts = buildAssigneeOptions([alice, bob]);
    expect(opts).not.toContain(UNASSIGNED_FILTER);
    expect(opts).toEqual(['Alice Smith', 'Bob Jones']);
  });

  it('returns just the sentinel when all issues are unassigned', () => {
    expect(buildAssigneeOptions([unassigned, unassigned])).toEqual([UNASSIGNED_FILTER]);
  });

  it('never offers a real displayName equal to the reserved sentinel (collision guard)', () => {
    const impostor = {
      fields: { assignee: { displayName: UNASSIGNED_FILTER } },
    } as unknown as JiraIssue;
    expect(buildAssigneeOptions([alice, impostor])).toEqual(['Alice Smith']);
  });
});
