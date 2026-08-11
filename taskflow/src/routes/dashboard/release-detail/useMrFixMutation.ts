/**
 * useMrFixMutation — per-(MR, action) optimistic mutation for the two
 * per-MR corrective actions (MRFIX-01/02): retarget the MR to the release
 * branch, or assign the release milestone.
 *
 * Three deliberate departures from every existing mutation in this codebase
 * (`createBranchMutation`, `createMilestoneMutation` in useReleaseDetail.ts,
 * `useFieldMutation` in issue-detail/):
 *
 * 1. PER-INSTANCE mutation, not shared. Every prior `useMutation` in this
 *    codebase is a single shared instance whose `.isPending`/`.error`
 *    describe only the most recent call — correct for one dialog, wrong for
 *    a list where several rows' BR and MS cells must be independently,
 *    simultaneously pending (D-09, MRFIX-03). `useMrFixMutation` is called
 *    once per (MR, action) cell, so each cell owns its own mutation object.
 *
 * 2. PLURAL, prefix-matched cache API — `setQueriesData`/`getQueriesData`
 *    against the two-element `[prefix, projectId]` key, not the singular
 *    exact-key API `useFieldMutation` uses. The exact windowed suffixes
 *    (`channelAUpdatedAfter`, `gitlabMatch.candidateName`, `releaseBranchName`)
 *    are unknown at the mutation site by design; reconstructing them here
 *    would be the CR-02 bug class (a hand-rolled key silently missing the
 *    live cache entry). Both writes change channel membership — a retargeted
 *    MR newly qualifies for Channel C, a milestone-assigned MR for Channel B
 *    — so all three prefixes are patched and invalidated regardless of which
 *    action fired (D-13).
 *
 * 3. Failure state lives in COMPONENT STATE, not `mutation.error`. A 5-minute
 *    staleTime background refetch does not touch component state, so a
 *    sticky failure (D-08) survives an `invalidateQueries` sweep and clears
 *    only on a deliberate retry.
 *
 * React Compiler is on: no `useMemo`/`useCallback`/`React.memo`.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { GitLabMR } from '@/services/gitlab';
import { updateMergeRequest } from '@/services/gitlab';

export type MrFixAction = 'retarget' | 'assign-milestone';
export type MrFixStatus = 'idle' | 'pending' | 'error';

/**
 * The three channel query prefixes a retarget/assign-milestone write can
 * affect (mirrors the literals in useReleaseDetail.ts L352/L367/L385). Both
 * writes change channel membership — a retargeted MR newly qualifies for
 * Channel C, a milestone-assigned MR for Channel B — so all three are always
 * patched and invalidated together, regardless of which single field changed
 * (D-13).
 */
export const MR_CHANNEL_QUERY_PREFIXES = [
  'gitlab-all-project-mrs',
  'gitlab-milestone-mrs',
  'gitlab-branch-mrs',
] as const;

/** Snapshots of every touched windowed cache entry, keyed by its own exact key. */
export type MrChannelSnapshots = Array<[QueryKey, GitLabMR[] | undefined]>;

/**
 * Optimistically patch MR `mrId` with `patch` in every cached entry under the
 * three channel prefixes for `projectId`, regardless of the entry's windowed
 * suffix. Plural + prefix (not singular + exact key) because the windowed
 * suffixes are unknown here by design — reconstructing them would be the
 * CR-02 bug class. An absent/undefined cache entry is a no-op, not a throw;
 * a different project is never touched.
 *
 * @returns snapshots sufficient to restore every touched entry by its own exact key
 */
export function patchMrInChannelCaches(
  queryClient: QueryClient,
  projectId: number,
  mrId: number,
  patch: Partial<GitLabMR>,
): MrChannelSnapshots {
  const snapshots: MrChannelSnapshots = [];
  for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
    const entries = queryClient.getQueriesData<GitLabMR[]>({ queryKey: [prefix, projectId] });
    snapshots.push(...entries);
    queryClient.setQueriesData<GitLabMR[]>({ queryKey: [prefix, projectId] }, (list) =>
      list?.map((m) => (m.id === mrId ? { ...m, ...patch } : m)),
    );
  }
  return snapshots;
}

