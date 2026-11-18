// Phase 101 plan 10: resuming an issue draft restores everything and degrades stale pieces.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_DEBOUNCE_MS } from '@/hooks/useEditorDraft';
import { readDraftFile } from '@/lib/issue-draft-files';
import { createIssue, fetchCreatemeta, fetchIssueDescription } from '@/services/jira';
import {
  type IssueDraft,
  type IssueDraftSnapshot,
  useIssueDraftsStore,
} from '@/stores/issue-drafts.store';
import { CreateEditIssueModal } from './CreateEditIssueModal';

const { previewSpy } = vi.hoisted(() => ({ previewSpy: vi.fn() }));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

vi.mock('@/components/wiki-editor/WikiEditorLazy', async () => {
  const { useImperativeHandle } = await import('react');
  return {
    WikiEditorLazy: (props: {
      ref?: React.Ref<unknown>;
      value: string;
      onChange: (v: string) => void;
    }) => {
      useImperativeHandle(props.ref, () => ({
        focus: () => {},
        blur: () => {},
        insertFiles: () => {},
        setLocalPreview: previewSpy,
      }));
      return (
        <textarea
          aria-label="Description"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      );
    },
  };
});

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

vi.mock('@/hooks/useProjectFixVersions', () => ({
  useProjectFixVersions: () => ({
    data: [{ id: '10', name: 'v1', released: false }],
    isLoading: false,
    isError: false,
    isPending: false,
    status: 'success',
    fetchStatus: 'idle',
  }),
}));

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
      <button type="button" onClick={() => onChange({ key: 'EP-2' })}>
        pick epic
      </button>
    </div>
  ),
}));

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>();
  return {
    ...actual,
    fetchCreatemeta: vi.fn().mockResolvedValue([]),
    fetchIssueLinkTypes: vi.fn().mockResolvedValue([]),
    fetchIssueDescription: vi.fn(),
    searchJiraForLink: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn(),
    bulkUpdateIssue: vi.fn().mockResolvedValue(undefined),
    createIssueLink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn().mockImplementation(async (_svc: string, url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.includes('/issuetypes')
        ? {
            values: [
              { id: '1', name: 'Story', subtask: false },
              { id: '2', name: 'Subtask', subtask: true },
            ],
          }
        : { values: [] },
  })),
}));

vi.mock('@/services/jira/attachments', () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

vi.mock('@/lib/issue-draft-files', () => ({
  stageDraftFile: vi.fn(),
  readDraftFile: vi.fn(),
  removeDraftFiles: vi.fn().mockResolvedValue(undefined),
}));

const DRAFT_ID = 'draft-1';

function snapshot(over: Partial<IssueDraftSnapshot> = {}): IssueDraftSnapshot {
  return {
    selectedIssueType: 'Story',
    summary: 'Resumed summary',
    description: 'Resumed description',
    selectedAssignee: { name: 'alice', displayName: 'Alice Example' },
    selectedAssigneeName: 'alice',
    timeEstimate: '',
    priority: 'High',
    storyPoints: '3',
    epicLinkKey: 'EP-1',
    parentKey: null,
    labels: ['alpha'],
    fixVersions: [{ id: '10', name: 'v1' }],
    customFieldValues: {},
    customFieldInputValues: {},
    customFieldNames: {},
    linkRows: [{ id: 'row-1', linkTypeId: '', issueKey: 'PROJ-77' }],
    ...over,
  };
}

function seed(over: Partial<IssueDraftSnapshot> = {}, extra: Partial<IssueDraft> = {}) {
  const draft = {
    id: DRAFT_ID,
    kind: 'issue',
    updatedAt: Date.now(),
    projectKey: 'PROJ',
    files: [],
    snapshot: snapshot(over),
    ...extra,
  } as IssueDraft;
  useIssueDraftsStore.setState({ drafts: { [DRAFT_ID]: draft }, owner: null, saveFailed: false });
}

function renderModal(resumeDraftId: string | null = DRAFT_ID) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CreateEditIssueModal
        open
        onClose={vi.fn()}
        mode="create"
        resumeDraftId={resumeDraftId}
        defaultIssueType="Story"
      />
    </QueryClientProvider>,
  );
}

const summary = () => screen.getByPlaceholderText('Issue summary') as HTMLInputElement;
const drafts = () => Object.values(useIssueDraftsStore.getState().drafts);

