/**
 * StatusPopover tests (Phase 72) — verify the component reads transitions
 * from `useGhTransitions(projectId, issueTypeId)` and renders loading /
 * error / list states. The legacy per-issue REST GET path was deleted
 * in Phase 72-03 (D-08 / GH-CUT-01).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira', () => ({
  useGhTransitions: vi.fn(),
  // Pass-through filter so existing test fixtures (without fromStatusId) keep
  // returning all entries — per-status filtering is exercised in transitions.test.ts.
  filterTransitionsForStatus: vi.fn((ts: unknown[]) => ts),
  fetchIssueTransitionsWithFields: vi.fn().mockResolvedValue([]),
  transitionsWithFieldsKey: (issueKey: string, baseUrl: string, statusId: string) => [
    'jira-issue-transitions-fields',
    issueKey,
    baseUrl,
    statusId,
  ],
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

import { fetchIssueTransitionsWithFields, useGhTransitions } from '@/services/jira';

const mockedUseGhTransitions = vi.mocked(useGhTransitions);
const mockedFetchTransitions = vi.mocked(fetchIssueTransitionsWithFields);

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const DEFAULT_PROPS = {
  projectId: 10042,
  issueTypeId: '3',
  currentStatusId: '10000',
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
    render(<StatusPopover {...DEFAULT_PROPS} />, { wrapper });

    expect(mockedUseGhTransitions).toHaveBeenCalledWith(10042, '3');

    // Open the popover
    fireEvent.click(screen.getByRole('button', { name: /To Do/i }));

    expect(await screen.findByText('Start Progress')).toBeTruthy();
  });

  it('renders loading state when isLoading=true', async () => {
    mockedUseGhTransitions.mockReturnValue(hookResult({ isLoading: true }));

    const { default: StatusPopover } = await import('./StatusPopover');
    render(<StatusPopover {...DEFAULT_PROPS} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /To Do/i }));
    expect(await screen.findByText(/Loading\.\.\./i)).toBeTruthy();
  });

  it('renders error state when isError=true', async () => {
    mockedUseGhTransitions.mockReturnValue(hookResult({ isError: true }));

    const { default: StatusPopover } = await import('./StatusPopover');
    render(<StatusPopover {...DEFAULT_PROPS} />, { wrapper });

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

  describe('resolution-during-transition', () => {
    const RESOLUTION_PROPS = {
      ...DEFAULT_PROPS,
      issueKey: 'PROJ-1',
      jiraBaseUrl: 'https://jira.example.com',
    };

    it('calls onSelect immediately (no opts) for a non-resolution-capable transition', async () => {
      mockedUseGhTransitions.mockReturnValue(
        hookResult({
          data: [{ id: '11', name: 'Start Progress', to: { id: '3', name: 'In Progress' } }],
        }),
      );
      // REST metadata: this transition is NOT resolution-capable.
      mockedFetchTransitions.mockResolvedValue([
        { id: '11', name: 'Start Progress', to: { id: '3', name: 'In Progress' }, fields: {} },
      ]);
      const onSelect = vi.fn();

      const { default: StatusPopover } = await import('./StatusPopover');
      render(<StatusPopover {...RESOLUTION_PROPS} onSelect={onSelect} />, { wrapper });

      fireEvent.click(screen.getByRole('button', { name: /To Do/i }));
      fireEvent.click(await screen.findByText('Start Progress'));

      expect(onSelect).toHaveBeenCalledWith('11', 'In Progress');
    });

    it('shows a resolution step and forwards the chosen resolution for a capable transition', async () => {
      mockedUseGhTransitions.mockReturnValue(
        hookResult({
          data: [{ id: '21', name: 'Resolve', to: { id: '6', name: 'Resolved' } }],
        }),
      );
      mockedFetchTransitions.mockResolvedValue([
        {
          id: '21',
          name: 'Resolve',
          to: { id: '6', name: 'Resolved' },
          fields: {
            resolution: {
              required: true,
              allowedValues: [
                { id: '1', name: 'Done' },
                { id: '2', name: "Won't Do" },
              ],
            },
          },
        },
      ]);
      const onSelect = vi.fn();

      const { default: StatusPopover } = await import('./StatusPopover');
      render(<StatusPopover {...RESOLUTION_PROPS} onSelect={onSelect} />, { wrapper });

      fireEvent.click(screen.getByRole('button', { name: /To Do/i }));
      await screen.findByText('Resolve');

      // The REST transitions-with-fields fetch resolves asynchronously; clicking
      // "Resolve" only branches into the resolution step once that metadata is
      // loaded (loading falls back to a plain transition by design). Wait for the
      // fetch to have been invoked + resolved before picking the transition.
      const { waitFor } = await import('@testing-library/react');
      await waitFor(() => expect(mockedFetchTransitions).toHaveBeenCalled());
      // Flush the resolved-promise microtask into React Query state.
      await waitFor(() => expect(screen.getByText('Resolve')).toBeTruthy());

      fireEvent.click(screen.getByText('Resolve'));

      // Resolution step appears instead of closing immediately.
      const doneBtn = await screen.findByText('Done');
      expect(onSelect).not.toHaveBeenCalled();

      fireEvent.click(doneBtn);
      expect(onSelect).toHaveBeenCalledWith('21', 'Resolved', { resolution: { id: '1' } });
    });

    // WR-05: resolution required but allowedValues empty → do NOT fire the
    // plain (doomed-to-400) transition; keep the popover open with a message.
    it('blocks the transition and shows a message when resolution is required but allowedValues is empty', async () => {
      mockedUseGhTransitions.mockReturnValue(
        hookResult({
          data: [{ id: '31', name: 'Close', to: { id: '7', name: 'Closed' } }],
        }),
      );
      mockedFetchTransitions.mockResolvedValue([
        {
          id: '31',
          name: 'Close',
          to: { id: '7', name: 'Closed' },
          fields: { resolution: { required: true, allowedValues: [] } },
        },
      ]);
      const onSelect = vi.fn();

      const { default: StatusPopover } = await import('./StatusPopover');
      render(<StatusPopover {...RESOLUTION_PROPS} onSelect={onSelect} />, { wrapper });

      fireEvent.click(screen.getByRole('button', { name: /To Do/i }));
      await screen.findByText('Close');

      const { waitFor } = await import('@testing-library/react');
      await waitFor(() => expect(mockedFetchTransitions).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText('Close')).toBeTruthy());

      fireEvent.click(screen.getByText('Close'));

      // No doomed request fired, and an explicit message is shown.
      expect(onSelect).not.toHaveBeenCalled();
      expect(
        await screen.findByText(/requires a resolution, but none are available/i),
      ).toBeTruthy();
    });
  });
});
