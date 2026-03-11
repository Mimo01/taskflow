---
phase: 02-developer-dashboard
plan: 03
subsystem: ui
tags: [dashboard, tanstack-query, link-engine, vitest, tdd, react, typescript, review-health]

# Dependency graph
requires:
  - phase: 02-developer-dashboard
    plan: 01
    provides: "linkMRToTask, linkMRToTaskViaCommits, deriveReviewHealth in linkEngine.ts; fetchMRCommits, fetchMRApprovals, fetchMRDiscussions in gitlab.ts"
  - phase: 02-developer-dashboard
    plan: 02
    provides: "TaskRow with linkedMrs slot; MrRow with linkedTask slot; TaskCard with healthDot slot; MyTasksTab/MrAttentionTab/SprintBoardTab shells"
provides:
  - "MyTasksTab: computes task→MR link map via title scan + commit fallback; fetches ReviewHealth per linked MR; passes linkedMrResults to TaskRow"
  - "MrAttentionTab: builds sprint key set from Jira query; computes MR→task reverse map; passes linkedTask + reviewHealth to MrRow"
  - "SprintBoardTab: reads gitlab-mrs cache; computes task→best-health using linkMRToTask; passes healthDot to TaskCard"
  - "TaskRow: updated to accept linkedMrResults: Array<{mr, health}>; renders MR !{iid} chips with colored health dots"
  - "MrRow: extended with reviewHealth prop; renders colored indicator dot"
  - "TaskCard: already accepted healthDot ReviewHealth — no prop change needed"
affects:
  - 02-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useQueries (TanStack v5) for parallel per-MR data fetching (commits and health)"
    - "Title-scan then commit-fallback: synchronous linkMRToTask first, useQueries for fetchMRCommits only for unlinked MRs (LINK-02 pattern)"
    - "useQueryClient().getQueryData() for cache reads in SprintBoardTab without triggering new fetches"
    - "Same ['mr-health', project_id, iid] query key in both MyTasksTab and MrAttentionTab — TanStack deduplicates automatically"
    - "Same ['gitlab-mrs', gitlabBaseUrl] query key between tabs — cache shared without double-fetching"
    - "Health priority for sprint board: changes_requested > waiting_for_review > approved (worst state wins)"

key-files:
  modified:
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/MrRow.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx

key-decisions:
  - "MrAttentionTab fetches sprint issues directly (not only from cache) — getQueryData() can return undefined if SprintBoardTab tab hasn't been visited; direct useQuery with same key ensures data is available"
  - "SprintBoardTab uses getQueryData() for health (not useQueries) — health queries are owned by MyTasksTab/MrAttentionTab; Sprint board only reads the cache, no double-fetch"
  - "TaskRow prop renamed from linkedMrs: GitLabMR[] to linkedMrResults: Array<{mr, health}> — breaking change but contained within dashboard package; Plan 02 stub passed [] so no runtime regression"
  - "Test assertion for MrRow linked task uses findAllByText (not findByText) — both the MR title text and the task badge render the same key, so multiple matches are expected and correct"

# Metrics
duration: 6min
completed: 2026-03-11
---

# Phase 2 Plan 03: Link Engine Integration Summary

**Live task-MR linking with title scan + commit fallback, health badges on MR chips and sprint board cards — 77 tests passing**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-11T13:59:32Z
- **Completed:** 2026-03-11T14:05:xx Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 7 (all modified, none created)

## Accomplishments

- Wired `linkMRToTask` (title scan) and `linkMRToTaskViaCommits` (commit fallback via `useQueries`) into MyTasksTab; unlinked MRs trigger commit fetch, linked MRs skip it (LINK-02 satisfied)
- Derived `ReviewHealth` per linked MR using `useQueries(['mr-health', ...])` — same query key in MyTasksTab and MrAttentionTab means TanStack Query deduplicates and shares the cache automatically
- Updated TaskRow to accept `linkedMrResults: Array<{mr, health}>` and render `MR !{iid}` chips with green/yellow/red health dots (approved/waiting/changes_requested)
- Extended MrRow with `reviewHealth?: ReviewHealth` prop; renders colored dot indicator
- MrAttentionTab now reads sprint issues (same query key as SprintBoardTab) to build `sprintIssueKeySet`; computes `MR → JiraIssue` reverse map; passes `linkedTask` and `reviewHealth` to each MrRow
- SprintBoardTab reads `['gitlab-mrs']` from cache and derives `task → best ReviewHealth` map; passes `healthDot` to TaskCard (gray when no MR linked)
- Added 6 new linking tests; all 77 tests pass; no TypeScript errors in dashboard files

