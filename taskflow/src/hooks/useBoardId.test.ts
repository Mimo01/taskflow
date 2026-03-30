import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira/sprints', () => ({
  fetchBoardId: vi.fn(),
}));

import { fetchBoardId } from '@/services/jira/sprints';
import { useBoardId } from './useBoardId';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('useBoardId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { boardId: 42, isLoading: false } after resolution', async () => {
    vi.mocked(fetchBoardId).mockResolvedValue(42);

    const { result } = renderHook(
      () => useBoardId('https://jira.example.com', 'token123', 'PROJ'),
      { wrapper: createWrapper() },
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boardId).toBe(42);
    expect(vi.mocked(fetchBoardId)).toHaveBeenCalledWith(
      'https://jira.example.com',
      'token123',
      'PROJ',
    );
  });

  it('returns { boardId: null, isLoading: false } when fetchBoardId returns null', async () => {
    vi.mocked(fetchBoardId).mockResolvedValue(null);

    const { result } = renderHook(
      () => useBoardId('https://jira.example.com', 'token123', 'PROJ'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boardId).toBeNull();
  });

  it('is disabled and returns { boardId: null, isLoading: false } when jiraBaseUrl is null', () => {
    const { result } = renderHook(() => useBoardId(null, 'token123', 'PROJ'), {
      wrapper: createWrapper(),
    });

    expect(result.current.boardId).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(vi.mocked(fetchBoardId)).not.toHaveBeenCalled();
  });

  it('is disabled and returns { boardId: null, isLoading: false } when projectKey is null', () => {
    const { result } = renderHook(
      () => useBoardId('https://jira.example.com', 'token123', null),
      { wrapper: createWrapper() },
    );

    expect(result.current.boardId).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(vi.mocked(fetchBoardId)).not.toHaveBeenCalled();
  });
});
