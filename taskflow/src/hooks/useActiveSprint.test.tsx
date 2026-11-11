import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeSprintQueryKey, useActiveSprint } from './useActiveSprint';

const fetchActiveSprint = vi.fn();
const useBoardId = vi.fn();
vi.mock('@/services/jira', () => ({
  fetchActiveSprint: (...a: unknown[]) => fetchActiveSprint(...a),
}));
vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: (...a: unknown[]) => useBoardId(...a),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const SPRINT = { id: 1, name: 'S1' };

describe('useActiveSprint', () => {
  beforeEach(() => {
    fetchActiveSprint.mockReset();
    useBoardId.mockReset();
    useBoardId.mockReturnValue({ boardId: 7, isLoading: false });
  });

  it('returns the sprint when found', async () => {
    fetchActiveSprint.mockResolvedValue(SPRINT);
    const { result } = renderHook(() => useActiveSprint('https://j', 'tok', 'P'), { wrapper });
    await waitFor(() => expect(result.current.activeSprint).toEqual(SPRINT));
    expect(result.current.noActiveSprint).toBe(false);
    expect(result.current.isResolving).toBe(false);
  });

  it('flags noActiveSprint when null', async () => {
    fetchActiveSprint.mockResolvedValue(null);
    const { result } = renderHook(() => useActiveSprint('https://j', 'tok', 'P'), { wrapper });
    await waitFor(() => expect(result.current.noActiveSprint).toBe(true));
    expect(result.current.isResolving).toBe(false);
  });

  it('is resolving before the fetch settles', () => {
    fetchActiveSprint.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useActiveSprint('https://j', 'tok', 'P'), { wrapper });
    expect(result.current.isResolving).toBe(true);
    expect(result.current.noActiveSprint).toBe(false);
  });

  it('disabled query (no token) is not resolving', () => {
    const { result } = renderHook(() => useActiveSprint('https://j', null, 'P'), { wrapper });
    expect(result.current.isResolving).toBe(false);
    expect(result.current.noActiveSprint).toBe(false);
    expect(fetchActiveSprint).not.toHaveBeenCalled();
  });

  it('board loading counts as resolving', () => {
    useBoardId.mockReturnValue({ boardId: null, isLoading: true });
    const { result } = renderHook(() => useActiveSprint('https://j', 'tok', 'P'), { wrapper });
    expect(result.current.isResolving).toBe(true);
  });

  it('resolved null board is disabled and not resolving', () => {
    useBoardId.mockReturnValue({ boardId: null, isLoading: false });
    const { result } = renderHook(() => useActiveSprint('https://j', 'tok', 'P'), { wrapper });
    expect(result.current.isResolving).toBe(false);
    expect(result.current.noActiveSprint).toBe(false);
    expect(fetchActiveSprint).not.toHaveBeenCalled();
  });

  it('builds the shared key', () => {
    expect(activeSprintQueryKey('P', 'https://j', 7)).toEqual([
      'jira-active-sprint',
      'P',
      'https://j',
      7,
    ]);
  });
});
