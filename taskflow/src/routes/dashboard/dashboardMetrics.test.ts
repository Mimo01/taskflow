/**
 * dashboardMetrics.test.ts — Phase 86 survivors only
 *
 * Tests for the two surviving exports: filterNonSubtasks and formatHoursMinutes.
 * All other tests (computeSpDone, computeSpTotal, computePersonalTileCounts,
 * getDaysRemaining, buildWeekBuckets, mergeActivityEntries, computeDonutData,
 * computePersonalVelocitySeries, parseBurndownChanges, buildIdealGuideline) removed
 * in Phase 86 alongside their source functions (D-01 clean slate).
 */
import { describe, expect, it } from 'vitest';

import { filterNonSubtasks, formatHoursMinutes } from './dashboardMetrics';
import type { JiraIssue } from '@/services/jira';

const SP_KEY = 'customfield_10016';

/**
 * Minimal JiraIssue factory.
 */
function makeIssue(overrides: {
  subtask: boolean;
  sp?: number;
  statusCategory?: 'new' | 'indeterminate' | 'done';
  assignee?: string | null;
}): JiraIssue {
  return {
    id: '1',
    key: 'TEST-1',
    fields: {
      summary: 'Test issue',
      status: {
        id: '1',
        name: 'Status',
        statusCategory: { key: overrides.statusCategory ?? 'new' },
      },
      assignee:
        overrides.assignee === undefined
          ? null
          : overrides.assignee === null
            ? null
            : {
                displayName: overrides.assignee,
                accountId: 'acc-1',
                emailAddress: '',
                avatarUrl: '',
              },
      issuetype: {
        id: '10001',
        name: overrides.subtask ? 'Sub-task' : 'Story',
        subtask: overrides.subtask,
      },
      duedate: null,
      [SP_KEY]: overrides.sp ?? 0,
    },
  } as unknown as JiraIssue;
}

// ---------------------------------------------------------------------------
// filterNonSubtasks
// ---------------------------------------------------------------------------

describe('filterNonSubtasks', () => {
  it('drops every issue where issuetype.subtask is true', () => {
    const parent = makeIssue({ subtask: false, sp: 5 });
    const sub = makeIssue({ subtask: true, sp: 2 });
    expect(filterNonSubtasks([parent, sub])).toHaveLength(1);
    expect(filterNonSubtasks([parent, sub])[0]).toBe(parent);
  });

  it('returns all issues when none are subtasks', () => {
    const a = makeIssue({ subtask: false });
    const b = makeIssue({ subtask: false });
    expect(filterNonSubtasks([a, b])).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(filterNonSubtasks([])).toHaveLength(0);
  });

  it('filters out all subtasks when all are subtasks', () => {
    const sub1 = makeIssue({ subtask: true });
    const sub2 = makeIssue({ subtask: true });
    expect(filterNonSubtasks([sub1, sub2])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatHoursMinutes — burndown hours formatter (Probe C: timeestimate unit)
// ---------------------------------------------------------------------------

describe('formatHoursMinutes', () => {
  it('formats 1.5h as "1h 30m"', () => {
    expect(formatHoursMinutes(1.5)).toBe('1h 30m');
  });

  it('formats 8h as "8h" (no minutes when 0)', () => {
    expect(formatHoursMinutes(8)).toBe('8h');
  });

  it('formats 0.25h as "15m"', () => {
    expect(formatHoursMinutes(0.25)).toBe('15m');
  });

  it('burndown hours formatter emits an h/m suffix, never SP', () => {
    expect(formatHoursMinutes(8)).not.toMatch(/SP/);
  });

  it('formats 0h as "0m"', () => {
    expect(formatHoursMinutes(0)).toBe('0m');
  });

  it('rounds to the nearest minute', () => {
    // 1.5083... hours = 1h 30.5m → rounds to 1h 31m
    expect(formatHoursMinutes(1 + 30.5 / 60)).toBe('1h 31m');
  });
});
