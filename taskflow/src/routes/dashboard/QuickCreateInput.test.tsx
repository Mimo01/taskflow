/**
 * QuickCreateInput tests (Phase 72 Plan 02 update).
 *
 * Migrated from the legacy `fetchTransitions` flow to
 * `getGhTransitions(queryClient, baseUrl, token, projectId, issueTypeId)` —
 * tests cover the new prop surface (projectId + issueTypeId) and verify the
 * post-create transition lookup hits the GH cache, not the REST fetcher.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira', () => ({
  createIssue: vi.fn().mockResolvedValue({ id: '10001', key: 'PROJ-42' }),
  getGhTransitions: vi.fn().mockResolvedValue([]),
  postTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

// Default props to satisfy the required interface (Phase 72 — projectId/issueTypeId added).
const DEFAULT_PROPS = {
  statusId: 'status-1',
  statusName: 'To Do',
  projectKey: 'PROJ',
  projectId: 10042,
  issueTypeId: '3',
  jiraBaseUrl: 'https://jira.example.com',
  jiraToken: 'test-jira-token',
  onCreated: vi.fn(),
};

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('QuickCreateInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows text input when + Add button is clicked', async () => {
    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    renderWithQuery(<QuickCreateInput {...DEFAULT_PROPS} />);

    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /\+ Add/i }));

    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('calls createIssue with correct args and hides input after Enter', async () => {
    const { createIssue } = await import('@/services/jira');

    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    renderWithQuery(<QuickCreateInput {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /\+ Add/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'My new story' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(createIssue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'My new story',
    );

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  it('hides input when Escape is pressed without creating', async () => {
    const { createIssue } = await import('@/services/jira');

    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    renderWithQuery(<QuickCreateInput {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /\+ Add/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Some text that will be discarded' } });
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(createIssue).not.toHaveBeenCalled();
  });

  it('uses getGhTransitions for post-create transition lookup', async () => {
    const { getGhTransitions } = await import('@/services/jira');
    vi.mocked(getGhTransitions).mockResolvedValueOnce([
      { id: '11', name: 'Start', to: { id: 'status-1', name: 'To Do' } },
    ] as Awaited<ReturnType<typeof getGhTransitions>>);

    const { default: QuickCreateInput } = await import('./QuickCreateInput');
    renderWithQuery(<QuickCreateInput {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /\+ Add/i }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Threaded story' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(getGhTransitions).toHaveBeenCalledWith(
        expect.anything(), // queryClient instance
        'https://jira.example.com',
        'test-jira-token',
        10042,
        '3',
      );
    });
  });
});
