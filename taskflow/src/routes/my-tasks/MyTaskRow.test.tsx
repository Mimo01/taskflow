/**
 * MyTaskRow regression tests — D-06 key-only strikethrough
 *
 * Asserts that on DONE rows the issue KEY has `line-through` and the SUMMARY
 * does NOT, matching the canonical app-wide doneSummaryClass pattern.
 *
 * Pattern: WikiRenderer.test.tsx lines ~1454-1467 (toHaveClass / not.toHaveClass)
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { MyTaskRow } from './MyTaskRow';

// MyTaskRow calls isIssueFlagged from @/services/jira
vi.mock('@/services/jira', () => ({
  isIssueFlagged: vi.fn().mockReturnValue(false),
}));

// ── Fixture builder ───────────────────────────────────────────────────────────

function makeIssue(
  key: string,
  statusCategoryKey: 'done' | 'indeterminate' | 'new',
  opts: { subtask?: boolean } = {},
): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: {
        id: '1',
        name:
          statusCategoryKey === 'done'
            ? 'Done'
            : statusCategoryKey === 'indeterminate'
              ? 'In Progress'
              : 'To Do',
        statusCategory: { key: statusCategoryKey },
      },
      issuetype: { name: opts.subtask ? 'Subtask' : 'Story', subtask: opts.subtask ?? false },
      priority: { name: 'Medium', iconUrl: '' },
      assignee: null,
      timetracking: undefined,
      customfield_10016: null,
      customfield_10021: null,
      labels: [],
    },
  } as unknown as JiraIssue;
}

// ── Shared props ──────────────────────────────────────────────────────────────

const BASE_PROPS = {
  jiraBaseUrl: 'https://jira.example.com',
  storyPointsFieldKey: 'customfield_10016',
  flaggedFieldKey: 'customfield_10021',
  onOpenPeek: vi.fn(),
  onOpenIssue: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MyTaskRow — D-06 key-only strikethrough', () => {
  it('DONE parent row: key has line-through, summary does NOT', () => {
    const issue = makeIssue('PROJ-1', 'done');

    render(<MyTaskRow issue={issue} {...BASE_PROPS} />);

    // The key button text is the issue key itself
    const keyEl = screen.getByText('PROJ-1');
    // The summary span text is "Summary for PROJ-1"
    const summaryEl = screen.getByText('Summary for PROJ-1');

    expect(keyEl).toHaveClass('line-through');
    expect(summaryEl).not.toHaveClass('line-through');
  });

  it('DONE subtask row: key has line-through, summary does NOT', () => {
    const issue = makeIssue('PROJ-2', 'done', { subtask: true });

    render(<MyTaskRow issue={issue} isSubtask {...BASE_PROPS} />);

    const keyEl = screen.getByText('PROJ-2');
    const summaryEl = screen.getByText('Summary for PROJ-2');

    expect(keyEl).toHaveClass('line-through');
    expect(summaryEl).not.toHaveClass('line-through');
  });

  it('indeterminate (In Progress) parent row: neither key nor summary has line-through', () => {
    const issue = makeIssue('PROJ-3', 'indeterminate');

    render(<MyTaskRow issue={issue} {...BASE_PROPS} />);

    const keyEl = screen.getByText('PROJ-3');
    const summaryEl = screen.getByText('Summary for PROJ-3');

    expect(keyEl).not.toHaveClass('line-through');
    expect(summaryEl).not.toHaveClass('line-through');
  });
});
