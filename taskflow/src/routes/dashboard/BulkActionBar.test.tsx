/**
 * BulkActionBar tests — Phase 72 GH transitions migration.
 *
 * The parallel batch handler resolves transitions through
 * `getGhTransitions(queryClient, baseUrl, token, projectId, issueTypeId)`.
 * These tests assert the new call shape and the fail-fast guard for issues
 * absent from the `issues` prop. The legacy per-issue REST GET path was
 * deleted in Phase 72-03 (D-08 / GH-CUT-01).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira', () => ({
  getGhTransitions: vi
    .fn()
    .mockResolvedValue([{ id: '11', name: 'Start', to: { id: '3', name: 'In Progress' } }]),
  postTransition: vi.fn().mockResolvedValue(undefined),
  updateIssueField: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
  })),
}));

vi.mock('./BulkProgressIndicator', () => ({
  BulkProgressIndicator: ({ succeeded, failed }: { succeeded: number; failed: number }) => (
    <div data-testid="bulk-progress">
      ok:{succeeded} fail:{failed}
    </div>
  ),
}));

function makeBulkIssue(key: string, projectId: string, issueTypeId: string) {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: { id: '1', name: 'To Do' },
      assignee: null,
      customfield_10016: null,
      issuetype: { id: issueTypeId, name: 'Story', subtask: false },
      project: { id: projectId, key: 'PROJ' },
    },
  } as unknown as import('@/services/jira').JiraIssue;
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('BulkActionBar (Phase 72 GH transitions migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves transitions via getGhTransitions for each selected key', async () => {
    const { getGhTransitions, postTransition } = await import('@/services/jira');
    const { BulkActionBar } = await import('./BulkActionBar');

    const issues = [makeBulkIssue('PROJ-1', '10042', '3'), makeBulkIssue('PROJ-2', '10042', '3')];
    const selectedKeys = new Set(['PROJ-1', 'PROJ-2']);

    renderWithQuery(
      <BulkActionBar
        selectedKeys={selectedKeys}
        issues={issues}
        statuses={['In Progress']}
        assignees={[]}
        priorities={[]}
        onClearSelection={vi.fn()}
        onBulkComplete={vi.fn()}
      />,
    );

    // Wait for jiraToken to resolve via the mocked readSecret promise.
    await waitFor(() => {
      // The Status select is rendered immediately; we can just go ahead.
      expect(screen.getByText(/selected/)).toBeTruthy();
    });

    // Select status target via the underlying Radix Select — drive directly
    // via fireEvent on the visible trigger then click the item.
    const triggers = screen.getAllByRole('combobox');
    fireEvent.click(triggers[0]);
    const inProgressOption = await screen.findByText('In Progress');
    fireEvent.click(inProgressOption);

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: /Apply Changes/i });
    await waitFor(() => expect(applyBtn).not.toBeDisabled());
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(getGhTransitions).toHaveBeenCalledTimes(2);
    });
    expect(getGhTransitions).toHaveBeenCalledWith(
      expect.anything(), // queryClient
      'https://jira.example.com',
      'test-jira-token',
      10042,
      '3',
    );
    expect(postTransition).toHaveBeenCalledTimes(2);
  });

  it('throws when a selected key is not present in the issues prop', async () => {
    const { getGhTransitions } = await import('@/services/jira');
    const { BulkActionBar } = await import('./BulkActionBar');

    const issues = [makeBulkIssue('PROJ-1', '10042', '3')];
    const selectedKeys = new Set(['PROJ-1', 'PROJ-MISSING']);

    renderWithQuery(
      <BulkActionBar
        selectedKeys={selectedKeys}
        issues={issues}
        statuses={['In Progress']}
        assignees={[]}
        priorities={[]}
        onClearSelection={vi.fn()}
        onBulkComplete={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText(/selected/)).toBeTruthy());

    const triggers = screen.getAllByRole('combobox');
    fireEvent.click(triggers[0]);
    const inProgressOption = await screen.findByText('In Progress');
    fireEvent.click(inProgressOption);

    const applyBtn = screen.getByRole('button', { name: /Apply Changes/i });
    await waitFor(() => expect(applyBtn).not.toBeDisabled());
    fireEvent.click(applyBtn);

    // Progress indicator surfaces — for the missing key the inner handler
    // throws "Issue PROJ-MISSING not in selection"; for the present key
    // getGhTransitions is still invoked.
    await waitFor(() => {
      expect(getGhTransitions).toHaveBeenCalled();
    });
    // The mock progress indicator reflects 1 ok + 1 fail (order may vary).
    await waitFor(() => {
      const node = screen.getByTestId('bulk-progress');
      expect(node.textContent).toMatch(/fail:1/);
    });
  });
});
