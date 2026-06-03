// Phase 77 Nyquist stubs — see 77-VALIDATION.md. Convert it.todo → it() as the covered plan lands.
// Requirements covered: PEEK-05

/**
 * TaskCard tests — Phase 73 Plan 02 (timeInColumn badge slot).
 *
 * Covers the new `timeInColumn` prop (UI-SPEC §1 / D-05 / R-03):
 *   - Absent prop → no badge rendered (no element with title prefix "Entered status").
 *   - Present prop → a small muted badge appears with strict text (/^\d+[smhd]$/)
 *     and a `title` attribute starting with "Entered status ".
 *   - Badge sits inside the existing shrink-0 row, AFTER the story-points chip
 *     and BEFORE the showStatus badge.
 *
 * The story-points chip and showStatus badge ship `text-[11px] ... bg-muted ...`
 * classes too, so we identify the timeInColumn badge specifically via its
 * `title` attribute (no other element on the card carries `title="Entered status …"`).
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      // Provide a non-null, > 0 story-points value so the chip renders — this
      // is what we DOM-order the timeInColumn badge against.
      customfield_10016: 5,
      issuetype: { name: 'Story', subtask: false },
      ...overrides,
    },
  } as Parameters<typeof TaskCard>[0]['issue'];
}

describe('TaskCard — timeInColumn badge slot (Phase 73 Plan 02)', () => {
  // Pin a deterministic "now" so formatTimeAgoStrict / formatTimeAgo are
  // reproducible without flake on slow CI runs.
  const FIXED_NOW = new Date('2026-05-29T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render the timeInColumn badge when the prop is undefined', () => {
    render(<TaskCard issue={makeIssue()} />);
    // No element on the card should expose a title starting with "Entered status".
    expect(screen.queryByTitle(/^Entered status /)).toBeNull();
  });

  it('renders the badge with strict text + title when timeInColumn.enteredStatus is present', () => {
    // 1d 1h ago — strict text should round to "1d", title should mention days/hours.
    const enteredStatus = FIXED_NOW - 90_000_000; // ~1.04 days
    render(<TaskCard issue={makeIssue()} timeInColumn={{ enteredStatus }} />);

    const badge = screen.getByTitle(/^Entered status /);
    expect(badge).toBeTruthy();
    // Strict text format: small integer + s|m|h|d (per formatTimeAgoStrict contract).
    expect(badge.textContent ?? '').toMatch(/^\d+[smhd]$/);
    // UI-SPEC §1 className contract — muted chip styling, matches story-points chip.
    expect(badge.className).toContain('text-[11px]');
    expect(badge.className).toContain('bg-muted');
  });

  it('DOM-orders the badge after the story-points chip and before showStatus', () => {
    const enteredStatus = FIXED_NOW - 5 * 60_000; // 5 minutes
    const { container } = render(
      <TaskCard issue={makeIssue()} timeInColumn={{ enteredStatus }} showStatus />,
    );

    // The shrink-0 row holds story-points + timeInColumn + status. Locate it
    // via the timeInColumn badge (the only element on the card carrying a
    // title that starts with "Entered status ").
    const badge = screen.getByTitle(/^Entered status /);
    const row = badge.parentElement as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.className).toContain('shrink-0');

    const children = within(row)
      .getAllByText(/.*/)
      .filter((el) => el.parentElement === row);
    // Look for the story-points chip (text content === "5"), the timeInColumn
    // badge (its textContent matches \d+[smhd]), and the status badge ("In
    // Progress"). Assert relative order via Node.compareDocumentPosition.
    const storyPointsChip = Array.from(row.children).find((n) => n.textContent === '5') as
      | HTMLElement
      | undefined;
    const statusBadge = Array.from(row.children).find((n) => n.textContent === 'In Progress') as
      | HTMLElement
      | undefined;

    if (!storyPointsChip || !statusBadge) throw new Error('row children missing');
    expect(children.length).toBeGreaterThanOrEqual(3);

    // story-points chip precedes the timeInColumn badge
    expect(
      storyPointsChip.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // timeInColumn badge precedes the status badge
    expect(
      badge.compareDocumentPosition(statusBadge) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Silence "unused container" lint:
    expect(container).toBeTruthy();
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
