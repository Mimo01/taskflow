// UI-01: large two-column Create/Edit modal layout, copy and absent subtasks section.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateEditIssueModal } from './CreateEditIssueModal';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);

vi.mock('@/hooks/useProjectFixVersions', () => ({
  useProjectFixVersions: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('@/stores/auth.store', () => {
  const state = { jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' };
  return {
    useAuthStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
  };
});

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    epicLinkFieldKey: null,
    storyPointsFieldKey: null,
    accountFieldKey: null,
  }),
}));

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>();
  return {
    ...actual,
    fetchCreatemeta: vi.fn().mockResolvedValue([]),
    fetchIssueLinkTypes: vi.fn().mockResolvedValue([]),
    searchJiraForLink: vi.fn().mockResolvedValue([]),
    bulkUpdateIssue: vi.fn().mockResolvedValue(undefined),
    createIssue: vi.fn().mockResolvedValue({ key: 'PROJ-9' }),
    createIssueLink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ values: [] }) }),
}));

vi.mock('@/services/jira/attachments', () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

// Stable identity: the form re-RESETs whenever initialValues changes.
const editValues = {
  issueKey: 'ABC-1',
  summary: 'Existing',
  description: 'Body',
  assigneeName: null,
  priority: null,
  storyPoints: null,
  epicLinkKey: null,
  attachments: [],
  issueTypeName: 'Story',
};

function renderModal(props: Partial<React.ComponentProps<typeof CreateEditIssueModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CreateEditIssueModal open onClose={vi.fn()} mode="create" {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateEditIssueModal layout (UI-01)', () => {
  it('renders the fixed large dialog with header, main column, sidebar and footer', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[min(1080px,94vw)]');
    expect(dialog.className).toContain('h-[88vh]');
    expect(screen.getByRole('heading', { name: 'Create issue' })).toBeInTheDocument();
    expect(screen.getByLabelText(/summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();
    expect(screen.getByTestId('modal-footer-status')).toBeInTheDocument();
  });

  it('orders sidebar labels Assignee, Priority, Epic, Labels, Story points', () => {
    renderModal();
    const aside = dialogAside();
    const labels = within(aside)
      .getAllByText(/^(Assignee|Priority|Epic|Labels|Story points)$/)
      .map((n) => n.textContent);
    expect(labels).toEqual(['Assignee', 'Priority', 'Epic', 'Labels', 'Story points']);
  });

  it('has no subtasks section', () => {
    renderModal();
    expect(screen.queryByText(/subtasks/i)).not.toBeInTheDocument();
  });

  it('footer shows Cancel then Create issue', () => {
    renderModal();
    const footer = screen.getByTestId('modal-footer-status').parentElement as HTMLElement;
    const buttons = within(footer)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(buttons).toEqual(['Cancel', 'Create issue']);
  });

  it('Edit shows "Edit ABC-1" and Save changes', () => {
    renderModal({ mode: 'edit', initialValues: editValues });
    expect(screen.getByRole('heading', { name: 'Edit ABC-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByText('Fix version')).toBeInTheDocument();
  });

  it('Subtask shows Parent and Estimate but no Epic, Story points or Fix version', () => {
    renderModal({ defaultIssueType: 'Subtask', defaultParentKey: 'PROJ-5' });
    const aside = dialogAside();
    expect(within(aside).getByText('Parent')).toBeInTheDocument();
    expect(within(aside).getByText('Estimate')).toBeInTheDocument();
    expect(within(aside).queryByText('Epic')).not.toBeInTheDocument();
    expect(within(aside).queryByText('Story points')).not.toBeInTheDocument();
    expect(within(aside).queryByText('Fix version')).not.toBeInTheDocument();
  });

  it('keeps the sidebar beside the main column and stacks only under 720px', () => {
    renderModal();
    const aside = dialogAside();
    expect(aside.className).toContain('w-[300px]');
    expect(aside.className).toContain('@max-[900px]:w-[240px]');
    expect(aside.className).toContain('max-[720px]:w-full');
  });

  it('Cancel tooltip trigger is present and clickable', () => {
    renderModal();
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
});

function dialogAside(): HTMLElement {
  const aside = screen.getByRole('dialog').querySelector('aside');
  if (!aside) throw new Error('sidebar not found');
  return aside as HTMLElement;
}
