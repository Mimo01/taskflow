import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchVersionsStatusBreakdown } from '@/services/jira';
import { useAuthStore } from '@/stores/auth.store';
import {
  planBreakdownChunks,
  releaseBreakdownChunkKey,
  releaseBreakdownSeedKey,
  useReleaseBreakdowns,
} from './useReleaseBreakdowns';

vi.mock('@/services/jira', () => ({ fetchVersionsStatusBreakdown: vi.fn() }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/stores/auth.store', () => ({ useAuthStore: vi.fn() }));

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const U = ['1001', '1002'];
const R = Array.from({ length: 20 }, (_, i) => String(2000 + i + 1));
const zero = { new: 0, indeterminate: 0, done: 0 };
const zeroFull = { ...zero, assignees: [] };
const alex = { key: 'alex', displayName: 'Alex Placeholder', count: 2 };

describe('planBreakdownChunks', () => {
  it('emits upcoming then first released page', () => {
    expect(planBreakdownChunks(U, R, 5)).toEqual([U, R.slice(0, 5)]);
  });
  it('adds 10-step chunks and clamps to available', () => {
    expect(planBreakdownChunks(U, R, 15)).toEqual([U, R.slice(0, 5), R.slice(5, 15)]);
    expect(planBreakdownChunks(U, R, 25)).toEqual([
      U,
      R.slice(0, 5),
      R.slice(5, 15),
      R.slice(15, 20),
    ]);
  });
  it('splits upcoming at 50 and omits empty chunks', () => {
    const up = ids('', 60);
    const c = planBreakdownChunks(up, [], 5);
    expect(c.map((x) => x.length)).toEqual([50, 10]);
    expect(planBreakdownChunks([], R, 5)).toEqual([R.slice(0, 5)]);
  });
  it('keeps earlier chunks as a strict prefix across reveals', () => {
    const a = planBreakdownChunks(U, R, 5);
    const b = planBreakdownChunks(U, R, 15);
    expect(b.slice(0, a.length)).toEqual(a);
  });
  it('sorts a copy for the chunk key', () => {
    const input = ['3', '1', '2'];
    expect(releaseBreakdownChunkKey('https://a', input)).toEqual([
      'jira-version-counts',
      'batch',
      'https://a',
      '1,2,3',
    ]);
    expect(input).toEqual(['3', '1', '2']);
  });
  it('scopes chunk and seed keys to the Jira instance', () => {
    expect(releaseBreakdownChunkKey('https://a', ['1'])).not.toEqual(
      releaseBreakdownChunkKey('https://b', ['1']),
    );
    expect(releaseBreakdownSeedKey('https://a', '1')).not.toEqual(
      releaseBreakdownSeedKey('https://b', '1'),
    );
    // Prefix invalidations (release-refresh, useEditRelease) must still reach the chunks.
    expect(releaseBreakdownChunkKey('https://a', ['1']).slice(0, 2)).toEqual([
      'jira-version-counts',
      'batch',
    ]);
  });
});

describe('useReleaseBreakdowns', () => {
  let qc: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.resetAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(useAuthStore).mockReturnValue({ jiraBaseUrl: 'https://jira.example.com' } as never);
    vi.mocked(fetchVersionsStatusBreakdown).mockImplementation(async (_b, _t, vids) =>
      Object.fromEntries(vids.map((v) => [v, { ...zeroFull, done: 1, assignees: [alex] }])),
    );
  });

  it('adds exactly one query per reveal and seeds per-version cache', async () => {
    const { result, rerender } = renderHook(
      ({ visible }) =>
        useReleaseBreakdowns({ upcomingIds: U, releasedIds: R, releasedVisible: visible }),
      { wrapper, initialProps: { visible: 5 } },
    );
    await waitFor(() => expect(result.current.breakdowns.size).toBe(7));
    expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(2);
    expect(qc.getQueryData(releaseBreakdownSeedKey('https://jira.example.com', U[0]))).toEqual({
      ...zero,
      done: 1,
    });

    rerender({ visible: 15 });
    await waitFor(() => expect(result.current.breakdowns.size).toBe(17));
    expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetchVersionsStatusBreakdown).mock.calls[2][2]).toEqual(R.slice(5, 15));
    expect(result.current.breakdowns.has(R[15])).toBe(false);
  });

  it('reports loading while in flight, then moves ids to breakdowns', async () => {
    let resolve: (v: Record<string, typeof zeroFull>) => void = () => {};
    vi.mocked(fetchVersionsStatusBreakdown).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(
      () => useReleaseBreakdowns({ upcomingIds: U, releasedIds: [], releasedVisible: 5 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loadingIds.size).toBe(2));
    expect(result.current.breakdowns.size).toBe(0);
    resolve({ '1001': zeroFull, '1002': zeroFull });
    await waitFor(() => expect(result.current.breakdowns.size).toBe(2));
    expect(result.current.loadingIds.size).toBe(0);
  });

  it('puts only the failing chunk ids in errorIds', async () => {
    vi.mocked(fetchVersionsStatusBreakdown).mockImplementation(async (_b, _t, vids) => {
      if (vids[0] === U[0]) throw new Error('boom');
      return Object.fromEntries(vids.map((v) => [v, zeroFull]));
    });
    const { result } = renderHook(
      () => useReleaseBreakdowns({ upcomingIds: U, releasedIds: R, releasedVisible: 5 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.errorIds.size).toBe(2));
    await waitFor(() => expect(result.current.breakdowns.size).toBe(5));
  });

  it('does nothing without a jira base url', async () => {
    vi.mocked(useAuthStore).mockReturnValue({ jiraBaseUrl: null } as never);
    const { result } = renderHook(
      () => useReleaseBreakdowns({ upcomingIds: U, releasedIds: R, releasedVisible: 5 }),
      { wrapper },
    );
    expect(result.current.loadingIds.size).toBe(0);
    expect(fetchVersionsStatusBreakdown).not.toHaveBeenCalled();
  });

  it('with releasedFirstPage 3 fetches exactly 3 released ids, then one chunk per reveal', async () => {
    const { result, rerender } = renderHook(
      ({ visible }) =>
        useReleaseBreakdowns({
          upcomingIds: U,
          releasedIds: R,
          releasedVisible: visible,
          releasedFirstPage: 3,
        }),
      { wrapper, initialProps: { visible: 3 } },
    );
    await waitFor(() => expect(result.current.breakdowns.size).toBe(5));
    expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchVersionsStatusBreakdown).mock.calls[1][2]).toEqual(R.slice(0, 3));

    rerender({ visible: 13 });
    await waitFor(() => expect(result.current.breakdowns.size).toBe(15));
    expect(fetchVersionsStatusBreakdown).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetchVersionsStatusBreakdown).mock.calls[2][2]).toEqual(R.slice(3, 13));
  });

  it('exposes teams per version and keeps breakdowns and the seed counts-only', async () => {
    const { result } = renderHook(
      () => useReleaseBreakdowns({ upcomingIds: U, releasedIds: [], releasedVisible: 5 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.teams.size).toBe(2));
    expect(result.current.teams.get(U[0])).toEqual([alex]);
    expect(result.current.breakdowns.get(U[0])).toEqual({ ...zero, done: 1 });
    expect(qc.getQueryData(releaseBreakdownSeedKey('https://jira.example.com', U[0]))).toEqual({
      ...zero,
      done: 1,
    });
  });

  it('tolerates old-shape results without assignees', async () => {
    vi.mocked(fetchVersionsStatusBreakdown).mockImplementation((async (
      _b: string,
      _t: string,
      vids: string[],
    ) => Object.fromEntries(vids.map((v) => [v, zero]))) as never);
    const { result } = renderHook(
      () => useReleaseBreakdowns({ upcomingIds: U, releasedIds: [], releasedVisible: 5 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.breakdowns.size).toBe(2));
    expect(result.current.teams.get(U[0])).toEqual([]);
  });
});