beforeEach(() => {
  useIssueDraftsStore.setState({ drafts: {}, owner: null, saveFailed: false });
  vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
  vi.mocked(fetchIssueDescription)
    .mockReset()
    .mockResolvedValue({ description: 'x' } as never);
  vi.mocked(fetchCreatemeta).mockReset().mockResolvedValue([]);
  vi.mocked(createIssue).mockReset();
  vi.mocked(readDraftFile).mockReset();
  previewSpy.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Resuming an issue draft', () => {
  it('restores every field, the link row and the staged file', async () => {
    vi.mocked(fetchCreatemeta).mockResolvedValue([
      { fieldId: 'fixVersions', name: 'Fix versions', required: false, schema: { type: 'array' } },
    ] as never);
    vi.mocked(readDraftFile).mockResolvedValue(
      new File(['bytes'], 'shot.png', { type: 'image/png' }),
    );
    seed(
      {},
      {
        files: [{ name: 'shot.png', size: 5, type: 'image/png', path: 'issue-drafts/d/shot.png' }],
      },
    );
    renderModal();
    await waitFor(() => expect(summary().value).toBe('Resumed summary'));
    expect(screen.getByLabelText('Description')).toHaveValue('Resumed description');
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(await screen.findByText('v1')).toBeInTheDocument();
    expect(screen.getByTestId('epic-value')).toHaveTextContent('EP-1');
    expect(screen.getByLabelText('Story points')).toHaveValue(3);
    expect(screen.getByText('PROJ-77')).toBeInTheDocument();
    expect(await screen.findByText('shot.png')).toBeInTheDocument();
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    await waitFor(() => expect(previewSpy).toHaveBeenCalledWith('shot.png', 'blob:preview'));
  });

  it('clears an epic that no longer exists, shows a note and keeps Create enabled', async () => {
    seed();
    vi.mocked(fetchIssueDescription).mockImplementation(async (_b, _t, key) =>
      key === 'EP-1' ? null : ({ description: 'x' } as never),
    );
    renderModal();
    expect(await screen.findByText('Epic EP-1 no longer exists')).toBeInTheDocument();
    expect(screen.getByTestId('epic-value')).toHaveTextContent('none');
    expect(screen.getByRole('button', { name: 'Create Issue' })).toBeEnabled();
  });

  it('keeps the epic with no note when the lookup fails', async () => {
    seed();
    vi.mocked(fetchIssueDescription).mockRejectedValue(new Error('boom'));
    renderModal();
    await waitFor(() => expect(summary().value).toBe('Resumed summary'));
    await waitFor(() => expect(fetchIssueDescription).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByTestId('epic-value')).toHaveTextContent('EP-1');
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
  });

  it('keeps a Subtask draft a Subtask and clears a parent that no longer exists', async () => {
    seed({ selectedIssueType: 'Subtask', parentKey: 'P-1', epicLinkKey: null });
    vi.mocked(fetchIssueDescription).mockResolvedValue(null);
    renderModal();
    expect(await screen.findByText('Parent P-1 no longer exists')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Parent issue key (e.g. PROJ-123)')).toHaveValue('');
    expect(screen.getByLabelText('Estimate')).toBeInTheDocument();
  });

  it('notes a custom field that is no longer on the create screen', async () => {
    seed({
      epicLinkKey: null,
      customFieldValues: { customfield_1: 'abc' },
      customFieldInputValues: { customfield_1: 'Abc' },
      customFieldNames: { customfield_1: 'Account' },
    });
    renderModal();
    expect(
      await screen.findByText('Account is no longer available on this screen'),
    ).toBeInTheDocument();
  });

  it('shows a missing tile for a file whose copy is gone', async () => {
    vi.mocked(readDraftFile).mockResolvedValue(null);
    seed(
      { epicLinkKey: null },
      {
        files: [
          { name: 'photo.png', size: 5, type: 'image/png', path: 'issue-drafts/d/photo.png' },
        ],
      },
    );
    renderModal();
    expect(await screen.findByText('photo.png is missing')).toBeInTheDocument();
  });

  it('clears the epic note when the Epic field is edited', async () => {
    seed();
    vi.mocked(fetchIssueDescription).mockResolvedValue(null);
    renderModal();
    expect(await screen.findByText('Epic EP-1 no longer exists')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pick epic' }));
    expect(screen.queryByText('Epic EP-1 no longer exists')).not.toBeInTheDocument();
    expect(screen.getByTestId('epic-value')).toHaveTextContent('EP-2');
  });

  it('waits for hydration instead of opening blank, then restores', async () => {
    seed();
    const listeners: Array<() => void> = [];
    vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(false);
    vi.spyOn(useIssueDraftsStore.persist, 'onFinishHydration').mockImplementation((cb) => {
      listeners.push(() => cb(useIssueDraftsStore.getState()));
      return () => {};
    });
    renderModal();
    await act(async () => {});
    expect(summary().value).toBe('');
    vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
    act(() => {
      for (const l of listeners) l();
    });
    await waitFor(() => expect(summary().value).toBe('Resumed summary'));
  });

  it('writes edits to the same draft id, never a second draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seed({ epicLinkKey: null });
    renderModal();
    await waitFor(() => expect(summary().value).toBe('Resumed summary'));
    fireEvent.change(summary(), { target: { value: 'Edited after resume' } });
    act(() => {
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 10);
    });
    expect(drafts()).toHaveLength(1);
    expect(drafts()[0].id).toBe(DRAFT_ID);
    expect(drafts()[0]).toMatchObject({ snapshot: { summary: 'Edited after resume' } });
  });

  it("creates in the draft's own project", async () => {
    seed({ epicLinkKey: null, linkRows: [] }, { projectKey: 'OTHER' });
    vi.mocked(createIssue).mockResolvedValue({ id: '1', key: 'OTHER-1' } as never);
    renderModal();
    await waitFor(() => expect(summary().value).toBe('Resumed summary'));
    await waitFor(() => expect(fetchCreatemeta).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    await waitFor(() => expect(createIssue).toHaveBeenCalled());
    expect(JSON.stringify(vi.mocked(createIssue).mock.calls[0])).toContain('OTHER');
  });
});
