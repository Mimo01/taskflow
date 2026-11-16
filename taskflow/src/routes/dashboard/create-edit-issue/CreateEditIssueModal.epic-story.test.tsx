// Epic "Add story": required custom fields (Account) inherit from the epic the way
// subtasks inherit from their parent. Quick 261116-c5g.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiFetchModule from '@/lib/apiFetch';
import * as jiraService from '@/services/jira';
import { CreateEditIssueModal } from './CreateEditIssueModal';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

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
  const state = {
    epicLinkFieldKey: 'customfield_10008',
    storyPointsFieldKey: null,
    accountFieldKey: null,
  };
  return {
    useSettingsStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});

// Minimal stand-in so tests can change / clear the Epic Link without the popover search.
vi.mock('@/components/ui/epic-picker', () => ({
  EpicPicker: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (e: { key: string } | null) => void;
  }) => (
    <div>
      <span data-testid="epic-value">{value ?? 'none'}</span>
      <button type="button" onClick={() => onChange(null)}>
        clear epic
      </button>
      <button type="button" onClick={() => onChange({ key: 'EPIC-2' })}>
        pick EPIC-2
      </button>
    </div>
  ),
}));

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>();
  return {
    ...actual,
    fetchCreatemeta: vi.fn(),
    fetchIssueLinkTypes: vi.fn().mockResolvedValue([]),
    searchJiraForLink: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn(),
    bulkUpdateIssue: vi.fn().mockResolvedValue(undefined),
    createIssueLink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

function mockApi() {
  vi.mocked(apiFetchModule.apiFetch).mockImplementation(async (_svc, url: string) => {
    if (url.includes('/issuetypes')) {
      return ok({
        values: [
          { id: '10001', name: 'Story', subtask: false },
          { id: '10002', name: 'Sub-task', subtask: true },
        ],
      });
    }
    if (url.includes('/issue/EPIC-1?'))
      return ok({ fields: { customfield_10500: { id: 42, name: 'Acme Account' } } });
    if (url.includes('/issue/EPIC-2?'))
      return ok({ fields: { customfield_10500: { id: 43, name: 'Beta Account' } } });
    if (url.includes('/issue/PARENT-1?'))
      return ok({ fields: { customfield_10500: { id: 99, name: 'Parent Account' } } });
    if (url.includes('/ac?')) return ok([{ id: 77, name: 'Other Account' }]);
    return ok({ values: [] });
  });
  vi.mocked(jiraService.fetchCreatemeta).mockResolvedValue([
    {
      fieldId: 'customfield_10500',
      name: 'Account',
      required: true,
      schema: { type: 'any' },
      autoCompleteUrl: 'https://jira.example.com/ac?q=',
    },
  ] as never);
  vi.mocked(jiraService.createIssue).mockResolvedValue({ id: '1', key: 'PROJ-9' } as never);
}

function renderModal(props: Partial<React.ComponentProps<typeof CreateEditIssueModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <CreateEditIssueModal
        open={true}
        onClose={onClose}
        mode="create"
        defaultIssueType="Story"
        defaultEpicLinkKey="EPIC-1"
        {...props}
      />
    </QueryClientProvider>,
  );
  return { qc, onClose, ...utils };
}

const accountInput = () => screen.findByPlaceholderText('Search Account...');
const fillSummary = () =>
  fireEvent.change(screen.getByPlaceholderText('Issue summary'), {
    target: { value: 'New story' },
  });
const createBtn = () => screen.getByRole('button', { name: /^create$/i });
const lastCreateOptions = () =>
  vi.mocked(jiraService.createIssue).mock.calls[0][4] as Record<string, unknown>;

describe('CreateEditIssueModal: epic story inherits from epic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('prefills Account from the epic and enables Create', async () => {
    renderModal();
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Acme Account'));
    fillSummary();
    expect(createBtn()).toBeEnabled();
  });

  it('submits the epic raw Account id and the epic link', async () => {
    renderModal();
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Acme Account'));
    fillSummary();
    fireEvent.click(createBtn());
    await waitFor(() => expect(jiraService.createIssue).toHaveBeenCalled());
    expect(lastCreateOptions().customfield_10500).toBe('42');
    expect(lastCreateOptions().customfield_10008).toBe('EPIC-1');
  });

  it('a manually picked Account wins over the inherited one', async () => {
    renderModal();
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Acme Account'));
    fireEvent.change(input, { target: { value: 'Oth' } });
    fireEvent.mouseDown(await screen.findByText('Other Account'));
    fillSummary();
    fireEvent.click(createBtn());
    await waitFor(() => expect(jiraService.createIssue).toHaveBeenCalled());
    expect(lastCreateOptions().customfield_10500).toEqual({ id: '77' });
  });

  it('switching the Epic Link swaps the inherited value', async () => {
    renderModal();
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Acme Account'));
    fireEvent.click(screen.getByText('pick EPIC-2'));
    await waitFor(() => expect(input.value).toBe('Beta Account'));
    fillSummary();
    fireEvent.click(createBtn());
    await waitFor(() => expect(jiraService.createIssue).toHaveBeenCalled());
    expect(lastCreateOptions().customfield_10500).toBe('43');
  });

  it('clearing the Epic Link drops the inherited label and disables Create', async () => {
    renderModal();
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Acme Account'));
    fillSummary();
    expect(createBtn()).toBeEnabled();
    fireEvent.click(screen.getByText('clear epic'));
    await waitFor(() => expect(input.value).toBe(''));
    expect(createBtn()).toBeDisabled();
  });

  it('subtask still inherits from its parent', async () => {
    renderModal({
      defaultIssueType: 'Subtask',
      defaultParentKey: 'PARENT-1',
      defaultEpicLinkKey: undefined,
    });
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Parent Account'));
  });
});

describe('CreateEditIssueModal: close after create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('epic story create closes the modal exactly once and invalidates the epic lists', async () => {
    const { qc, onClose } = renderModal();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Acme Account'));
    fillSummary();
    fireEvent.click(createBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Jira|failed|error/i)).not.toBeInTheDocument();
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    // The Stories list key ['jira-epic-stories', epicKey, baseUrl] is covered by this prefix.
    expect(keys).toContain(JSON.stringify(['jira-epic-stories']));
    expect(keys).toContain(
      JSON.stringify(['jira-issue-detail', 'EPIC-1', 'https://jira.example.com']),
    );
  });

  it('subtask create still closes once', async () => {
    const { onClose } = renderModal({
      defaultIssueType: 'Subtask',
      defaultParentKey: 'PARENT-1',
      defaultEpicLinkKey: undefined,
    });
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Parent Account'));
    fillSummary();
    fireEvent.click(createBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('a Jira error keeps the modal open and shows the message', async () => {
    vi.mocked(jiraService.createIssue).mockRejectedValue(new Error('Account is invalid'));
    const { onClose } = renderModal();
    const input = (await accountInput()) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Acme Account'));
    fillSummary();
    fireEvent.click(createBtn());
    expect(await screen.findByText('Account is invalid')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
