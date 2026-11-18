import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFixVersions } from '@/services/jira/versions';
import { useProjectFixVersions } from './useProjectFixVersions';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

vi.mock('@/services/jira/versions', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/stores/auth.store', () => {
  const state = { jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' };
  return {
    useAuthStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.mocked(fetchFixVersions).mockClear();
});

describe('useProjectFixVersions', () => {
  it('loads the given project, not the active one (WR-04)', async () => {
    renderHook(() => useProjectFixVersions(true, 'OTHER'), { wrapper });
    await waitFor(() => expect(fetchFixVersions).toHaveBeenCalled());
    expect(fetchFixVersions).toHaveBeenCalledWith('https://jira.example.com', 'test-pat', 'OTHER');
  });

  it('falls back to the active project', async () => {
    renderHook(() => useProjectFixVersions(true), { wrapper });
    await waitFor(() => expect(fetchFixVersions).toHaveBeenCalled());
    expect(fetchFixVersions).toHaveBeenCalledWith('https://jira.example.com', 'test-pat', 'PROJ');
  });
});
