/**
 * Unit tests for generateMarkdown() — the Copy-markdown output of the Yesterday
 * recap. Exercises the MR-event grouping in buildGroups() through its only
 * exported surface.
 *
 * Regression focus: comment events must group on the merge-request iid
 * (note.noteable_iid), NOT target_iid (which is the per-comment note id).
 */

import { describe, expect, it, vi } from 'vitest';
import type { GitLabUserMREvent } from '@/services/gitlab';
import type { StandupIssueMeta } from '@/services/jira';
import type { TempoWorklog } from '@/services/tempo';
import { generateMarkdown } from './YesterdayColumn';

const DATE = '2026-05-22';

function commentEvent(noteId: number, mrIid: number, title: string): GitLabUserMREvent {
  return {
    id: noteId,
    action_name: 'commented',
    target_type: 'Note',
    target_id: noteId,
    target_iid: noteId, // GitLab sets this to the NOTE iid for comment events
    target_title: title,
    created_at: `${DATE}T10:00:00.000Z`,
    project_id: 1,
    note: { noteable_type: 'MergeRequest', noteable_iid: mrIid },
  };
}

function approvalEvent(mrIid: number, title: string): GitLabUserMREvent {
  return {
    id: mrIid,
    action_name: 'approved',
    target_type: 'MergeRequest',
    target_id: mrIid,
    target_iid: mrIid, // approvals target the MR directly
    target_title: title,
    created_at: `${DATE}T11:00:00.000Z`,
    project_id: 1,
  };
}

describe('generateMarkdown — MR comment grouping', () => {
  it('collapses many comments on the same MR into one count line', () => {
    // 3 comments, distinct note ids, same MR iid 9000. Title has no Jira key
    // so it routes to a standalone MR group.
    const mrEventsData = [
      commentEvent(101, 9000, 'Refactor cart service'),
      commentEvent(102, 9000, 'Refactor cart service'),
      commentEvent(103, 9000, 'Refactor cart service'),
    ];

    const md = generateMarkdown({ mrEventsData }, DATE);

    expect(md).toContain('3 comments on !9000');
    expect(md).not.toContain('1 comment on !9000');
    // Exactly one comment line for this MR
    expect(md.match(/comments? on !9000/g)).toHaveLength(1);
  });

  it('keeps comments on different MRs as separate lines', () => {
    const mrEventsData = [
      commentEvent(201, 8001, 'MR one'),
      commentEvent(202, 8001, 'MR one'),
      commentEvent(203, 8002, 'MR two'),
    ];

    const md = generateMarkdown({ mrEventsData }, DATE);

    expect(md).toContain('2 comments on !8001');
    expect(md).toContain('1 comment on !8002');
  });

  it('groups comments under the Jira story when the MR title carries a key', () => {
    const mrEventsData = [
      commentEvent(301, 7000, 'ESHOP-42 add coupon validation'),
      commentEvent(302, 7000, 'ESHOP-42 add coupon validation'),
    ];

    const md = generateMarkdown({ mrEventsData }, DATE);

    expect(md).toContain('### ESHOP-42:');
    expect(md).toContain('2 comments on ESHOP-42 add coupon validation');
  });

  it('lists approvals individually and counts comments separately', () => {
    const mrEventsData = [
      approvalEvent(6000, 'Bump deps'),
      commentEvent(401, 6000, 'Bump deps'),
      commentEvent(402, 6000, 'Bump deps'),
    ];

    const md = generateMarkdown({ mrEventsData }, DATE);

    expect(md).toContain('2 comments on !6000');
    expect(md).toContain('Approved !6000');
  });
});

describe('generateMarkdown — parent-story rollup', () => {
  function worklog(key: string, seconds: number, summary: string): TempoWorklog {
    return {
      issue: { key, summary },
      author: { name: 'jdoe' },
      timeSpentSeconds: seconds,
      dateStarted: DATE,
    };
  }

  it('groups a subtask worklog under its parent story but still lists the subtask', () => {
    // Worklog logged on the SUBTASK; MR comment on the STORY (parent).
    const tempoData = [worklog('ESHOP-2', 3600, 'Wire up form')];
    const mrEventsData = [commentEvent(900, 500, 'ESHOP-1 Checkout revamp')];
    const issueMeta: Record<string, StandupIssueMeta> = {
      'ESHOP-2': {
        type: 'Sub-task',
        isSubtask: true,
        summary: 'Wire up form',
        parentKey: 'ESHOP-1',
        parentSummary: 'Checkout revamp',
        parentType: 'Story',
      },
      'ESHOP-1': { type: 'Story', isSubtask: false, summary: 'Checkout revamp' },
    };

    const md = generateMarkdown({ tempoData, mrEventsData, issueMeta }, DATE);

    // One story group headed by the parent, the comment, and the subtask's
    // worklog all together — and no separate ESHOP-2 group heading.
    expect(md).toContain('### ESHOP-1: Checkout revamp');
    expect(md).toContain('1 comment on ESHOP-1 Checkout revamp');
    expect(md).toContain('1h · ESHOP-2 Wire up form');
    expect(md).not.toContain('### ESHOP-2');
  });

  it('falls back to per-issue grouping when no metadata is provided', () => {
    const tempoData = [worklog('ESHOP-2', 3600, 'Wire up form')];
    const mrEventsData = [commentEvent(900, 500, 'ESHOP-1 Checkout revamp')];

    const md = generateMarkdown({ tempoData, mrEventsData }, DATE);

    // Without meta the subtask is not rolled up: story group + a separate
    // subtask group both appear.
    expect(md).toContain('### ESHOP-1: ESHOP-1 Checkout revamp');
    expect(md).toContain('### ESHOP-2: Wire up form');
    expect(md).toContain('1h · ESHOP-2 Wire up form');
  });
});

