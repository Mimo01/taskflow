/**
 * The single source of truth for the three MR "channel" query keys (WR-06).
 *
 * These keys are written at TWO ends that must agree exactly: the `useQuery`
 * call sites in `useReleaseDetail.ts` that own the data, and the prefix-scoped
 * optimistic patch/invalidate in `useMrFixMutation.ts` that rewrites it. When
 * those were independent string literals, renaming a key at the query site
 * silently turned every `setQueriesData`/`getQueriesData` in the mutation into
 * a no-op — the optimistic patch would just stop working, with no type error
 * and no failing test (both test files hard-coded the same literals
 * separately). That is the same hidden-coupling bug class the mutation hook's
 * own header calls "the CR-02 bug class".
 *
 * Every producer and every consumer of these keys must go through this module.
 * Do not re-inline the literals.
 *
 * Key shape is `[prefix, projectId, <windowed suffix>]`: the suffix belongs to
 * the query site (it knows the window), while invalidation and cross-cutting
 * patches operate at the two-element `[prefix, projectId]` project granularity
 * (D-13/CR-02 lesson — never a hand-reconstructed windowed key).
 */

const ALL_PROJECT_MRS = 'gitlab-all-project-mrs';
const MILESTONE_MRS = 'gitlab-milestone-mrs';
const BRANCH_MRS = 'gitlab-branch-mrs';

/**
 * The three channel query prefixes a retarget/assign-milestone write can
 * affect. Both writes change channel membership — a retargeted MR newly
 * qualifies for Channel C, a milestone-assigned MR for Channel B — so all
 * three are always patched and invalidated together, regardless of which
 * single field changed (D-13).
 */
export const MR_CHANNEL_QUERY_PREFIXES = [ALL_PROJECT_MRS, MILESTONE_MRS, BRANCH_MRS] as const;

export type MrChannelPrefix = (typeof MR_CHANNEL_QUERY_PREFIXES)[number];

/**
 * `projectId` is `number | null | undefined` because the query sites key on
 * the store value directly (an unset project must still produce a stable,
 * distinct key rather than collapsing onto project 0).
 */
type ProjectId = number | null | undefined;

export const mrChannelKeys = {
  /** Channel A: the project's whole MR universe within `updatedAfter`. */
  allProject: (projectId: ProjectId, updatedAfter: string) =>
    [ALL_PROJECT_MRS, projectId, updatedAfter] as const,
  /** Channel B: MRs carrying the matched GitLab milestone. */
  milestone: (projectId: ProjectId, milestoneTitle: string) =>
    [MILESTONE_MRS, projectId, milestoneTitle] as const,
  /** Channel C: MRs targeting the derived release branch. */
  branch: (projectId: ProjectId, branchName: string | null) =>
    [BRANCH_MRS, projectId, branchName] as const,
  /**
   * Project-granular prefix for one channel — the ONLY form used for
   * invalidation and for prefix-matched optimistic patches.
   */
  channelForProject: (prefix: MrChannelPrefix, projectId: ProjectId) =>
    [prefix, projectId] as const,
};
