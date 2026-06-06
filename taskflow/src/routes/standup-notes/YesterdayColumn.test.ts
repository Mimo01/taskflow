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

    // One story group headed by the parent.
    expect(md).toContain('### ESHOP-1: Checkout revamp');
    // Story-level MR comment stays flat under the story.
    expect(md).toContain('1 comment on ESHOP-1 Checkout revamp');
    // Subtask worklog label remains unchanged under the sub-task sub-group.
    expect(md).toContain('1h · ESHOP-2 Wire up form');
    // Nested sub-task line (2-space indented): the new assertion for nesting.
    expect(md).toContain('  - ESHOP-2: Wire up form');
    // No separate ESHOP-2 top-level group heading.
    expect(md).not.toContain('### ESHOP-2');
  });

  it('nests a commit attributed to a sub-task under that sub-task', () => {
    // Commit message carries the sub-task key; issueMeta marks it a subtask of the story.
    const commitsData = [
      {
        id: 'abc',
        short_id: 'abc123',
        title: 'ESHOP-3 Wire up checkout button',
        message: 'ESHOP-3 Wire up checkout button\n',
        author_name: 'jdoe',
        author_email: 'jdoe@example.com',
        authored_date: `${DATE}T09:00:00.000Z`,
        web_url: 'https://gitlab.example.com',
      },
    ];
    const issueMeta: Record<string, StandupIssueMeta> = {
      'ESHOP-3': {
        type: 'Sub-task',
        isSubtask: true,
        summary: 'Wire up checkout button',
        parentKey: 'ESHOP-10',
        parentSummary: 'Checkout revamp',
        parentType: 'Story',
      },
      'ESHOP-10': { type: 'Story', isSubtask: false, summary: 'Checkout revamp' },
    };

    const md = generateMarkdown({ commitsData, issueMeta }, DATE);

    // Parent story group heading present.
    expect(md).toContain('### ESHOP-10: Checkout revamp');
    // Nested sub-task header line.
    expect(md).toContain('  - ESHOP-3: Wire up checkout button');
    // Commit count nested under the sub-task (4-space indented).
    expect(md).toContain('    - 1 commit');
    // No flat "1 commit" at story level (must appear only under the sub-task).
    const lines = md.split('\n');
    const flatCommitLine = lines.find((l) => l === '- 1 commit');
    expect(flatCommitLine).toBeUndefined();
    // No separate sub-task group heading.
    expect(md).not.toContain('### ESHOP-3');
  });

  it('nests an MR-comment attributed to a sub-task under that sub-task', () => {
    // MR comment on an MR whose title carries the sub-task key.
    const mrEventsData = [commentEvent(501, 2000, 'ESHOP-5 Add address form')];
    const issueMeta: Record<string, StandupIssueMeta> = {
      'ESHOP-5': {
        type: 'Sub-task',
        isSubtask: true,
        summary: 'Add address form',
        parentKey: 'ESHOP-20',
        parentSummary: 'User checkout flow',
        parentType: 'Story',
      },
      'ESHOP-20': { type: 'Story', isSubtask: false, summary: 'User checkout flow' },
    };

    const md = generateMarkdown({ mrEventsData, issueMeta }, DATE);

    // Parent story group heading present.
    expect(md).toContain('### ESHOP-20: User checkout flow');
    // Nested sub-task header line (2-space indented).
    expect(md).toContain('  - ESHOP-5: Add address form');
    // MR comment nested under the sub-task (4-space indented).
    expect(md).toContain('    - 1 comment on ESHOP-5 Add address form');
    // No flat comment at story level.
    const lines = md.split('\n');
    const flatCommentLine = lines.find((l) => l === '- 1 comment on ESHOP-5 Add address form');
    expect(flatCommentLine).toBeUndefined();
    // No separate sub-task group heading.
    expect(md).not.toContain('### ESHOP-5');
  });

  it('produces no nested sub-task block for a story with only story-level activity', () => {
    // Story worklog with no sub-task meta — should look identical to before nesting.
    const tempoData = [worklog('PROJ-7', 1800, 'Planning session')];
    const issueMeta: Record<string, StandupIssueMeta> = {
      'PROJ-7': { type: 'Story', isSubtask: false, summary: 'Planning session' },
    };

    const md = generateMarkdown({ tempoData, issueMeta }, DATE);

    expect(md).toContain('### PROJ-7: Planning session');
    expect(md).toContain('- 30m · PROJ-7 Planning session');
    // No two-space-indented nested block should appear (regression guard).
    const nestedLines = md.split('\n').filter((l) => l.startsWith('  - '));
    expect(nestedLines).toHaveLength(0);
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
    // Pin today to a Tuesday so yesterday is Monday 2026-05-25.
    // Construct with LOCAL components (not a UTC instant) so the assertion holds
    // in any runner timezone — getColumnHeading reads local calendar getters.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 26, 12, 0, 0));
    const md = generateMarkdown({}, '2026-05-25');
    expect(md).toMatch(/^## Yesterday \(2026-05-25\)/m);
    vi.useRealTimers();
  });

  it('uses the day name when the last working day was not calendar-yesterday (after weekend)', () => {
    // Pin today to a Tuesday (2026-05-26); last working day is Friday (2026-05-22).
    // Local-component construction keeps this TZ-independent (see note above).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 26, 12, 0, 0)); // Tuesday
    const md = generateMarkdown({}, '2026-05-22'); // Friday two days ago
    expect(md).toMatch(/^## Friday \(2026-05-22\)/m);
    expect(md).not.toContain('## Yesterday');
    vi.useRealTimers();
  });
});
