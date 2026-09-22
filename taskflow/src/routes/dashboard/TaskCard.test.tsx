// Phase 77 Nyquist stubs — see 77-VALIDATION.md. Convert it.todo → it() as the covered plan lands.
// Requirements covered: PEEK-05

/**
 * TaskCard tests.
 *
 * Covers:
 *   - PEEK-05 (Phase 77 Plan 04): key/body click split — clicking the issue key
 *     button fires onIssueClick (stopPropagation), clicking the card body fires
 *     onOpenIssue.
 *   - Regression: the card renders with no "entered status" time-in-column chip
 *     (removed quick-260922-e07 — no element carries a title starting with
 *     "Entered status ").
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// lucide-react icons are SVGs — stub for jsdom stability (mirrors SprintBoardTab.test).
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    ChevronDown: () => <span data-testid="chevron-down" />,
    ChevronRight: () => <span data-testid="chevron-right" />,
    Flag: () => <span data-testid="flag-icon" />,
  };
});

import TaskCard from './TaskCard';

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'PROJ-1',
    key: 'PROJ-1',
    fields: {
      summary: 'Sample summary',
      status: {
        id: '10001',
        name: 'In Progress',
        statusCategory: { key: 'indeterminate' },
      },
      assignee: null,
      // Provide a non-null, > 0 story-points value so the story-points chip renders.
      customfield_10016: 5,
      issuetype: { name: 'Story', subtask: false },
      ...overrides,
    },
  } as Parameters<typeof TaskCard>[0]['issue'];
}

describe('TaskCard — no entered-status chip', () => {
  it('does not render an entered-status time chip', () => {
    render(<TaskCard issue={makeIssue()} showStatus />);
    expect(screen.queryByTitle(/^Entered status /)).toBeNull();
  });
});

// Phase 77 — PEEK-05 key/body click split (Plan 04)
describe('TaskCard — PEEK-05 key/body click split (Phase 77 Plan 04)', () => {
  it('PEEK-05: clicking the issue key button calls onIssueClick and NOT onOpenIssue (stopPropagation)', () => {
    const onIssueClick = vi.fn();
    const onOpenIssue = vi.fn();

    render(<TaskCard issue={makeIssue()} onIssueClick={onIssueClick} onOpenIssue={onOpenIssue} />);

    // The key renders as a button when onOpenIssue is provided
    const keyButton = screen.getByRole('button', { name: 'PROJ-1' });
    fireEvent.click(keyButton);

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
    expect(onOpenIssue).not.toHaveBeenCalled();
  });

  it('PEEK-05: clicking the card body calls onOpenIssue with the key, not onIssueClick', () => {
    const onIssueClick = vi.fn();
    const onOpenIssue = vi.fn();

    render(<TaskCard issue={makeIssue()} onIssueClick={onIssueClick} onOpenIssue={onOpenIssue} />);

    // The outer wrapper has role="button" when onOpenIssue is provided
    const cardBody = screen.getByRole('button', { name: /Sample summary/i });
    // Click the summary text (body area), not the key button
    const summaryEl = screen.getByText('Sample summary');
    fireEvent.click(summaryEl);

    expect(onOpenIssue).toHaveBeenCalledWith('PROJ-1');
    expect(onIssueClick).not.toHaveBeenCalled();

    // Silence unused variable lint
    expect(cardBody).toBeTruthy();
  });
});
