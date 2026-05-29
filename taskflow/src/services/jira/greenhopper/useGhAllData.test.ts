import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./allData', () => ({
  fetchAllData: vi.fn(),
}));

vi.mock('../../stronghold', () => ({
  readSecret: vi.fn(),
}));

vi.mock('../../../hooks/useIsActiveRoute', () => ({
  useIsActiveRoute: vi.fn(),
}));

import { useIsActiveRoute } from '../../../hooks/useIsActiveRoute';
import { useAuthStore } from '../../../stores/auth.store';
import { readSecret } from '../../stronghold';
import { fetchAllData } from './allData';
import type { GhAllDataResponse } from './types';
import { getGhAllData, invalidateGhAllData, useGhAllData } from './useGhAllData';

const mockedFetchAllData = vi.mocked(fetchAllData);
const mockedReadSecret = vi.mocked(readSecret);
const mockedUseIsActiveRoute = vi.mocked(useIsActiveRoute);

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const BOARD_ID = 123;

function makeAllDataResponse(): GhAllDataResponse {
  return {
    columnsData: { columns: [] },
    sprintsData: { sprints: [] },
    issuesData: { issues: [] },
    entityData: { statuses: {}, priorities: {}, types: {}, epics: {} },
  } as unknown as GhAllDataResponse;
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useGhAllData (hook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ jiraBaseUrl: BASE });
    mockedReadSecret.mockResolvedValue(TOKEN);
    mockedUseIsActiveRoute.mockReturnValue(true);
  });

  it('does NOT call fetchAllData when boardId is null', async () => {
    mockedFetchAllData.mockResolvedValue(makeAllDataResponse());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    renderHook(() => useGhAllData(null), { wrapper });

    await new Promise((r) => setTimeout(r, 30));
    expect(mockedFetchAllData).not.toHaveBeenCalled();
  });

  it('does NOT call fetchAllData when route is inactive', async () => {
    mockedUseIsActiveRoute.mockReturnValue(false);
    mockedFetchAllData.mockResolvedValue(makeAllDataResponse());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    renderHook(() => useGhAllData(BOARD_ID), { wrapper });

    await new Promise((r) => setTimeout(r, 30));
    expect(mockedFetchAllData).not.toHaveBeenCalled();
  });

  it('does NOT call fetchAllData when token is missing', async () => {
    mockedReadSecret.mockResolvedValue('');
    mockedFetchAllData.mockResolvedValue(makeAllDataResponse());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    renderHook(() => useGhAllData(BOARD_ID), { wrapper });

    await new Promise((r) => setTimeout(r, 30));
    expect(mockedFetchAllData).not.toHaveBeenCalled();
  });

  it('calls fetchAllData once with (baseUrl, token, boardId) when enabled; returns raw envelope', async () => {
    const payload = makeAllDataResponse();
    mockedFetchAllData.mockResolvedValue(payload);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useGhAllData(BOARD_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mockedFetchAllData).toHaveBeenCalledTimes(1);
    expect(mockedFetchAllData).toHaveBeenCalledWith(BASE, TOKEN, BOARD_ID);
    expect(result.current.data).toBe(payload);
  });
});

describe('getGhAllData (imperative)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensureQueryData warms cache key ["gh-all-data", boardId] and returns the response', async () => {
    const payload = makeAllDataResponse();
    mockedFetchAllData.mockResolvedValue(payload);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const result = await getGhAllData(qc, BASE, TOKEN, BOARD_ID);
    expect(result).toBe(payload);
    expect(mockedFetchAllData).toHaveBeenCalledTimes(1);
    expect(mockedFetchAllData).toHaveBeenCalledWith(BASE, TOKEN, BOARD_ID);

    // Cached: second call should NOT trigger another fetch
    const cached = qc.getQueryData(['gh-all-data', BOARD_ID]);
    expect(cached).toBe(payload);
  });
});

describe('invalidateGhAllData', () => {
  it('invalidates all boards when boardId is undefined', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());

    invalidateGhAllData(qc);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['gh-all-data'] });
  });

  it('invalidates a specific board when boardId is provided', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());

    invalidateGhAllData(qc, 7);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['gh-all-data', 7] });
  });
});
