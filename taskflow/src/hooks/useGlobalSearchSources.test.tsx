import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn() }));
vi.mock('../services/jira/greenhopper/data', () => ({ fetchBacklogData: vi.fn() }));
vi.mock('../services/jira/greenhopper/allData', () => ({ fetchAllData: vi.fn() }));
vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: vi.fn(() => ({ boardId: 7, isLoading: false })),
}));

import { readSecret } from '@/services/stronghold';
import { fetchAllData } from '../services/jira/greenhopper/allData';
import { fetchBacklogData } from '../services/jira/greenhopper/data';
import type { GhAllDataResponse, GhBacklogResponse } from '../services/jira/greenhopper/types';
import { useGhBacklogData } from '../services/jira/greenhopper/useGhBacklogData';
import { useAuthStore } from '../stores/auth.store';
import { GLOBAL_SEARCH_STALE_MS, useGlobalSearchSources } from './useGlobalSearchSources';

const BASE = 'https://jira.example.com';
const BACKLOG = { marker: 'backlog' } as unknown as GhBacklogResponse;
const ALL = { marker: 'all' } as unknown as GhAllDataResponse;

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dashboard']}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useGlobalSearchSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ jiraBaseUrl: BASE, activeJiraProject: 'SHOP' });
    vi.mocked(readSecret).mockResolvedValue('tok');
    vi.mocked(fetchBacklogData).mockResolvedValue(BACKLOG);
  });

  it('exports a 5 minute stale window', () => {
    expect(GLOBAL_SEARCH_STALE_MS).toBe(300_000);
  });

  it('fetches the backlog off-route when open (cold cache)', async () => {
    const qc = newClient();
    const { result } = renderHook(() => useGlobalSearchSources(true), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.backlog).toBe(BACKLOG));
    expect(fetchBacklogData).toHaveBeenCalledTimes(1);
    expect(fetchBacklogData).toHaveBeenCalledWith(BASE, 'tok', 7);
    expect(result.current.isIndexLoading).toBe(false);
    expect(result.current.isIndexError).toBe(false);
  });

  it('does not fetch when closed', async () => {
    const qc = newClient();
    renderHook(() => useGlobalSearchSources(false), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchBacklogData).not.toHaveBeenCalled();
  });

  it('does not refetch when the cache is fresh', async () => {
    const qc = newClient();
    qc.setQueryData(['gh-backlog', 7], BACKLOG);
    const { result } = renderHook(() => useGlobalSearchSources(true), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.backlog).toBe(BACKLOG));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(fetchBacklogData).not.toHaveBeenCalled();
  });

  it('reports isIndexError when the backlog fetch fails', async () => {
    vi.mocked(fetchBacklogData).mockRejectedValue(new Error('boom'));
    const qc = newClient();
    const { result } = renderHook(() => useGlobalSearchSources(true), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isIndexError).toBe(true));
  });

  it('reads gh-all-data passively and reactively without fetching', async () => {
    const qc = newClient();
    const { result } = renderHook(() => useGlobalSearchSources(true), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.backlog).toBe(BACKLOG));
    expect(result.current.allData).toBeUndefined();
    act(() => {
      qc.setQueryData(['gh-all-data', 7], ALL);
    });
    await waitFor(() => expect(result.current.allData).toBe(ALL));
    expect(fetchAllData).not.toHaveBeenCalled();
  });

  it('useGhBacklogData without opts still does not fetch off the backlog route', async () => {
    const qc = newClient();
    renderHook(() => useGhBacklogData(7), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(fetchBacklogData).not.toHaveBeenCalled();
  });
});
