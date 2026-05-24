/**
 * Unit tests for generateMarkdown() — the Copy-markdown output of the Yesterday
 * recap. Exercises the MR-event grouping in buildGroups() through its only
 * exported surface.
 *
 * Regression focus: comment events must group on the merge-request iid
 * (note.noteable_iid), NOT target_iid (which is the per-comment note id).
 */

import { describe, expect, it } from 'vitest';
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
    expect(md).toContain('1.0h · ESHOP-2 Wire up form');
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
    expect(md).toContain('1.0h · ESHOP-2 Wire up form');
  });
});
