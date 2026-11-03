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

import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { GitLabMR } from '@/services/gitlab';
import { updateMergeRequest } from '@/services/gitlab';
import { MR_CHANNEL_QUERY_PREFIXES, mrChannelKeys } from './mrChannelKeys';

export type MrFixAction = 'retarget' | 'assign-milestone';
export type MrFixStatus = 'idle' | 'pending' | 'error';

/**
 * Re-exported for the existing import sites. The literals themselves live in
 * `mrChannelKeys.ts` alongside the query-site key factories (WR-06) — they
 * used to be re-declared here, so renaming a key in `useReleaseDetail.ts`
 * turned every patch below into a silent no-op with no type error.
 */
export { MR_CHANNEL_QUERY_PREFIXES };

/**
 * The only two fields this feature is allowed to write into a cached MR
 * (WR-07).
 *
 * Deliberately NOT `Partial<GitLabMR>`: that accepted any field, and — because
 * a spread copies keys that are *present with an `undefined` value* — let a
 * caller writing `{ target_branch: someNullable ?? undefined }` erase a
 * NON-optional field of `GitLabMR` in the cache. `evaluateBranchDrift` then
 * compares `undefined !== releaseBranchName` and flags every row on the
 * release. `patchMrInChannelCaches` additionally strips undefined-valued keys
 * before spreading, so that call shape is a no-op instead of a corruption.
 */
export type MrFixPatch = {
  target_branch?: string;
  milestone?: GitLabMR['milestone'];
  title?: string;
};

/**
 * Optimistically patch MR `mrId` with `patch` in every cached entry under the
 * three channel prefixes for `projectId`, regardless of the entry's windowed
 * suffix. Plural + prefix (not singular + exact key) because the windowed
 * suffixes are unknown here by design — reconstructing them would be the
 * CR-02 bug class. An absent/undefined cache entry is a no-op, not a throw;
 * a different project is never touched.
 *
 * FIELD-SCOPED BY CONSTRUCTION (CR-01): this writes only the keys present in
 * `patch`, onto whatever the cache holds RIGHT NOW, and only for `mrId`. It
 * deliberately does NOT snapshot or restore whole `GitLabMR[]` arrays — an
 * earlier version did, and a rejected write then reverted a *different*
 * in-flight cell's already-successful optimistic patch (BR's rollback undoing
 * MS's write on the same row), which is exactly the cross-(MR, action) state
 * leak D-09/MRFIX-03 forbids. Rollback is therefore an INVERSE PATCH through
 * this same function (see `onError` below), never a whole-array restore.
 */
export function patchMrInChannelCaches(
  queryClient: QueryClient,
  projectId: number,
  mrId: number,
  patch: MrFixPatch,
): void {
  // WR-07: `{ ...m, ...patch }` copies keys that are present with an
  // `undefined` value, which would blank a required field. Drop them first —
  // an all-undefined patch is a no-op, never a corruption. `null` is a real
  // value here (an unassigned milestone) and is kept.
  const defined = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (defined.length === 0) return;
  const safePatch = Object.fromEntries(defined) as MrFixPatch;

  for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
    queryClient.setQueriesData<GitLabMR[]>(
      { queryKey: mrChannelKeys.channelForProject(prefix, projectId) },
      (list) => list?.map((m) => (m.id === mrId ? { ...m, ...safePatch } : m)),
    );
  }
}

/**
 * Invalidate all three channel prefixes at two-element `[prefix, projectId]`
 * project granularity — never a windowed key (D-13/CR-02 lesson).
 */
export function invalidateMrChannelCaches(queryClient: QueryClient, projectId: number): void {
  for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
    queryClient.invalidateQueries({ queryKey: mrChannelKeys.channelForProject(prefix, projectId) });
  }
}

interface MrFixMutationContext {
  /**
   * The single field THIS (MR, action) pair overwrote, at its pre-patch value
   * — i.e. the inverse of the optimistic patch. Re-applying it on failure
   * restores only this field on only this MR, leaving every other field (the
   * sibling BR/MS cell's write) and every other row untouched (CR-01).
   */
  previous: MrFixPatch;
}

type MrFixWriteArgs = {
  action: MrFixAction;
  mr: GitLabMR;
  projectId: number | null;
  baseUrl: string | null;
  token: string | null;
  targetBranch: string | null;
  milestone: { id: number; title: string } | null;
};

/**
 * The single GitLab write behind both hooks. WR-10: never `?? 0` / `?? -1`
 * into a write URL — throw before the service call when a required value is
 * missing.
 */
function writeMrFix({
  action,
  mr,
  projectId,
  baseUrl,
  token,
  targetBranch,
  milestone,
}: MrFixWriteArgs): Promise<GitLabMR> {
  if (!projectId || !baseUrl || !token) {
    return Promise.reject(new Error('GitLab project not configured'));
  }
  if (!mr.iid) return Promise.reject(new Error('Merge request iid unavailable'));
  if (action === 'retarget') {
    if (!targetBranch) return Promise.reject(new Error('Release branch unavailable'));
    return updateMergeRequest(baseUrl, token, projectId, mr.iid, { target_branch: targetBranch });
  }
  if (!milestone) return Promise.reject(new Error('Release milestone unavailable'));
  return updateMergeRequest(baseUrl, token, projectId, mr.iid, { milestone_id: milestone.id });
}

/** The optimistic patch an action writes, and its inverse (CR-01: one field only). */
function fixPatches(
  action: MrFixAction,
  mr: GitLabMR,
  targetBranch: string | null,
  milestone: { id: number; title: string } | null,
): { patch: MrFixPatch; previous: MrFixPatch } {
  return action === 'retarget'
    ? {
        patch: { target_branch: targetBranch ?? mr.target_branch },
        previous: { target_branch: mr.target_branch },
      }
    : {
        patch: { milestone: milestone ?? mr.milestone },
        previous: { milestone: mr.milestone },
      };
}

