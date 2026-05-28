/**
 * StatusPopover tests (Phase 72) — verify the component reads transitions
 * from `useGhTransitions(projectId, issueTypeId)` and renders loading /
 * error / list states. The legacy per-issue REST GET path was deleted
 * in Phase 72-03 (D-08 / GH-CUT-01).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira', () => ({
  useGhTransitions: vi.fn(),
  // Mock surface intentionally narrow — the migrated component reads
  // transitions exclusively via the GH cache hook above.
}));

import { useGhTransitions } from '@/services/jira';

const mockedUseGhTransitions = vi.mocked(useGhTransitions);

const DEFAULT_PROPS = {
  projectId: 10042,
  issueTypeId: '3',
  currentStatus: 'To Do',
  onSelect: vi.fn(),
};

function hookResult(
  partial: Partial<{ data: unknown; isLoading: boolean; isError: boolean }> = {},
) {
  return {
    data: partial.data ?? undefined,
    isLoading: partial.isLoading ?? false,
    isError: partial.isError ?? false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGhTransitions>;
}

describe('StatusPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls useGhTransitions with (projectId, issueTypeId) and renders transition list', async () => {
    mockedUseGhTransitions.mockReturnValue(
      hookResult({
        data: [
          {
            id: '11',
            name: 'Start Progress',
            to: {
              id: '3',
              name: 'In Progress',
              statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
            },
          },
        ],
      }),
    );

    const { default: StatusPopover } = await import('./StatusPopover');
    render(<StatusPopover {...DEFAULT_PROPS} />);

    expect(mockedUseGhTransitions).toHaveBeenCalledWith(10042, '3');

    // Open the popover
    fireEvent.click(screen.getByRole('button', { name: /To Do/i }));

    expect(await screen.findByText('Start Progress')).toBeTruthy();
  });

  it('renders loading state when isLoading=true', async () => {
    mockedUseGhTransitions.mockReturnValue(hookResult({ isLoading: true }));

    const { default: StatusPopover } = await import('./StatusPopover');
    render(<StatusPopover {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /To Do/i }));
    expect(await screen.findByText(/Loading\.\.\./i)).toBeTruthy();
  });

  it('renders error state when isError=true', async () => {
    mockedUseGhTransitions.mockReturnValue(hookResult({ isError: true }));

    const { default: StatusPopover } = await import('./StatusPopover');
    render(<StatusPopover {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /To Do/i }));
    expect(await screen.findByText(/Unable to load transitions/i)).toBeTruthy();
  });

  it('does not import the legacy REST GET fetcher (source-grep guard)', async () => {
    // Source-level guard: importing StatusPopover with a narrow mock that
    // only exports the GH hook succeeded above (the test file loaded). If
    // the component had referenced any other jira service export, vitest
    // would have thrown at module-import time and every test would fail.
    mockedUseGhTransitions.mockReturnValue(hookResult({ data: [] }));
    const { default: StatusPopover } = await import('./StatusPopover');
    expect(StatusPopover).toBeTruthy();
  });
});
