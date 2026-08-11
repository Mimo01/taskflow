// MRFIX-01/02/03: coverage for the per-(MR, action) optimistic mutation hook —
// prefix-scoped patch, exact-key rollback, sticky local failure, per-cell
// locking, independent concurrent instances, and project-granular invalidation.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import {
  invalidateMrChannelCaches,
  MR_CHANNEL_QUERY_PREFIXES,
  patchMrInChannelCaches,
  restoreMrChannelCaches,
  useMrFixMutation,
} from './useMrFixMutation';

vi.mock('@/services/gitlab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/gitlab')>()),
  updateMergeRequest: vi.fn(),
}));

const PROJECT_ID = 42;
const OTHER_PROJECT_ID = 99;

function makeMr(overrides: Partial<GitLabMR> = {}): GitLabMR {
  return {
    id: 7,
    iid: 100,
    project_id: PROJECT_ID,
    title: 'PROJ-1 fix thing',
    source_branch: 'feature/proj-1',
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

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** Seed all three channel prefixes with a genuinely windowed (three-element) key. */
function seedChannelCaches(queryClient: QueryClient, mrs: GitLabMR[]) {
  queryClient.setQueryData(['gitlab-all-project-mrs', PROJECT_ID, '2026-01-01T00:00:00.000Z'], mrs);
  queryClient.setQueryData(['gitlab-milestone-mrs', PROJECT_ID, '33.5.0 (21.07.2026)'], mrs);
  queryClient.setQueryData(['gitlab-branch-mrs', PROJECT_ID, 'release/33.5.0'], mrs);
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('useMrFixMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cache helpers', () => {
    it('patchMrInChannelCaches patches the target MR across all three windowed prefixes for the project, leaving other MRs and other projects untouched', () => {
      const queryClient = makeQueryClient();
      const targetMr = makeMr({ id: 7, target_branch: 'develop' });
      const otherMr = makeMr({ id: 8, target_branch: 'develop' });
      seedChannelCaches(queryClient, [targetMr, otherMr]);
      queryClient.setQueryData(
        ['gitlab-all-project-mrs', OTHER_PROJECT_ID, '2026-01-01T00:00:00.000Z'],
        [makeMr({ id: 7, project_id: OTHER_PROJECT_ID, target_branch: 'develop' })],
      );

      patchMrInChannelCaches(queryClient, PROJECT_ID, 7, { target_branch: 'release/33.5.0' });

      for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
        const entries = queryClient.getQueriesData<GitLabMR[]>({ queryKey: [prefix, PROJECT_ID] });
        for (const [, data] of entries) {
          const patched = data?.find((m) => m.id === 7);
          const untouched = data?.find((m) => m.id === 8);
          expect(patched?.target_branch).toBe('release/33.5.0');
          expect(untouched?.target_branch).toBe('develop');
        }
      }

      const otherProjectData = queryClient.getQueryData<GitLabMR[]>([
        'gitlab-all-project-mrs',
        OTHER_PROJECT_ID,
        '2026-01-01T00:00:00.000Z',
      ]);
      expect(otherProjectData?.[0]?.target_branch).toBe('develop');
    });

    it('patchMrInChannelCaches is a no-op, not a throw, when a cache entry is absent', () => {
      const queryClient = makeQueryClient();
      expect(() =>
        patchMrInChannelCaches(queryClient, PROJECT_ID, 7, { target_branch: 'release/33.5.0' }),
      ).not.toThrow();
    });

    it('restoreMrChannelCaches restores every windowed key to its exact pre-patch value', () => {
      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7, target_branch: 'develop' });
      seedChannelCaches(queryClient, [mr]);

      const before = MR_CHANNEL_QUERY_PREFIXES.map((prefix) =>
        prefix === 'gitlab-all-project-mrs'
          ? queryClient.getQueryData([
              'gitlab-all-project-mrs',
              PROJECT_ID,
              '2026-01-01T00:00:00.000Z',
            ])
          : prefix === 'gitlab-milestone-mrs'
            ? queryClient.getQueryData(['gitlab-milestone-mrs', PROJECT_ID, '33.5.0 (21.07.2026)'])
            : queryClient.getQueryData(['gitlab-branch-mrs', PROJECT_ID, 'release/33.5.0']),
      );

      const snapshots = patchMrInChannelCaches(queryClient, PROJECT_ID, 7, {
        target_branch: 'release/33.5.0',
      });
      restoreMrChannelCaches(queryClient, snapshots);

      expect(
        queryClient.getQueryData([
          'gitlab-all-project-mrs',
          PROJECT_ID,
          '2026-01-01T00:00:00.000Z',
        ]),
      ).toEqual(before[0]);
      expect(
        queryClient.getQueryData(['gitlab-milestone-mrs', PROJECT_ID, '33.5.0 (21.07.2026)']),
      ).toEqual(before[1]);
      expect(queryClient.getQueryData(['gitlab-branch-mrs', PROJECT_ID, 'release/33.5.0'])).toEqual(
        before[2],
      );
    });

    it('invalidateMrChannelCaches invalidates the project-granular key for all three prefixes, each at two-element length', () => {
      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7 });
      seedChannelCaches(queryClient, [mr]);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      invalidateMrChannelCaches(queryClient, PROJECT_ID);

      expect(invalidateSpy).toHaveBeenCalledTimes(3);
      for (const call of invalidateSpy.mock.calls) {
        const key = call[0]?.queryKey as unknown[] | undefined;
        expect(Array.isArray(key)).toBe(true);
        expect((key as unknown[]).length).toBeLessThanOrEqual(2);
      }
      for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [prefix, PROJECT_ID] });
      }

      expect(
        queryClient.getQueryState([
          'gitlab-all-project-mrs',
          PROJECT_ID,
          '2026-01-01T00:00:00.000Z',
        ])?.isInvalidated,
      ).toBe(true);
      expect(
        queryClient.getQueryState(['gitlab-milestone-mrs', PROJECT_ID, '33.5.0 (21.07.2026)'])
          ?.isInvalidated,
      ).toBe(true);
      expect(
        queryClient.getQueryState(['gitlab-branch-mrs', PROJECT_ID, 'release/33.5.0'])
          ?.isInvalidated,
      ).toBe(true);
    });
  });

  describe('useMrFixMutation hook', () => {
    it('reports idle before any call', async () => {
      const queryClient = makeQueryClient();
      const mr = makeMr();
      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.errorMessage).toBeNull();
    });

    it('retarget: patches target_branch optimistically while pending, then invalidates the three channel prefixes on success', async () => {
      const gitlab = await import('@/services/gitlab');
      vi.mocked(gitlab.updateMergeRequest).mockResolvedValue(
        makeMr({ target_branch: 'release/33.5.0' }),
      );

      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7, target_branch: 'develop' });
      seedChannelCaches(queryClient, [mr]);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());

      await waitFor(() => expect(result.current.status).toBe('pending'));
      // Optimistic cache, pessimistic status (D-06): patched while still pending.
      const patchedDuringPending = queryClient.getQueryData<GitLabMR[]>([
        'gitlab-branch-mrs',
        PROJECT_ID,
        'release/33.5.0',
      ]);
      expect(patchedDuringPending?.[0]?.target_branch).toBe('release/33.5.0');

      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.errorMessage).toBeNull();
      expect(gitlab.updateMergeRequest).toHaveBeenCalledWith(
        'https://gitlab.example.com',
        'test-token',
        PROJECT_ID,
        100,
        { target_branch: 'release/33.5.0' },
      );

      const invalidatedPrefixes = invalidateSpy.mock.calls
        .map((call) => call[0]?.queryKey as unknown[] | undefined)
        .filter((k): k is unknown[] => Array.isArray(k));
      for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
        expect(invalidatedPrefixes).toContainEqual([prefix, PROJECT_ID]);
      }
    });

    it('assign milestone: patches milestone to {id,title} and sends milestone_id in the request', async () => {
      const gitlab = await import('@/services/gitlab');
      vi.mocked(gitlab.updateMergeRequest).mockResolvedValue(
        makeMr({ milestone: { id: 55, title: '33.5.0 (21.07.2026)' } }),
      );

      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7, milestone: null });
      seedChannelCaches(queryClient, [mr]);

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'assign-milestone',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: null,
            milestone: { id: 55, title: '33.5.0 (21.07.2026)' },
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());

      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(gitlab.updateMergeRequest).toHaveBeenCalledWith(
        'https://gitlab.example.com',
        'test-token',
        PROJECT_ID,
        100,
        { milestone_id: 55 },
      );

      const patched = queryClient.getQueryData<GitLabMR[]>([
        'gitlab-milestone-mrs',
        PROJECT_ID,
        '33.5.0 (21.07.2026)',
      ]);
      expect(patched?.[0]?.milestone).toEqual({ id: 55, title: '33.5.0 (21.07.2026)' });
    });

    it('on rejection: rolls back the cache to its pre-call contents, reports error with the thrown message, and still invalidates the three prefixes', async () => {
      const gitlab = await import('@/services/gitlab');
      vi.mocked(gitlab.updateMergeRequest).mockRejectedValue(new Error('protected branch'));

      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7, target_branch: 'develop' });
      seedChannelCaches(queryClient, [mr]);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());

      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.errorMessage).toBe('protected branch');

      const restored = queryClient.getQueryData<GitLabMR[]>([
        'gitlab-branch-mrs',
        PROJECT_ID,
        'release/33.5.0',
      ]);
      expect(restored?.[0]?.target_branch).toBe('develop');

      const invalidatedPrefixes = invalidateSpy.mock.calls
        .map((call) => call[0]?.queryKey as unknown[] | undefined)
        .filter((k): k is unknown[] => Array.isArray(k));
      for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
        expect(invalidatedPrefixes).toContainEqual([prefix, PROJECT_ID]);
      }
    });

    it('sticky failure: an invalidateQueries sweep and refetch after a rejection leaves status and errorMessage unchanged (D-08)', async () => {
      const gitlab = await import('@/services/gitlab');
      vi.mocked(gitlab.updateMergeRequest).mockRejectedValue(new Error('protected branch'));

      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7, target_branch: 'develop' });
      seedChannelCaches(queryClient, [mr]);

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.errorMessage).toBe('protected branch');

      await act(async () => {
        await queryClient.invalidateQueries();
      });

      // Status/errorMessage live in component state — a background
      // invalidate/refetch sweep must not clear them.
      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('protected branch');
    });

    it('per-cell lock: a second fire() while pending does not call updateMergeRequest again', async () => {
      const gitlab = await import('@/services/gitlab');
      let resolveFn: (mr: GitLabMR) => void = () => {};
      vi.mocked(gitlab.updateMergeRequest).mockImplementation(
        () =>
          new Promise<GitLabMR>((resolve) => {
            resolveFn = resolve;
          }),
      );

      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7 });
      seedChannelCaches(queryClient, [mr]);

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('pending'));

      act(() => result.current.fire());
      act(() => result.current.fire());

      expect(vi.mocked(gitlab.updateMergeRequest).mock.calls.length).toBe(1);

      act(() => resolveFn(mr));
      await waitFor(() => expect(result.current.status).toBe('idle'));
    });

    it('retry: fire() while status is error calls updateMergeRequest again and clears the error (D-07)', async () => {
      const gitlab = await import('@/services/gitlab');
      vi.mocked(gitlab.updateMergeRequest)
        .mockRejectedValueOnce(new Error('protected branch'))
        .mockResolvedValueOnce(makeMr({ target_branch: 'release/33.5.0' }));

      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7, target_branch: 'develop' });
      seedChannelCaches(queryClient, [mr]);

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('idle'));

      expect(result.current.errorMessage).toBeNull();
      expect(vi.mocked(gitlab.updateMergeRequest).mock.calls.length).toBe(2);
    });

    it('independent: two hook instances for the same MR (retarget + assign-milestone) can be in flight with independent status', async () => {
      const gitlab = await import('@/services/gitlab');
      vi.mocked(gitlab.updateMergeRequest).mockImplementation(
        async (_baseUrl, _token, _pid, _iid, fields) => {
          if ('target_branch' in fields) throw new Error('retarget failed');
          return makeMr({ milestone: { id: 55, title: '33.5.0 (21.07.2026)' } });
        },
      );

      const queryClient = makeQueryClient();
      const mr = makeMr({ id: 7, target_branch: 'develop', milestone: null });
      seedChannelCaches(queryClient, [mr]);

      const { result: retargetResult } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );
      const { result: msResult } = renderHook(
        () =>
          useMrFixMutation({
            action: 'assign-milestone',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: null,
            milestone: { id: 55, title: '33.5.0 (21.07.2026)' },
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => {
        retargetResult.current.fire();
        msResult.current.fire();
      });

      await waitFor(() => expect(retargetResult.current.status).toBe('error'));
      await waitFor(() => expect(msResult.current.status).toBe('idle'));

      expect(retargetResult.current.errorMessage).toBe('retarget failed');
      expect(msResult.current.errorMessage).toBeNull();
    });

    it('guard: a null projectId surfaces an error without calling updateMergeRequest', async () => {
      const gitlab = await import('@/services/gitlab');
      const queryClient = makeQueryClient();
      const mr = makeMr();

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: null,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(gitlab.updateMergeRequest).not.toHaveBeenCalled();
    });

    it('guard: a null baseUrl surfaces an error without calling updateMergeRequest', async () => {
      const gitlab = await import('@/services/gitlab');
      const queryClient = makeQueryClient();
      const mr = makeMr();

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: null,
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(gitlab.updateMergeRequest).not.toHaveBeenCalled();
    });

    it('guard: a null token surfaces an error without calling updateMergeRequest', async () => {
      const gitlab = await import('@/services/gitlab');
      const queryClient = makeQueryClient();
      const mr = makeMr();

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: null,
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(gitlab.updateMergeRequest).not.toHaveBeenCalled();
    });

    it('guard: a falsy mr.iid surfaces an error without calling updateMergeRequest', async () => {
      const gitlab = await import('@/services/gitlab');
      const queryClient = makeQueryClient();
      const mr = makeMr({ iid: 0 });

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: 'release/33.5.0',
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(gitlab.updateMergeRequest).not.toHaveBeenCalled();
    });

    it('guard: a null targetBranch for retarget surfaces an error without calling updateMergeRequest', async () => {
      const gitlab = await import('@/services/gitlab');
      const queryClient = makeQueryClient();
      const mr = makeMr();

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'retarget',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: null,
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(gitlab.updateMergeRequest).not.toHaveBeenCalled();
    });

    it('guard: a null milestone for assign-milestone surfaces an error without calling updateMergeRequest', async () => {
      const gitlab = await import('@/services/gitlab');
      const queryClient = makeQueryClient();
      const mr = makeMr();

      const { result } = renderHook(
        () =>
          useMrFixMutation({
            action: 'assign-milestone',
            mr,
            projectId: PROJECT_ID,
            baseUrl: 'https://gitlab.example.com',
            token: 'test-token',
            targetBranch: null,
            milestone: null,
          }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => result.current.fire());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(gitlab.updateMergeRequest).not.toHaveBeenCalled();
    });
  });
});
