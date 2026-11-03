import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import { updateMergeRequest } from '@/services/gitlab';
import { addIssueFixVersion } from '@/services/jira';
import type { DriftRow } from './driftDetection';
import { prependTaskKeyToTitle, useNotCoveredFixes } from './notCoveredFixes';
import type { MrFixContext } from './UnifiedTaskTable';

vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/services/jira', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/jira')>()),
  addIssueFixVersion: vi.fn(),
}));
vi.mock('@/services/gitlab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/gitlab')>()),
  updateMergeRequest: vi.fn(),
}));

const PROJECT_ID = 42;

function makeMr(overrides: Partial<GitLabMR> = {}): GitLabMR {
  return {
    id: 7,
    iid: 100,
    project_id: PROJECT_ID,
    title: 'Fix thing',
    source_branch: 'feature/x',
    target_branch: 'develop',
    state: 'opened',
    draft: false,
    author: { id: 1, name: 'Author', username: 'author', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-01-01T00:00:00.000Z',
    web_url: 'https://gitlab.example.com/mr/100',
    labels: [],
    milestone: null,
    ...overrides,
  };
}

function makeRow(mr: GitLabMR): DriftRow {
  const mark = 'none' as unknown as DriftRow['br'];
  return {
    mr,
    channels: new Set(),
    evaluated: true,
    br: mark,
    ms: mark,
    task: mark,
    taskReason: 'no-linked-task',
    taskKeys: [],
    flagged: true,
  };
}

const fixCtx: MrFixContext = {
  projectId: PROJECT_ID,
  baseUrl: 'https://gitlab.example.com',
  token: 'gl-token',
  releaseBranchName: null,
  releaseBranchExists: false,
  matchedMilestone: null,
};

function setup(
  fix: MrFixContext = fixCtx,
  jiraFix: { baseUrl: string | null; versionId: string } | undefined = {
    baseUrl: 'https://jira.example.com',
    versionId: '10100',
  },
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNotCoveredFixes({ fix, jiraFix }), { wrapper });
  return { qc, ...hook };
}

describe('prependTaskKeyToTitle', () => {
  it.each([
    ['Fix thing', 'PROJ-1 Fix thing'],
    ['Draft: Fix', 'Draft: PROJ-1 Fix'],
    ['[Draft] Fix', '[Draft] PROJ-1 Fix'],
    ['(Draft) Fix', '(Draft) PROJ-1 Fix'],
    ['WIP: Fix', 'WIP: PROJ-1 Fix'],
    ['draft: Fix', 'draft: PROJ-1 Fix'],
  ])('%s -> %s', (input, expected) => {
    expect(prependTaskKeyToTitle(input, 'PROJ-1')).toBe(expected);
  });
});

describe('useNotCoveredFixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applyFixVersion calls addIssueFixVersion and stays pending until invalidation resolves', async () => {
    vi.mocked(addIssueFixVersion).mockResolvedValue(undefined);
    const { qc, result } = setup();
    let release: () => void = () => {};
    vi.spyOn(qc, 'invalidateQueries').mockImplementation(((arg: { queryKey: unknown[] }) =>
      arg.queryKey[0] === 'jira-fixversion-issues'
        ? new Promise<void>((r) => {
            release = r;
          })
        : Promise.resolve()) as never);

    act(() => {
      void result.current.applyFixVersion(7, 'PROJ-1');
    });
    await waitFor(() =>
      expect(addIssueFixVersion).toHaveBeenCalledWith(
        'https://jira.example.com',
        'tok',
        'PROJ-1',
        '10100',
      ),
    );
    await waitFor(() => expect(qc.invalidateQueries).toHaveBeenCalledTimes(2));
    expect(result.current.pending[7]).toBe('PROJ-1');
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['jira-fixversion-issues', '10100'],
    });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jira-issue-detail'] });

    await act(async () => release());
    await waitFor(() => expect(result.current.pending[7]).toBeUndefined());
    expect(result.current.errors[7]).toBeUndefined();
  });

  it('applyFixVersion rejection sets the error and clears pending; a new attempt clears the error', async () => {
    vi.mocked(addIssueFixVersion).mockRejectedValueOnce(new Error('Boom'));
    const { result } = setup();

    await act(async () => {
      await result.current.applyFixVersion(7, 'PROJ-1');
    });
    expect(result.current.errors[7]).toBe('Boom');
    expect(result.current.pending[7]).toBeUndefined();

    vi.mocked(addIssueFixVersion).mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.applyFixVersion(7, 'PROJ-1');
    });
    expect(result.current.errors[7]).toBeUndefined();
  });

  it('applyFixVersion without a Jira baseUrl errors without calling Jira', async () => {
    const { result } = setup(fixCtx, { baseUrl: null, versionId: '10100' });
    await act(async () => {
      await result.current.applyFixVersion(7, 'PROJ-1');
    });
    expect(addIssueFixVersion).not.toHaveBeenCalled();
    expect(result.current.errors[7]).toBeTruthy();
  });

  it('linkTask updates the title pessimistically, then patches caches', async () => {
    vi.mocked(updateMergeRequest).mockResolvedValue(makeMr({ title: 'PROJ-1 Fix thing' }));
    const { qc, result } = setup();
    qc.setQueryData(['gitlab-all-project-mrs', PROJECT_ID, 'w'], [makeMr()]);

    await act(async () => {
      await result.current.linkTask(makeRow(makeMr()), 'PROJ-1');
    });

    expect(updateMergeRequest).toHaveBeenCalledWith(
      'https://gitlab.example.com',
      'gl-token',
      PROJECT_ID,
      100,
      { title: 'PROJ-1 Fix thing' },
    );
    const list = qc.getQueryData<GitLabMR[]>(['gitlab-all-project-mrs', PROJECT_ID, 'w']);
    expect(list?.[0].title).toBe('PROJ-1 Fix thing');
    expect(result.current.pending[7]).toBeUndefined();
  });

  it('linkTask rejection records the error and leaves caches untouched', async () => {
    vi.mocked(updateMergeRequest).mockRejectedValue(new Error('Nope'));
    const { qc, result } = setup();
    qc.setQueryData(['gitlab-all-project-mrs', PROJECT_ID, 'w'], [makeMr()]);

    await act(async () => {
      await result.current.linkTask(makeRow(makeMr()), 'PROJ-1');
    });

    expect(result.current.errors[7]).toBe('Nope');
    expect(
      qc.getQueryData<GitLabMR[]>(['gitlab-all-project-mrs', PROJECT_ID, 'w'])?.[0].title,
    ).toBe('Fix thing');
  });

  it('linkTask with a missing token errors before calling the service', async () => {
    const { result } = setup({ ...fixCtx, token: null });
    await act(async () => {
      await result.current.linkTask(makeRow(makeMr()), 'PROJ-1');
    });
    expect(updateMergeRequest).not.toHaveBeenCalled();
    expect(result.current.errors[7]).toBeTruthy();
  });
});
