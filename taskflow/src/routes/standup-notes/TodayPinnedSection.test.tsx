/**
 * TodayPinnedSection tests — STAND-08
 *
 * Tests:
 *   1. A key present in pinnedCycleMeta renders an AIO cycle row (cycle name visible)
 *   2. A key NOT in pinnedCycleMeta renders a Jira issue row (summary visible)
 *   3. No pin/unpin/remove control elements rendered (D-08: read-only)
 *   4. AIO row click triggers onCycleClick (not onIssueClick)
 *   5. Jira row click triggers onIssueClick
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StandupIssueMeta } from '@/services/jira';
import TodayPinnedSection from './TodayPinnedSection';

// ─── Fixture data ─────────────────────────────────────────────────────────────

const JIRA_KEY = 'PROJ-1';
const CYCLE_KEY = 'PROJ-CY-9';

const pinnedCycleMeta: Record<string, { name: string; projectKey: string }> = {
  [CYCLE_KEY]: { name: 'Sprint Cycle 9', projectKey: 'PROJ' },
};

const pinnedMeta: Record<string, StandupIssueMeta> = {
  [JIRA_KEY]: { type: 'Story', summary: 'My pinned Jira issue' },
};

// ─── Base props ───────────────────────────────────────────────────────────────

const BASE_PROPS = {
  pinnedJiraKeys: [JIRA_KEY],
  pinnedCycleKeys: [CYCLE_KEY],
  pinnedCycleMeta,
  pinnedMeta,
  isLoading: false,
  isError: false,
  error: null,
  onRetry: vi.fn(),
  onIssueClick: vi.fn(),
  onCycleClick: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodayPinnedSection — STAND-08', () => {
  it('renders an AIO cycle row for a key present in pinnedCycleMeta', () => {
    render(<TodayPinnedSection {...BASE_PROPS} />);

    // The cycle name must be visible
    expect(screen.getByText('Sprint Cycle 9')).toBeInTheDocument();
    // The projectKey is shown in mono span
    expect(screen.getByText('PROJ')).toBeInTheDocument();
  });

  it('renders a Jira issue row for a key NOT in pinnedCycleMeta', () => {
    render(<TodayPinnedSection {...BASE_PROPS} />);

    // The issue summary must be visible
    expect(screen.getByText('My pinned Jira issue')).toBeInTheDocument();
    // The issue key is shown in mono span
    expect(screen.getByText(JIRA_KEY)).toBeInTheDocument();
  });

  it('does NOT render any pin/unpin/remove controls (D-08: read-only)', () => {
    render(<TodayPinnedSection {...BASE_PROPS} />);

    // No button or element referencing pin/unpin/remove actions
    expect(screen.queryByRole('button', { name: /unpin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/unpin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remove pin/i)).not.toBeInTheDocument();
  });

  it('calls onCycleClick (not onIssueClick) when an AIO cycle row is clicked', async () => {
    const onIssueClick = vi.fn();
    const onCycleClick = vi.fn();

    render(
      <TodayPinnedSection
        {...BASE_PROPS}
        pinnedJiraKeys={[]}
        pinnedCycleKeys={[CYCLE_KEY]}
        onIssueClick={onIssueClick}
        onCycleClick={onCycleClick}
      />,
    );

    await userEvent.click(screen.getByText('Sprint Cycle 9'));

    expect(onCycleClick).toHaveBeenCalledWith(CYCLE_KEY);
    expect(onIssueClick).not.toHaveBeenCalled();
  });

  it('calls onIssueClick (not onCycleClick) when a Jira issue row is clicked', async () => {
    const onIssueClick = vi.fn();
    const onCycleClick = vi.fn();

    render(
      <TodayPinnedSection
        {...BASE_PROPS}
        pinnedJiraKeys={[JIRA_KEY]}
        pinnedCycleKeys={[]}
        onIssueClick={onIssueClick}
        onCycleClick={onCycleClick}
      />,
    );

    await userEvent.click(screen.getByText('My pinned Jira issue'));

    expect(onIssueClick).toHaveBeenCalledWith(JIRA_KEY);
    expect(onCycleClick).not.toHaveBeenCalled();
  });

  it('returns null (no PINNED header) when both key lists are empty', () => {
    const { container } = render(
      <TodayPinnedSection
        {...BASE_PROPS}
        pinnedJiraKeys={[]}
        pinnedCycleKeys={[]}
      />,
    );

    expect(screen.queryByText('PINNED')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});