## Task Commits

1. **Task 1 RED: Failing tests for MR linking and TaskRow health chips** - `05e69a5` (test)
2. **Task 1 GREEN: Wire link engine into dashboard UI with review health badges** - `9534048` (feat)

## Files Modified

- `taskflow/src/routes/dashboard/TaskRow.tsx` — prop renamed to `linkedMrResults`; chip renders `MR !{iid}` + health dot
- `taskflow/src/routes/dashboard/MrRow.tsx` — added `reviewHealth?: ReviewHealth` prop + colored dot
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — full link computation: title scan + commit fallback + health fetch
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — sprint issues query + reverse MR→task map + health fetch
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — cache reads for MRs + health; healthDot passed to TaskCard
- `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` — 5 new tests: linked MR chip, no MR placeholder, green/red/empty TaskRow
- `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` — 1 new test: linkedTask badge when MR title matches sprint key

## Decisions Made

- **MrAttentionTab fetches sprint issues directly**: `getQueryData()` returns `undefined` if SprintBoardTab hasn't been mounted. Used `useQuery` with the same `['jira-issues', 'sprint-board', project]` key — TanStack deduplicates so no extra fetch if already cached.
- **SprintBoardTab only reads cache for health**: Health queries are owned by the other two tabs. SprintBoardTab calls `queryClient.getQueryData(['mr-health', ...])` per MR — no new network calls; gracefully shows gray dot if health hasn't been fetched yet.
- **TaskRow prop renamed**: `linkedMrs: GitLabMR[]` → `linkedMrResults: Array<{mr, health}>`. The Plan 02 stub passed `[]` everywhere, so the rename is non-breaking at runtime. TypeScript correctly enforces the new shape.
- **findAllByText in MrAttentionTab test**: The MR title "PROJ-7 fix something" and the task badge "PROJ-7 In Progress" both match `/PROJ-7/i`, so `findByText` throws "found multiple". Used `findAllByText` and asserted `>= 2` matches — both are expected renders.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `issuetype` to test `makeIssue` factory**
- **Found during:** TypeScript check after GREEN implementation
- **Issue:** `JiraIssue.fields.issuetype` is a required property but was omitted in test helper — TS2322 errors in both test files
- **Fix:** Added `issuetype: { name: 'Story' }` and `status.id` to `makeIssue()` factories in both test files
- **Files modified:** `MyTasksTab.test.tsx`, `MrAttentionTab.test.tsx`
- **Committed in:** `9534048` (feat commit, bundled with GREEN)

**2. [Rule 1 - Bug] Fixed ambiguous test assertion for linked task badge**
- **Found during:** GREEN phase test run (test 12 of 12 failing)
- **Issue:** `findByText(/PROJ-7/i)` threw "Found multiple elements" — MR title "PROJ-7 fix something" and task badge "PROJ-7" both match
- **Fix:** Changed to `findAllByText(/PROJ-7/i)` with `expect(length).toBeGreaterThanOrEqual(2)` — asserts both the title and badge render
- **Files modified:** `MrAttentionTab.test.tsx`
- **Committed in:** `9534048`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes in tests)
**Impact on plan:** Both fixes required for TypeScript correctness and test correctness. No scope creep.

## Self-Check: PASSED

All modified files verified present and both commits confirmed in git log.

## Next Phase Readiness

- Dashboard linking is complete: TaskRow chips are live, MrRow task badges are live, TaskCard health dots work from cache
- TanStack cache sharing between tabs is proven (same query keys for gitlab-mrs and mr-health)
- LINK-02 commit fallback pattern is implemented and covered by tests
- 77 tests passing, no regressions