/**
 * Restore every snapshot entry to its own exact key — used to roll back an
 * optimistic patch after a rejected write.
 */
export function restoreMrChannelCaches(
  queryClient: QueryClient,
  snapshots: MrChannelSnapshots,
): void {
  for (const [key, data] of snapshots) {
    queryClient.setQueryData(key, data);
  }
}

/**
 * Invalidate all three channel prefixes at two-element `[prefix, projectId]`
 * project granularity — never a windowed key (D-13/CR-02 lesson).
 */
export function invalidateMrChannelCaches(queryClient: QueryClient, projectId: number): void {
  for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
    queryClient.invalidateQueries({ queryKey: [prefix, projectId] });
  }
}

interface MrFixMutationContext {
  snapshots: MrChannelSnapshots;
}

/**
 * Per-(MR, action) mutation: fires `updateMergeRequest` for either a
 * retarget or an assign-milestone write, with an optimistic multi-cache
 * patch, exact-key rollback on failure, and a sticky component-state failure
 * (D-08) independent of the mutation object's own lifecycle.
 *
 * The cache write is optimistic while the reported `status` stays `'pending'`
 * until the PUT settles — the glyph this hook backs is pessimistic by design
 * (D-06); `onSuccess` reports `'idle'`, never a success status the UI could
 * latch onto.
 */
export function useMrFixMutation(args: {
  action: MrFixAction;
  mr: GitLabMR;
  projectId: number | null;
  baseUrl: string | null;
  token: string | null;
  targetBranch: string | null;
  milestone: { id: number; title: string } | null;
}): { status: MrFixStatus; errorMessage: string | null; fire: () => void } {
  const { action, mr, projectId, baseUrl, token, targetBranch, milestone } = args;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MrFixStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation<GitLabMR, Error, void, MrFixMutationContext | undefined>({
    mutationFn: async () => {
      // WR-10: never `?? 0` / `?? -1` into a write URL — throw before the
      // service call when a required value is missing.
      if (!projectId || !baseUrl || !token) {
        throw new Error('GitLab project not configured');
      }
      if (!mr.iid) {
        throw new Error('Merge request iid unavailable');
      }
      if (action === 'retarget') {
        if (!targetBranch) throw new Error('Release branch unavailable');
        return updateMergeRequest(baseUrl, token, projectId, mr.iid, {
          target_branch: targetBranch,
        });
      }
      if (!milestone) throw new Error('Release milestone unavailable');
      return updateMergeRequest(baseUrl, token, projectId, mr.iid, {
        milestone_id: milestone.id,
      });
    },
    onMutate: async () => {
      setStatus('pending');
      setErrorMessage(null);
      for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
        await queryClient.cancelQueries({ queryKey: [prefix, projectId] });
      }
      // Guard the patch on a non-null projectId so the optimistic path
      // cannot run against project 0 (WR-10). Other guards are re-checked by
      // mutationFn, which throws before calling updateMergeRequest; when
      // targetBranch/milestone is missing the patch below falls back to the
      // MR's current value (a no-op change) rather than writing an invalid one.
      if (projectId === null || projectId === undefined) return undefined;
      const patch: Partial<GitLabMR> =
        action === 'retarget'
          ? { target_branch: targetBranch ?? mr.target_branch }
          : { milestone: milestone ?? mr.milestone };
      return { snapshots: patchMrInChannelCaches(queryClient, projectId, mr.id, patch) };
    },
    onError: (err, _vars, context) => {
      if (context?.snapshots) {
        restoreMrChannelCaches(queryClient, context.snapshots);
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update merge request');
    },
    onSuccess: () => {
      // D-06: the checkmark comes from the patched cache via the caller's
      // `mark` prop, never from mutation state — report idle, not a success
      // status the UI could latch onto.
      setStatus('idle');
    },
    onSettled: () => {
      if (projectId) invalidateMrChannelCaches(queryClient, projectId);
    },
  });

  const fire = () => {
    // Per-cell lock (D-09): the two cells on one row are separate hook
    // instances and must stay independently firable; only this instance's
    // own pending state blocks a second fire.
    if (status === 'pending') return;
    mutation.mutate();
  };

  return { status, errorMessage, fire };
}
