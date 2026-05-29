/**
 * Phase 74 — Task 3: hook contract suite for useGhBacklogData.
 *
 * Mirrors `useGhAllData.test.ts` (PATTERNS S7), ported to the backlog
 * surface. Eight cases satisfying the planner's `it(` literal grep:
 *   1. does NOT call fetchBacklogData when boardId is null
 *   2. does NOT call fetchBacklogData when route is inactive
 *   3. does NOT call fetchBacklogData when token is missing
 *   4. calls fetchBacklogData once when enabled; returns raw envelope
 *   5. getGhBacklogData warms cache key ['gh-backlog', boardId]
 *   6. invalidateGhBacklogData() invalidates all boards
 *   7. invalidateGhBacklogData(qc, boardId) invalidates one board
 *   8. no recurring refetch after staleTime (D-02 no-polling)
 *
 * NOTE (deviation Rule 3): The plan originally specified a RED state via
 * module-not-found resolving `../useGhBacklogData`. The repo's husky
 * pre-commit runs the full vitest suite, so a load-time failure here would
 * block every subsequent commit. The real hook module landed alongside
 * this test in Plan 01 as a Rule-3 auto-fix; the suite is GREEN today. See
 * Plan 01 SUMMARY §"Deviations from Plan".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data', () => ({
  fetchBacklogData: vi.fn(),
}));

vi.mock('../../../stronghold', () => ({
  readSecret: vi.fn(),
}));

vi.mock('../../../../hooks/useIsActiveRoute', () => ({
  useIsActiveRoute: vi.fn(),
}));

import { useIsActiveRoute } from '../../../../hooks/useIsActiveRoute';
import { useAuthStore } from '../../../../stores/auth.store';
import { readSecret } from '../../../stronghold';
import { fetchBacklogData } from '../data';
import type { GhBacklogResponse } from '../types';
import { getGhBacklogData, invalidateGhBacklogData, useGhBacklogData } from '../useGhBacklogData';

const mockedFetchBacklogData = vi.mocked(fetchBacklogData);
const mockedReadSecret = vi.mocked(readSecret);
const mockedUseIsActiveRoute = vi.mocked(useIsActiveRoute);

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const BOARD_ID = 123;

function makeBacklogResponse(): GhBacklogResponse {
  return {
    issues: [],
    entityData: { statuses: {}, priorities: {}, types: {}, epics: {} },
    sprints: [],
    rankCustomFieldId: 0,
    projects: [],
    canManageSprints: false,
    canCreateIssue: false,
    versionData: {
      versionsPerProject: {},
      canCreateVersion: false,
      isLinkToDevStatusVersionAvailable: false,
    },
    supportsPages: false,
    hasBulkChangePermission: false,
    issueArchivingEnabled: false,
    emptyFilterBoard: false,
    cardColorStrategy: 'none',
  } as unknown as GhBacklogResponse;
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useGhBacklogData (hook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ jiraBaseUrl: BASE });
    mockedReadSecret.mockResolvedValue(TOKEN);
    mockedUseIsActiveRoute.mockReturnValue(true);
  });

  it('does NOT call fetchBacklogData when boardId is null', async () => {
    mockedFetchBacklogData.mockResolvedValue(makeBacklogResponse());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    renderHook(() => useGhBacklogData(null), { wrapper });

    await new Promise((r) => setTimeout(r, 30));
    expect(mockedFetchBacklogData).not.toHaveBeenCalled();
  });

  it('does NOT call fetchBacklogData when route is inactive', async () => {
    mockedUseIsActiveRoute.mockReturnValue(false);
    mockedFetchBacklogData.mockResolvedValue(makeBacklogResponse());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    renderHook(() => useGhBacklogData(BOARD_ID), { wrapper });

    await new Promise((r) => setTimeout(r, 30));
    expect(mockedFetchBacklogData).not.toHaveBeenCalled();
  });

  it('does NOT call fetchBacklogData when token is missing', async () => {
    mockedReadSecret.mockResolvedValue('');
    mockedFetchBacklogData.mockResolvedValue(makeBacklogResponse());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    renderHook(() => useGhBacklogData(BOARD_ID), { wrapper });

    await new Promise((r) => setTimeout(r, 30));
    expect(mockedFetchBacklogData).not.toHaveBeenCalled();
  });

  it('calls fetchBacklogData once with (baseUrl, token, boardId) when enabled; returns raw envelope', async () => {
    const payload = makeBacklogResponse();
    mockedFetchBacklogData.mockResolvedValue(payload);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useGhBacklogData(BOARD_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mockedFetchBacklogData).toHaveBeenCalledTimes(1);
    expect(mockedFetchBacklogData).toHaveBeenCalledWith(BASE, TOKEN, BOARD_ID);
    expect(result.current.data).toBe(payload);
  });
});

describe('getGhBacklogData (imperative)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensureQueryData warms cache key ["gh-backlog", boardId] and returns the response', async () => {
    const payload = makeBacklogResponse();
    mockedFetchBacklogData.mockResolvedValue(payload);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const result = await getGhBacklogData(qc, BASE, TOKEN, BOARD_ID);
    expect(result).toBe(payload);
    expect(mockedFetchBacklogData).toHaveBeenCalledTimes(1);
    expect(mockedFetchBacklogData).toHaveBeenCalledWith(BASE, TOKEN, BOARD_ID);

    const cached = qc.getQueryData(['gh-backlog', BOARD_ID]);
    expect(cached).toBe(payload);
  });
});

describe('invalidateGhBacklogData', () => {
  it('invalidates all boards when boardId is undefined', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());

    invalidateGhBacklogData(qc);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['gh-backlog'] });
  });

  it('invalidates a specific board when boardId is provided', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());

    invalidateGhBacklogData(qc, 7);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['gh-backlog', 7] });
  });
});

describe('useGhBacklogData polling (D-02 — no refetchInterval)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ jiraBaseUrl: BASE });
    mockedReadSecret.mockResolvedValue(TOKEN);
    mockedUseIsActiveRoute.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT recur fetchBacklogData after staleTime elapses (no refetchInterval)', async () => {
    const payload = makeBacklogResponse();
    mockedFetchBacklogData.mockResolvedValue(payload);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useGhBacklogData(BOARD_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Advance virtual time past STALE_TIME_MS (30s). With no
    // refetchInterval, the fetcher must remain at exactly 1 call.
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mockedFetchBacklogData).toHaveBeenCalledTimes(1);
  });
});