/**
 * Per-(MR, action) mutation: fires `updateMergeRequest` for either a
 * retarget or an assign-milestone write, with an optimistic multi-cache
 * patch, a field-scoped inverse-patch rollback on failure, and a sticky
 * component-state failure (D-08) independent of the mutation object's own
 * lifecycle.
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
}): {
  status: MrFixStatus;
  errorMessage: string | null;
  fire: () => void;
  reset: () => void;
} {
  const { action, mr, projectId, baseUrl, token, targetBranch, milestone } = args;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MrFixStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation<GitLabMR, Error, void, MrFixMutationContext | undefined>({
    mutationFn: () =>
      writeMrFix({ action, mr, projectId, baseUrl, token, targetBranch, milestone }),
    onMutate: async () => {
      setStatus('pending');
      setErrorMessage(null);
      for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
        await queryClient.cancelQueries({
          queryKey: mrChannelKeys.channelForProject(prefix, projectId),
        });
      }
      // One falsy-projectId convention across this whole file (WR-03): the
      // same `!projectId` test `mutationFn` throws on and `onSettled`
      // invalidates on. The old `=== null || === undefined` form let project
      // 0 through here while both of those rejected it — the one combination
      // that patches the caches and then never invalidates them, stranding
      // the optimistic write. (`=== undefined` was dead anyway: the prop type
      // is `number | null`.) Other guards are re-checked by mutationFn, which
      // throws before calling updateMergeRequest; when targetBranch/milestone
      // is missing the patch below falls back to the MR's current value (a
      // no-op change) rather than writing an invalid one.
      if (!projectId) return undefined;
      // CR-01: capture ONLY the field this action owns, so the rollback below
      // is an inverse patch rather than a whole-array restore.
      const { patch, previous } = fixPatches(action, mr, targetBranch, milestone);
      patchMrInChannelCaches(queryClient, projectId, mr.id, patch);
      return { previous };
    },
    onError: (err, _vars, context) => {
      // CR-01: re-apply the inverse patch on the CURRENT cache. Any write that
      // landed since this mutation started — notably the sibling cell's
      // successful write on this same row — survives, because only the one
      // field this action changed is written back.
      if (context?.previous && projectId) {
        patchMrInChannelCaches(queryClient, projectId, mr.id, context.previous);
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

  /**
   * Clear a sticky failure WITHOUT firing a write (WR-08). D-08 keeps a
   * failure on screen through background refetches precisely because the
   * cache cannot vouch for it — but once the cache says this field is now
   * correct, the red "click to retry" affordance is stale and the only way
   * out of it would be another pointless write. The caller drops the error
   * when its `mark` turns 'ok'. Never call this while pending: it would
   * desync `status` from the in-flight mutation.
   */
  const reset = () => {
    if (status === 'pending') return;
    setStatus('idle');
    setErrorMessage(null);
  };

  return { status, errorMessage, fire, reset };
}

/**
 * Group fix (task row with several MRs): apply ONE action to every MR in
 * `mrs` at once — retarget them all, or assign the milestone to them all.
 *
 * Same contract as `useMrFixMutation`, per MR: optimistic field-scoped patch,
 * inverse-patch rollback for exactly the MRs whose write failed (the ones that
 * succeeded keep their patch), sticky component-state failure, project-level
 * invalidation once everything settles. Writes run in parallel; one failing
 * MR never blocks the others. A retry re-fires over the caller's CURRENT
 * `mrs` — after a partial failure that is just the ones still flagged.
 */
export function useMrGroupFix(args: Omit<MrFixWriteArgs, 'mr'> & { mrs: GitLabMR[] }): {
  status: MrFixStatus;
  errorMessage: string | null;
  fire: () => void;
  reset: () => void;
} {
  const { action, mrs, projectId, targetBranch, milestone } = args;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MrFixStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const run = async (targets: GitLabMR[]) => {
    setStatus('pending');
    setErrorMessage(null);
    if (projectId) {
      for (const prefix of MR_CHANNEL_QUERY_PREFIXES) {
        await queryClient.cancelQueries({
          queryKey: mrChannelKeys.channelForProject(prefix, projectId),
        });
      }
    }
    const inverses = targets.map((mr) => {
      const { patch, previous } = fixPatches(action, mr, targetBranch, milestone);
      if (projectId) patchMrInChannelCaches(queryClient, projectId, mr.id, patch);
      return previous;
    });
    const results = await Promise.allSettled(targets.map((mr) => writeMrFix({ ...args, mr })));
    const failures: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') return;
      if (projectId) patchMrInChannelCaches(queryClient, projectId, targets[i].id, inverses[i]);
      const msg = r.reason instanceof Error ? r.reason.message : 'Failed to update merge request';
      failures.push(`!${targets[i].iid}: ${msg}`);
    });
    if (projectId) invalidateMrChannelCaches(queryClient, projectId);
    if (failures.length === 0) {
      setStatus('idle');
      return;
    }
    setStatus('error');
    setErrorMessage(`${failures.length} of ${targets.length} failed — ${failures.join('; ')}`);
  };

  const fire = () => {
    if (status === 'pending' || mrs.length === 0) return;
    void run(mrs);
  };

  const reset = () => {
    if (status === 'pending') return;
    setStatus('idle');
    setErrorMessage(null);
  };

  return { status, errorMessage, fire, reset };
}