describe('generateMarkdown — transition collapse', () => {
  function activityItem(
    issueKey: string,
    summary: string,
    transitions: Array<{ fromStatus: string; toStatus: string; at: string }>,
  ) {
    return {
      issueKey,
      summary,
      issueType: 'Story',
      transitions,
      comments: [],
    };
  }

  it('collapses multiple transitions to a single initial → final line', () => {
    const jiraData = [
      activityItem('PROJ-1', 'Build widget', [
        { fromStatus: 'To Do', toStatus: 'In Progress', at: '2026-06-02T09:00:00.000Z' },
        { fromStatus: 'In Progress', toStatus: 'In Review', at: '2026-06-02T11:00:00.000Z' },
        { fromStatus: 'In Review', toStatus: 'Done', at: '2026-06-02T15:00:00.000Z' },
      ]),
    ];

    const md = generateMarkdown({ jiraData }, DATE);

    // Only one transition line
    const transitionLines = md.match(/- .* → .*/g) ?? [];
    expect(transitionLines).toHaveLength(1);
    expect(md).toContain('- To Do → Done');
    // Should NOT contain intermediate transitions as separate lines
    expect(md).not.toContain('- To Do → In Progress');
    expect(md).not.toContain('- In Progress → In Review');
    expect(md).not.toContain('- In Review → Done');
  });

  it('collapses out-of-order array by timestamp, not array order', () => {
    const jiraData = [
      activityItem('PROJ-2', 'Shuffle test', [
        { fromStatus: 'In Review', toStatus: 'Done', at: '2026-06-02T15:00:00.000Z' },
        { fromStatus: 'To Do', toStatus: 'In Progress', at: '2026-06-02T09:00:00.000Z' },
        { fromStatus: 'In Progress', toStatus: 'In Review', at: '2026-06-02T11:00:00.000Z' },
      ]),
    ];

    const md = generateMarkdown({ jiraData }, DATE);

    const transitionLines = md.match(/- .* → .*/g) ?? [];
    expect(transitionLines).toHaveLength(1);
    // earliest fromStatus (09:00) → latest toStatus (15:00)
    expect(md).toContain('- To Do → Done');
  });

  it('leaves a single transition unchanged', () => {
    const jiraData = [
      activityItem('PROJ-3', 'Single step', [
        { fromStatus: 'To Do', toStatus: 'In Progress', at: '2026-06-02T09:00:00.000Z' },
      ]),
    ];

    const md = generateMarkdown({ jiraData }, DATE);

    expect(md).toContain('- To Do → In Progress');
    const transitionLines = md.match(/- .* → .*/g) ?? [];
    expect(transitionLines).toHaveLength(1);
  });

  it('produces no transition line when transitions array is empty', () => {
    const jiraData = [
      {
        issueKey: 'PROJ-4',
        summary: 'No transitions',
        issueType: 'Story',
        transitions: [],
        comments: [{ body: 'A comment here', author: 'user', at: '2026-06-02T10:00:00.000Z' }],
      },
    ];

    const md = generateMarkdown({ jiraData }, DATE);

    // Comment line should still appear
    expect(md).toContain('Comment: "A comment here"');
    // No transition line using → arrow
    expect(md).not.toMatch(/- .* → .*/);
  });
});

describe('generateMarkdown — section header label', () => {
  it('uses "Yesterday" when the date is the calendar day before today', () => {
    // Pin today to a Tuesday so yesterday is Monday 2026-05-25
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T09:00:00Z'));
    const md = generateMarkdown({}, '2026-05-25');
    expect(md).toMatch(/^## Yesterday \(2026-05-25\)/m);
    vi.useRealTimers();
  });

  it('uses the day name when the last working day was not calendar-yesterday (after weekend)', () => {
    // Pin today to a Tuesday (2026-05-26); last working day is Friday (2026-05-22)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T09:00:00Z')); // Tuesday
    const md = generateMarkdown({}, '2026-05-22'); // Friday two days ago
    expect(md).toMatch(/^## Friday \(2026-05-22\)/m);
    expect(md).not.toContain('## Yesterday');
    vi.useRealTimers();
  });
});
