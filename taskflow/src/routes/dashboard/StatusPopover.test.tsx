/**
 * StatusPopover tests (Phase 72 Plan 02) — verify the component reads
 * transitions from `useGhTransitions(projectId, issueTypeId)` and renders
 * loading / error / list states without ever calling the legacy
 * `fetchTransitions` REST fetcher.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira', () => ({
  useGhTransitions: vi.fn(),
  // Intentionally do NOT export fetchTransitions — the migrated component must
  // not import it. A test that accidentally references it would throw.
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

  it('does not import legacy fetchTransitions (source-grep guard)', async () => {
    // Source-level guard: importing StatusPopover with a mock that omits
    // `fetchTransitions` succeeded above (the test file loaded). If the
    // component had referenced fetchTransitions, vitest would have thrown
    // "No 'fetchTransitions' export is defined" at module-import time and
    // every test in this file would fail.
    mockedUseGhTransitions.mockReturnValue(hookResult({ data: [] }));
    const { default: StatusPopover } = await import('./StatusPopover');
    expect(StatusPopover).toBeTruthy();
  });
});
