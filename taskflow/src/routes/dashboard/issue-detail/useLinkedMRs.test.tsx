import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchIssueLinkedMRs, type GitLabMR } from '@/services/gitlab';
import { useLinkedMRs } from './useLinkedMRs';

const authState = {
  gitlabBaseUrl: 'https://gitlab.example.com' as string | null,
  gitlabConnected: true,
  activeGitlabProject: 42 as number | null,
};

vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => authState }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/services/gitlab', () => ({ fetchIssueLinkedMRs: vi.fn() }));

const mockFetch = vi.mocked(fetchIssueLinkedMRs);

const mr = (iid: number, state: string, title: string, branch = `branch-${iid}`) =>
  ({ iid, state, title, source_branch: branch }) as unknown as GitLabMR;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  authState.gitlabBaseUrl = 'https://gitlab.example.com';
  authState.gitlabConnected = true;
  authState.activeGitlabProject = 42;
});

describe('useLinkedMRs (261103-fxn)', () => {
  it('returns opened, merged and closed MRs; drops substring and description-only matches', async () => {
    mockFetch.mockResolvedValue([
      mr(1, 'opened', 'ABC-123 open'),
      mr(2, 'merged', 'ABC-123 merged'),
      mr(3, 'closed', 'ABC-123 closed'),
      mr(4, 'merged', 'ABC-1234 other'),
      mr(5, 'merged', 'unrelated title', 'unrelated-branch'),
    ]);
    const { result } = renderHook(() => useLinkedMRs('ABC-123'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.linkedMRs.length).toBe(3));
    expect(result.current.linkedMRs.map((m) => m.iid)).toEqual([1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://gitlab.example.com', 'tok', 42, 'ABC-123');
    expect(result.current.gitlabConnected).toBe(true);
    expect(result.current.gitlabBaseUrl).toBe('https://gitlab.example.com');
    expect(result.current.mrsLoading).toBe(false);
  });

  it('keeps an MR whose key is only in the source branch', async () => {
    mockFetch.mockResolvedValue([mr(7, 'merged', 'no key here', 'feature/ABC-123-x')]);
    const { result } = renderHook(() => useLinkedMRs('ABC-123'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.linkedMRs.map((m) => m.iid)).toEqual([7]));
  });

  it('dedupes two hook instances for the same issue into one fetch', async () => {
    mockFetch.mockResolvedValue([mr(1, 'opened', 'ABC-123 open')]);
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => ({ a: useLinkedMRs('ABC-123'), b: useLinkedMRs('ABC-123') }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.a.linkedMRs.length).toBe(1));
    expect(result.current.b.linkedMRs.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when GitLab is disconnected', async () => {
    authState.gitlabConnected = false;
    const { result } = renderHook(() => useLinkedMRs('ABC-123'), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.linkedMRs).toEqual([]);
  });

  it('does not fetch without an active GitLab project', async () => {
    authState.activeGitlabProject = null;
    const { result } = renderHook(() => useLinkedMRs('ABC-123'), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.linkedMRs).toEqual([]);
  });
});
