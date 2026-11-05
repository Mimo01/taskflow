import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubtaskTemplateRow as RowType } from '@/stores/subtask-templates.store';
import { SubtaskTemplateRow } from './SubtaskTemplateRow';

vi.mock('@/stores/auth.store', () => {
  const state = {
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    jiraUsername: 'me',
    jiraUserDisplayName: 'Me Myself',
    jiraUserAvatarUrl: null,
  };
  return {
    useAuthStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
  };
});

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: vi.fn().mockResolvedValue([{ name: 'bobby', displayName: 'Bob Brown' }]),
  fetchJiraUserByName: vi.fn().mockResolvedValue({ name: 'bobby', displayName: 'Bob Brown' }),
}));

function makeRow(assignee: string): RowType {
  return {
    id: 'r1',
    title: 'T',
    assignee,
    priority: null,
    labels: [],
    timeEstimate: '',
    duedate: null,
    storyPoints: null,
    components: [],
    customFieldValues: {},
  } as unknown as RowType;
}

function renderRow(assignee: string) {
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <SubtaskTemplateRow
      row={makeRow(assignee)}
      mode="settings"
      onChange={onChange}
      onRemove={vi.fn()}
    />,
    { wrapper },
  );
  return { onChange };
}

describe('SubtaskTemplateRow assignee picker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists placeholders then people; picking a placeholder stores the token', async () => {
    const { onChange } = renderRow('@unassigned');
    fireEvent.click(screen.getByRole('button', { name: 'Assignee' }));
    expect(await screen.findByTestId('assignee-option-@inherit')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-option-@current')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('assignee-option-@current'));
    expect(onChange).toHaveBeenCalledWith({ assignee: '@current' });
  });

  it('picking a person stores the username', async () => {
    const { onChange } = renderRow('@inherit');
    fireEvent.click(screen.getByRole('button', { name: 'Assignee' }));
    fireEvent.click(await screen.findByRole('button', { name: /Bob Brown/ }));
    expect(onChange).toHaveBeenCalledWith({ assignee: 'bobby' });
  });

  it('a concrete username resolves to the display name in the trigger', async () => {
    renderRow('bobby');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Assignee' })).toHaveTextContent('Bob Brown'),
    );
  });
});
