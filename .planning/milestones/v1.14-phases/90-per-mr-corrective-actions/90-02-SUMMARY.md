---
phase: 90-per-mr-corrective-actions
plan: 02
subsystem: ui-data-layer
tags: [tanstack-query, optimistic-update, gitlab, release-detail, vitest]

# Dependency graph
requires:
  - phase: 90-per-mr-corrective-actions
    plan: 01
    provides: updateMergeRequest, flattenGitLabError (service-layer write endpoint the mutation calls)
provides:
  - useMrFixMutation — the per-(MR, action) mutation hook Plan 03's UI consumes directly
  - MR_CHANNEL_QUERY_PREFIXES, patchMrInChannelCaches, restoreMrChannelCaches, invalidateMrChannelCaches — the three-cache-helper contract for any future MR write
affects: [90-03, 90-04 (later plans in this phase that render the retarget/assign-milestone UI on top of this hook)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-(entity, action) useMutation instance instead of one shared mutation — first precedent in this codebase for independently-pending sibling cells"
    - "Plural setQueriesData/getQueriesData prefix-matched cache API for optimistic patches across multiple windowed query-key variants whose exact suffix is unknown at the mutation site"
    - "Sticky mutation failure state held in component useState rather than mutation.error, so a background invalidateQueries/refetch sweep cannot clear it"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts
    - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.test.tsx
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx

key-decisions:
  - "Guards in useMrFixMutation's onMutate only gate the optimistic patch on projectId (per plan spec); a missing targetBranch/milestone falls back to the MR's own current value (a no-op patch) rather than writing invalid data — mutationFn's own guards still throw before any updateMergeRequest call, and onError's rollback covers the brief optimistic write either way"
  - "Task 2 fixture uses a full JiraIssue shape (id/key/fields.status/assignee/customfield_10016/issuetype) — the plan's shorthand '{ key: PROJ-1 }' fixture is insufficient because computeIssueStatusCounts (an unrelated downstream derivation in the same hook) reads fields.status.statusCategory.key and threw on the minimal shape"

requirements-completed: [MRFIX-01, MRFIX-02, MRFIX-03]

# Metrics
duration: 24min
completed: 2026-08-11
---

# Phase 90 Plan 02: Per-Cell Mutation Layer Summary

**`useMrFixMutation` — one `useMutation` instance per (MR, action) cell, with a plural prefix-matched multi-cache optimistic patch/rollback across all three MR-drift channel caches and a sticky component-state failure that survives a background refetch; the D-12 header-badge decrement is proven to fall straight out of the existing non-memoized `driftFlaggedCount` derivation.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-11T13:59:00+02:00 (approx, from prior session end)
- **Completed:** 2026-08-11T14:22:48Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `useMrFixMutation.ts` created: `MrFixAction`, `MrFixStatus`, `MR_CHANNEL_QUERY_PREFIXES`, `MrChannelSnapshots`, `patchMrInChannelCaches`, `restoreMrChannelCaches`, `invalidateMrChannelCaches`, `useMrFixMutation` — every export listed in the plan's `must_haves.artifacts` is present
- Per-cell mutation architecture: each hook call owns its own `useMutation` + local `status`/`errorMessage` state, so two cells on the same MR row (retarget, assign-milestone) can be independently pending/error at once (MRFIX-03, D-09) — proven by a dedicated "independent" test
- Optimistic patch is prefix-matched across `gitlab-all-project-mrs`, `gitlab-milestone-mrs`, `gitlab-branch-mrs` at two-element `[prefix, projectId]` granularity, never a windowed key (D-13/CR-02); rollback restores every touched entry by its own exact key
- Sticky failure (D-08): `status`/`errorMessage` live in component `useState`, proven by a test that runs `queryClient.invalidateQueries()` after a rejection and asserts both are unchanged
- Per-cell lock (D-09) and retry (D-07): a second `fire()` during `pending` does not re-call `updateMergeRequest`; a `fire()` during `error` does, and clears the error
- WR-10 guards: `projectId`/`baseUrl`/`token`/`mr.iid`/`targetBranch` (retarget)/`milestone` (assign-milestone) each throw before the service call — 6 dedicated guard tests, zero `?? 0`/`?? -1` in the file
- D-12 proven: added Test I to `useReleaseDetail.test.tsx` — `patchMrInChannelCaches` writing to the real three-element windowed `gitlab-milestone-mrs` key flips `driftFlaggedCount` 1 → 0 on the next render, with `useReleaseDetail.ts` itself untouched
- 18 new tests in `useMrFixMutation.test.tsx` + 1 new test in `useReleaseDetail.test.tsx`; full suite green (2341 passed, 0 failed); `npx tsc --noEmit` exits 0; `npx biome check ./src` confined to the known 2-error BacklogPage/BacklogRow baseline (no new files flagged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useMrFixMutation.ts — cache helpers plus the per-cell mutation hook** - `e38674dd` (feat) + `9270e86f` (style — biome format fix)
2. **Task 2: Prove the header-badge decrement path through useReleaseDetail (D-12)** - `f80d8a2e` (test)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts` - the per-(MR, action) mutation hook + three cache helpers
- `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.test.tsx` - 18 tests: cache-helper unit coverage, optimistic patch/rollback, sticky failure, per-cell lock, retry, independent concurrent instances, 6 WR-10 guard tests
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` - added `updateMergeRequest: vi.fn()` to the gitlab service mock; added Test I proving the D-12 badge decrement

## Exported Hook Surface (verbatim — Plan 03 consumes this directly)

```ts
export type MrFixAction = 'retarget' | 'assign-milestone';
export type MrFixStatus = 'idle' | 'pending' | 'error';

export const MR_CHANNEL_QUERY_PREFIXES = [
  'gitlab-all-project-mrs',
  'gitlab-milestone-mrs',
  'gitlab-branch-mrs',
] as const;

export type MrChannelSnapshots = Array<[QueryKey, GitLabMR[] | undefined]>;

export function patchMrInChannelCaches(
  queryClient: QueryClient,
  projectId: number,
  mrId: number,
  patch: Partial<GitLabMR>,
): MrChannelSnapshots;

export function restoreMrChannelCaches(queryClient: QueryClient, snapshots: MrChannelSnapshots): void;

export function invalidateMrChannelCaches(queryClient: QueryClient, projectId: number): void;

export function useMrFixMutation(args: {
  action: MrFixAction;
  mr: GitLabMR;
  projectId: number | null;
  baseUrl: string | null;
  token: string | null;
  targetBranch: string | null;
  milestone: { id: number; title: string } | null;
}): { status: MrFixStatus; errorMessage: string | null; fire: () => void };
```

Plan 03 calls `useMrFixMutation` once per BR cell (`action: 'retarget'`) and once per MS cell (`action: 'assign-milestone'`) per drift row, wires `fire` to the cell's click handler, and renders the glyph from `status`/`errorMessage` (idle → the drift `mark` from `driftDetection.ts`; pending → spinner; error → warning glyph + `errorMessage` in a tooltip, per D-06/D-07).

## Decisions Made

- Guards in `onMutate` only gate the optimistic patch on a non-null `projectId` (per the plan's explicit instruction). A missing `targetBranch`/`milestone` falls back to the MR's own current value in the patch (a no-op write) rather than writing an invalid one — `mutationFn`'s guards still throw before any `updateMergeRequest` call regardless, so no bad write ever reaches GitLab; `onError`'s rollback covers the brief optimistic patch either way.
- Task 2's Jira issue fixture needed the full `JiraIssue` shape (not the plan's shorthand `{ key: 'PROJ-1' }`) because `computeIssueStatusCounts` — an unrelated derivation computed from the same `releaseIssues` array inside `useReleaseDetail` — reads `fields.status.statusCategory.key` on every issue and threw a `TypeError` on the minimal shape. Fixed with a minimal-but-complete fixture; no change to `useReleaseDetail.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome formatting deviations in the two new Task 1 files**
- **Found during:** Task 1 pre-commit hook
- **Issue:** `restoreMrChannelCaches`'s parameter list and several long `getQueryData`/`getQueryState` call chains in the test file exceeded the configured line width, which Biome's formatter (run by the pre-commit hook) flagged as 2 errors.
- **Fix:** `npx biome format --write` on both files; re-ran the full test file + `tsc --noEmit` to confirm no behavioral change.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts`, `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.test.tsx`
- **Commit:** `9270e86f`

**2. [Rule 1 - Bug] Task 2 fixture needed full JiraIssue shape, not the plan's shorthand**
- **Found during:** Task 2, first test run
- **Issue:** The plan's action block suggested seeding `fetchFixVersionIssues` with an issue "whose `key` is `PROJ-1`" without specifying the full shape. `computeIssueStatusCounts` inside `useReleaseDetail` unconditionally reads `fields.status.statusCategory.key` for every issue in `releaseIssues`, so a bare `{ key: 'PROJ-1' }` fixture threw a `TypeError` and crashed the render (caught by React's error boundary logging, test failed on the assertion instead of the crash directly).
- **Fix:** Built a minimal-but-complete `JiraIssue` fixture (`id`, `key`, `fields.summary/status/assignee/customfield_10016/issuetype`) matching the shape other tests in the same file already use.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`
- **Commit:** `f80d8a2e`

---

**Total deviations:** 2 (both Rule 1 auto-fixes, both trivial and test-scoped)
**Impact on plan:** No scope creep. Both fixes were required to make the plan's own acceptance criteria pass and involved no production-code behavior change.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — no external service configuration required. The Phase 90 D-16 live-GitLab probe carried forward from Plan 01 remains owed (see `90-01-SUMMARY.md`); this plan's code does not depend on it.

## Known Stubs

None. Both files are fully wired: `useMrFixMutation` is a complete, tested hook ready for direct consumption; the D-12 test exercises the real `useReleaseDetail` derivation path, not a mock.

## Threat Flags

None. All threat-model dispositions for this plan's files (T-90-06 through T-90-10, T-90-SC) are satisfied as designed — see the threat-register mitigations already documented in `90-02-PLAN.md`; no new surface was introduced beyond what the plan anticipated.

## Next Phase Readiness

- `useMrFixMutation` is ready for Plan 03 to wire into the `MrDriftSection` BR/MS cells — the hook signature, cache-helper contract, and per-cell status/error reporting are all final and tested.
- No blockers for Plan 03. The D-16 probe (approval-reset behavior) remains an open, non-blocking documentation item per D-16's standing ruling: no confirm dialog, warning, or tooltip line should be added regardless of probe status.

---
*Phase: 90-per-mr-corrective-actions*
*Completed: 2026-08-11*

## Self-Check: PASSED
All created/modified files verified present on disk; all 4 commit hashes (e38674dd, 9270e86f, f80d8a2e, d01c0765) verified in git log.
