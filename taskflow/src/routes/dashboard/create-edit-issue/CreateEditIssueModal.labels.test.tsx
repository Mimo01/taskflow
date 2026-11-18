// Edit seeds existing labels / fix versions; untouched fields are never sent (T-101-22).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/apiFetch';
import * as jiraService from '@/services/jira';
import { CreateEditIssueModal } from './CreateEditIssueModal';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);

vi.mock('@/hooks/useProjectFixVersions', () => ({
  useProjectFixVersions: () => ({
    data: [
      { id: '10', name: 'v1', released: false },
      { id: '11', name: 'v2', released: false },
    ],
    isLoading: false,
    isError: false,
  }),
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
  labels: ['alpha'],
  fixVersions: [{ id: '10', name: 'v1' }],
};

function renderModal(mode: 'create' | 'edit') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CreateEditIssueModal
        open
        onClose={vi.fn()}
        mode={mode}
        initialValues={mode === 'edit' ? editValues : undefined}
      />
    </QueryClientProvider>,
  );
}

async function saveEdit() {
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(jiraService.bulkUpdateIssue).toHaveBeenCalled());
  return vi.mocked(jiraService.bulkUpdateIssue).mock.calls[0][3] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Edit labels and fix versions', () => {
  it('shows existing labels and fix versions', () => {
    renderModal('edit');
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByLabelText('Fix version')).toHaveTextContent('v1');
  });

  it('saving after changing only the summary sends neither labels nor fixVersions', async () => {
    renderModal('edit');
    fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'Changed' } });
    const fields = await saveEdit();
    expect(fields.summary).toBe('Changed');
    expect(fields).not.toHaveProperty('labels');
    expect(fields).not.toHaveProperty('fixVersions');
  });

  it('adding a label sends the full labels set', async () => {
    renderModal('edit');
    const input = screen.getByPlaceholderText('Add label');
    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const fields = await saveEdit();
    expect(fields.labels).toEqual(['alpha', 'beta']);
  });

  it('toggling the only fix version off sends an empty fixVersions', async () => {
    renderModal('edit');
    fireEvent.click(screen.getByLabelText('Fix version'));
    const items = screen.getAllByText('v1');
    fireEvent.click(items[items.length - 1]);
    const fields = await saveEdit();
    expect(fields.fixVersions).toEqual([]);
  });
});

describe('Create labels', () => {
  it('sends the entered labels in the create options', async () => {
    renderModal('create');
    fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'New story' } });
    const input = screen.getByPlaceholderText('Add label');
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    await waitFor(() => expect(jiraService.createIssue).toHaveBeenCalled());
    const options = vi.mocked(jiraService.createIssue).mock.calls[0][4] as Record<string, unknown>;
    expect(options.labels).toEqual(['alpha']);
  });

  it('Cmd+Enter from the label input keeps the typed label (WR-07)', async () => {
    renderModal('create');
    fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'New story' } });
    const input = screen.getByPlaceholderText('Add label');
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(jiraService.createIssue).toHaveBeenCalled());
    const options = vi.mocked(jiraService.createIssue).mock.calls[0][4] as Record<string, unknown>;
    expect(options.labels).toEqual(['alpha']);
  });

  it('Cmd+Enter submits when the typed label is the required one (WR-07)', async () => {
    vi.mocked(apiFetch).mockImplementation(
      async (_s: string, url: string) =>
        ({
          ok: true,
          status: 200,
          json: async () =>
            url.includes('/issuetypes')
              ? { values: [{ id: '1', name: 'Story', subtask: false }] }
              : {},
        }) as Response,
    );
    vi.mocked(jiraService.fetchCreatemeta).mockResolvedValue([
      { fieldId: 'labels', name: 'Labels', required: true, schema: { type: 'array' } },
    ] as never);
    renderModal('create');
    await waitFor(() => expect(jiraService.fetchCreatemeta).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'New story' } });
    const input = screen.getByPlaceholderText('Add label');
    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(jiraService.createIssue).toHaveBeenCalled());
    const options = vi.mocked(jiraService.createIssue).mock.calls[0][4] as Record<string, unknown>;
    expect(options.labels).toEqual(['beta']);
  });
});
