import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn() }));
vi.mock('../services/jira', () => ({ fetchIssuesByKeys: vi.fn() }));

import { fetchIssuesByKeys } from '../services/jira';
import { readSecret } from '../services/stronghold';
import { useAuthStore } from '../stores/auth.store';
import { useRecentIssues } from './useRecentIssues';

const A = 'https://jira-a.example.com';
const B = 'https://jira-b.example.com';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useRecentIssues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ jiraBaseUrl: A });
    vi.mocked(fetchIssuesByKeys).mockResolvedValue([]);
  });

  it('never sends the previous instance PAT to a new Jira host (WR-06)', async () => {
    let current = 'tok-a';
    vi.mocked(readSecret).mockImplementation(async () => current);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const keys = ['SHOP-1'];
    const { result } = renderHook(() => useRecentIssues(true, keys), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() =>
      expect(fetchIssuesByKeys).toHaveBeenCalledWith(A, 'tok-a', keys, expect.anything()),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    current = 'tok-b';
    await act(async () => {
      useAuthStore.setState({ jiraBaseUrl: B });
    });
    await waitFor(() =>
      expect(fetchIssuesByKeys).toHaveBeenCalledWith(B, 'tok-b', keys, expect.anything()),
    );
    const toB = vi.mocked(fetchIssuesByKeys).mock.calls.filter(([base]) => base === B);
    expect(toB.every(([, tok]) => tok === 'tok-b')).toBe(true);
  });

  it('stops loading when no PAT can be read', async () => {
    vi.mocked(readSecret).mockRejectedValue(new Error('missing'));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const keys = ['SHOP-1'];
    const { result } = renderHook(() => useRecentIssues(true, keys), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchIssuesByKeys).not.toHaveBeenCalled();
  });
});
