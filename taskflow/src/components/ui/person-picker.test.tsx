import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonPicker, type PersonPickerProps } from './person-picker';

vi.mock('@/stores/auth.store', () => {
  const state = {
    jiraUsername: 'me',
    jiraUserDisplayName: 'Me Myself',
    jiraUserAvatarUrl: null,
  };
  const useAuthStore = vi.fn((selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state,
  );
  return { useAuthStore };
});

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: vi.fn(),
}));

vi.mock('@/components/ui/cached-avatar', () => ({
  CachedAvatar: () => <span data-testid="avatar" />,
}));

import { fetchAssignableUsers } from '@/services/jira/users';

const mockFetch = vi.mocked(fetchAssignableUsers);

const USERS = [
  { displayName: 'Bob Brown', name: 'bob' },
  { displayName: 'Bo Peep', name: 'bopeep' },
];

function renderPicker(props: Partial<PersonPickerProps> = {}) {
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <PersonPicker
      variant="inline"
      triggerTestId="trigger"
      jiraBaseUrl="https://jira.example.com"
      projectKey="PROJ"
      value={null}
      onChange={onChange}
      {...props}
    />,
    { wrapper },
  );
  return { onChange };
}

async function open() {
  fireEvent.click(screen.getByTestId('trigger'));
  return screen.findByPlaceholderText('Filter users...');
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(USERS);
});

describe('PersonPicker', () => {
  it('debounces typing and searches server-side with the typed term', async () => {
    renderPicker();
    const input = await open();
    await screen.findByText('Bob Brown');
    mockFetch.mockClear();
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.change(input, { target: { value: 'bo' } });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch.mock.calls[0][3]).toBe('bo');
    // all server results shown, no client-side filtering
    expect(screen.getByText('Bob Brown')).toBeInTheDocument();
    expect(screen.getByText('Bo Peep')).toBeInTheDocument();
  });

  it('scopes by issueKey when provided', async () => {
    renderPicker({ issueKey: 'PROJ-1' });
    await open();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockFetch.mock.calls[0][4]).toEqual({ issueKey: 'PROJ-1' });
  });

  it('clicking a row calls onChange with the user and closes', async () => {
    const { onChange } = renderPicker();
    await open();
    fireEvent.click(await screen.findByText('Bob Brown'));
    expect(onChange).toHaveBeenCalledWith(USERS[0]);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Filter users...')).not.toBeInTheDocument(),
    );
  });

  it('shows the dashed Unassign card when allowUnassign and a value is set', async () => {
    const { onChange } = renderPicker({
      allowUnassign: true,
      value: { name: 'jane', displayName: 'Jane' },
    });
    await open();
    expect(screen.getByText('Remove Jane')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('assignee-unassign'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('hides Unassign when there is no value or the filter does not prefix "unassigned"', async () => {
    renderPicker({ allowUnassign: true, value: null });
    await open();
    expect(screen.queryByTestId('assignee-unassign')).not.toBeInTheDocument();
  });

  it('hides Unassign when the filter text is not a prefix of "unassigned"', async () => {
    renderPicker({ allowUnassign: true, value: { name: 'jane', displayName: 'Jane' } });
    const input = await open();
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.queryByTestId('assignee-unassign')).not.toBeInTheDocument();
  });

  it('Assign to me passes the current user, hidden when already me', async () => {
    const { onChange } = renderPicker({ showAssignToMe: true });
    await open();
    fireEvent.click(screen.getByTestId('assignee-assign-to-me'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'me', displayName: 'Me Myself' }),
    );
  });

  it('hides Assign to me when the value is the current user', async () => {
    renderPicker({ showAssignToMe: true, value: { name: 'me', displayName: 'Me Myself' } });
    await open();
    expect(screen.queryByTestId('assignee-assign-to-me')).not.toBeInTheDocument();
  });

  it('renders extraOptions as leading rows and fires onSelectOption', async () => {
    const onSelectOption = vi.fn();
    renderPicker({
      extraOptions: [{ id: '@inherit', label: 'Inherit' }],
      selectedOptionId: '@inherit',
      onSelectOption,
    });
    await open();
    const row = await screen.findByTestId('assignee-option-@inherit');
    expect(row.className).toContain('bg-accent/40');
    fireEvent.click(row);
    expect(onSelectOption).toHaveBeenCalledWith('@inherit');
  });

  it('keyboard: ArrowDown + Enter selects; Escape closes without onChange', async () => {
    const { onChange } = renderPicker();
    const input = await open();
    await screen.findByText('Bob Brown');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(USERS[0]);
  });

  it('Escape closes without calling onChange', async () => {
    const { onChange } = renderPicker();
    const input = await open();
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Filter users...')).not.toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows loading then empty states', async () => {
    mockFetch.mockResolvedValue([]);
    renderPicker();
    await open();
    expect(screen.getByText('Loading users...')).toBeInTheDocument();
    expect(await screen.findByText('No assignable users found')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Filter users...');
    fireEvent.change(input, { target: { value: 'zz' } });
    expect(await screen.findByText('No users match')).toBeInTheDocument();
  });
});
