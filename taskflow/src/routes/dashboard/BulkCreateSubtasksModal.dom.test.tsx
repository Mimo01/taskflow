import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraIssueDetail } from '@/services/jira';
import { BulkCreateSubtasksModal } from './BulkCreateSubtasksModal';

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

vi.mock('@/stores/settings.store', () => {
  const state = { storyPointsFieldKey: null };
  return {
    useSettingsStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: () => ({ boardId: null }),
}));

vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: vi.fn().mockResolvedValue([]),
  fetchJiraUserByName: vi.fn().mockResolvedValue(null),
}));

const parent = { key: 'ABC-1', fields: {} } as unknown as JiraIssueDetail;

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <BulkCreateSubtasksModal open onClose={onClose} parentKey="ABC-1" parentIssue={parent} />,
    { wrapper },
  );
  return { onClose };
}

describe('BulkCreateSubtasksModal shell layout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows sentence-case title with the parent line under it', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Bulk create subtasks')).toBeInTheDocument();
    const parentLine = screen.getByText('Parent: ABC-1');
    expect(parentLine.className).toContain('text-xs');
    expect(parentLine.className).toContain('text-muted-foreground');
  });

  it('uses the fixed shell size and does not scroll the popup itself', () => {
    renderModal();
    const popup = screen.getByTestId('bulk-create-subtasks-modal');
    expect(popup.className).toContain('w-[min(1080px,94vw)]');
    expect(popup.className).toContain('h-[88vh]');
    expect(popup.className).not.toContain('overflow-y-auto');
  });

  it('keeps the selects outside the scrolling row list', () => {
    renderModal();
    const scroller = document.querySelector('.overflow-y-auto') as HTMLElement;
    expect(scroller).not.toBeNull();
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
    for (const c of comboboxes) expect(scroller.contains(c)).toBe(false);
  });

  it('shows the empty state, then adds a row with the shared Add row button', () => {
    renderModal();
    expect(screen.getByText('No subtasks yet')).toBeInTheDocument();
    expect(screen.getByText('Add a row or pick a template to start.')).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Add row' });
    expect(add).toHaveAttribute('data-slot', 'button');
    fireEvent.click(add);
    expect(screen.queryByText('No subtasks yet')).not.toBeInTheDocument();
  });

  it('footer has Close and Create subtasks with no muted footer background', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Create subtasks' })).toBeInTheDocument();
    const footer = screen.getByTestId('modal-footer-status').parentElement as HTMLElement;
    expect(footer.className).not.toContain('bg-muted/50');
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThanOrEqual(2);
  });

  it('Escape closes when idle', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
