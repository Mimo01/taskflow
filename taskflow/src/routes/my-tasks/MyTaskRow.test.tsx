/**
 * MyTaskRow regression tests — D-06 key-only strikethrough
 *
 * Asserts that on DONE rows the issue KEY has `line-through` and the SUMMARY
 * does NOT, matching the canonical app-wide doneSummaryClass pattern.
 *
 * Pattern: WikiRenderer.test.tsx lines ~1454-1467 (toHaveClass / not.toHaveClass)
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '@/services/jira';
import { isIssueFlagged } from '@/services/jira';
import { usePeekStore } from '@/stores/peek.store';
import { MyTaskRow } from './MyTaskRow';

// MyTaskRow calls isIssueFlagged from @/services/jira
vi.mock('@/services/jira', () => ({
  isIssueFlagged: vi.fn().mockReturnValue(false),
}));

// ── Fixture builder ───────────────────────────────────────────────────────────

function makeIssue(
  key: string,
  statusCategoryKey: 'done' | 'indeterminate' | 'new',
  opts: {
    subtask?: boolean;
    labels?: string[];
    timetracking?: Record<string, number>;
  } = {},
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
      timetracking: opts.timetracking,
      customfield_10016: null,
      customfield_10021: null,
      labels: opts.labels ?? [],
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

describe('MyTaskRow — peek highlight', () => {
  beforeEach(() => {
    usePeekStore.setState({ peekIssueKey: null });
  });

  it('parent row has data-peeked when its key is peeked; siblings do not', () => {
    usePeekStore.setState({ peekIssueKey: 'PROJ-1' });
    render(
      <>
        <MyTaskRow issue={makeIssue('PROJ-1', 'new')} {...BASE_PROPS} />
        <MyTaskRow issue={makeIssue('PROJ-2', 'new')} {...BASE_PROPS} />
      </>,
    );
    expect(screen.getByTestId('my-task-row-PROJ-1')).toHaveAttribute('data-peeked', 'true');
    expect(screen.getByTestId('my-task-row-PROJ-2')).not.toHaveAttribute('data-peeked');
  });

  it('subtask row has data-peeked when its key is peeked', () => {
    usePeekStore.setState({ peekIssueKey: 'PROJ-3' });
    render(
      <>
        <MyTaskRow
          issue={makeIssue('PROJ-3', 'new', { subtask: true })}
          isSubtask
          {...BASE_PROPS}
        />
        <MyTaskRow
          issue={makeIssue('PROJ-4', 'new', { subtask: true })}
          isSubtask
          {...BASE_PROPS}
        />
      </>,
    );
    expect(screen.getByTestId('my-task-row-PROJ-3')).toHaveAttribute('data-peeked', 'true');
    expect(screen.getByTestId('my-task-row-PROJ-4')).not.toHaveAttribute('data-peeked');
  });
});

describe('MyTaskRow — responsive container tiers', () => {
  it('SP slot hides below 1024px on parent and subtask rows', () => {
    const { unmount } = render(<MyTaskRow issue={makeIssue('PROJ-1', 'new')} {...BASE_PROPS} />);
    expect(screen.getByTestId('my-task-sp-slot')).toHaveClass('@max-[1024px]:hidden');
    unmount();
    render(
      <MyTaskRow issue={makeIssue('PROJ-2', 'new', { subtask: true })} isSubtask {...BASE_PROPS} />,
    );
    expect(screen.getByTestId('my-task-sp-slot')).toHaveClass('@max-[1024px]:hidden');
  });

  it('label chips and the +N chip hide below 1024px', () => {
    const issue = makeIssue('PROJ-3', 'new', { labels: ['alpha', 'beta', 'gamma'] });
    const { container } = render(<MyTaskRow issue={issue} {...BASE_PROPS} />);
    const chips = container.querySelectorAll('[data-chip="label"]');
    expect(chips).toHaveLength(3);
    for (const chip of chips) expect(chip).toHaveClass('@max-[1024px]:hidden');
    expect(screen.getByText('+1').closest('[data-chip="label"]')).not.toBeNull();
  });

  it.each([
    ['empty spacer', undefined],
    ['filled bar', { timeSpentSeconds: 3600, originalEstimateSeconds: 7200 }],
  ])('time bar (%s) narrows below 720px and hides below 580px', (_name, timetracking) => {
    render(<MyTaskRow issue={makeIssue('PROJ-4', 'new', { timetracking })} {...BASE_PROPS} />);
    const bar = screen.getByTestId('my-task-time-bar');
    expect(bar).toHaveClass('w-[144px]', '@max-[720px]:w-24', '@max-[580px]:hidden');
    expect(bar).not.toHaveAttribute('style');
  });

  it('LEFT region is overflow-hidden on parent and subtask rows', () => {
    const { unmount } = render(<MyTaskRow issue={makeIssue('PROJ-5', 'new')} {...BASE_PROPS} />);
    expect(screen.getByTestId('my-task-left')).toHaveClass('overflow-hidden');
    unmount();
    render(
      <MyTaskRow issue={makeIssue('PROJ-6', 'new', { subtask: true })} isSubtask {...BASE_PROPS} />,
    );
    expect(screen.getByTestId('my-task-left')).toHaveClass('overflow-hidden');
  });
});

describe('MyTaskRow — icon-only chips at narrow widths', () => {
  it('Flagged chip text is sr-only below 860px with aria-label + title', () => {
    vi.mocked(isIssueFlagged).mockReturnValueOnce(true);
    render(<MyTaskRow issue={makeIssue('PROJ-7', 'new')} {...BASE_PROPS} />);
    const text = screen.getByText('Flagged');
    expect(text).toHaveClass('@max-[860px]:sr-only');
    const chip = text.parentElement;
    expect(chip).toHaveAttribute('aria-label', 'Flagged');
    expect(chip).toHaveAttribute('title', 'Flagged');
    expect(chip?.querySelector('svg')).not.toHaveClass('hidden');
  });

  it.each([
    ['approved', 'Approved'],
    ['changes_requested', 'Changes requested'],
    ['waiting_for_review', 'Awaiting review'],
  ] as const)('MR chip %s is icon-only below 860px with accessible name', (health, label) => {
    render(<MyTaskRow issue={makeIssue('PROJ-8', 'new')} mrHealth={health} {...BASE_PROPS} />);
    const text = screen.getByText(label);
    expect(text).toHaveClass('@max-[860px]:sr-only');
    expect(text.parentElement).toHaveAttribute('aria-label', `MR: ${label}`);
    expect(text.parentElement).toHaveAttribute('title', `MR: ${label}`);
  });
});
