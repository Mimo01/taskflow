---
phase: 04-pm-dashboard-search
plan: "02"
subsystem: ui
tags: [react, tanstack-query, zustand, tailwind, vitest, jira, gitlab]

# Dependency graph
requires:
  - phase: 04-pm-dashboard-search
    plan: "01"
    provides: "fetchFixVersions, fetchGroupMilestones, fetchProjectTags, matchGitLabToFixVersion, Wave 0 test scaffolds"
  - phase: 02-developer-dashboard
    provides: "Dashboard index, useDashboardStore, MyTasksTab/SprintBoardTab/MrAttentionTab (unchanged dev tabs)"
provides:
  - "PmDashTab type and pmActiveTab/setPmActiveTab state in dashboard.store.ts"
  - "Role-conditional dashboard: role===pm renders PM tabs, else dev tabs unchanged"
  - "SprintProgressTab: statusCategory bucket rows (To Do/In Progress/Done) + conditional story points progress bar"
  - "WorkloadTab: per-assignee non-done issue count and points, sorted by count descending"
  - "ReleasesTab: fix version rows with exact/fuzzy/none GitLab date-matching and per-version issue counts"
  - "16 new tests GREEN across 3 PM tab files"
affects:
  - 04-pm-dashboard-search

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN cycle: failing tests committed before implementation"
    - "Shared TanStack cache key ['jira-issues', 'sprint-board', projectKey] across SprintProgressTab and WorkloadTab — no double fetch"
    - "Disabled query initial state (isLoading=false, data=undefined) causes bucket rows to render 0/0/0 before token resolves; tests must wait for actual fetch data via findByText on computed values, not label text"
    - "vi.clearAllMocks() in beforeEach clears mockResolvedValue implementations; re-establish in async beforeEach via dynamic import"
    - "fetchGroupProjects + fetchVersionIssueCounts as inline helper fns in ReleasesTab (not exported from service) to avoid bloating service files"

key-files:
  created:
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
  modified:
    - taskflow/src/stores/dashboard.store.ts
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx

key-decisions:
  - "SprintProgressTab + WorkloadTab share ['jira-issues', 'sprint-board', projectKey] TanStack cache key — zero duplicate fetches when both tabs visited in same session"
  - "findByText on computed values (e.g. '8 / 16 pts', count numbers) not bucket labels to avoid race with disabled-query initial render state"
  - "fetchGroupProjects and fetchVersionIssueCounts kept as module-private helpers in ReleasesTab — they are UI-layer concerns not reused elsewhere"
  - "vi.clearAllMocks() clears mockResolvedValue — async beforeEach with dynamic re-import required to restore mock implementations"

patterns-established:
  - "TDD RED-GREEN: Write failing tests referencing non-existent components, commit, then implement to green"
  - "PM tab test pattern: mock stronghold + jira + gitlab + releaseLinker, use async beforeEach to restore mock impls after clearAllMocks"
  - "Wait for fetch-dependent computed values in tests (not labels that render in disabled-query state)"

requirements-completed: [PM-01, PM-02, PM-03, PM-04]

# Metrics
duration: 10min
completed: 2026-03-11
---

# Phase 4 Plan 02: PM Dashboard Tabs Summary

**Three PM dashboard tabs (SprintProgressTab, WorkloadTab, ReleasesTab) with role-conditional routing and 16 passing unit tests**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-11T22:33:19Z
- **Completed:** 2026-03-11T22:43:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `dashboard.store.ts` extended with `PmDashTab` type and `pmActiveTab`/`setPmActiveTab` (default: `sprint-progress`)
- `dashboard/index.tsx` now branches on `role === 'pm'` — renders Sprint Progress / Workload / Releases tabs for PM, existing developer tabs unchanged
- `SprintProgressTab`: groups sprint issues into To Do/In Progress/Done buckets via `statusCategory.key` (with `undefined` fallback to `new`); shows story points progress bar only when at least one issue has points set
- `WorkloadTab`: groups non-done sprint issues by assignee, shows open task count and story points per assignee, sorted by count descending; shares TanStack cache key with SprintProgressTab (zero double-fetch)
- `ReleasesTab`: fetches fix versions + GitLab milestones/tags + per-version issue counts; uses `matchGitLabToFixVersion` for exact/fuzzy/none match display; fuzzy match shows dashed underline indicator
- 16 new tests GREEN (5 SprintProgress + 4 Workload + 7 Releases)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for SprintProgress and Workload** - `4382d0d` (test)
2. **Task 1 GREEN: Store extension, dashboard index, all three tab implementations** - `4e98e4f` (feat)
3. **Task 2 RED: Failing tests for ReleasesTab** - `a02f4b1` (test)

_Note: ReleasesTab implementation was part of Task 1 commit (implemented together with other tabs). Tests were RED against non-existent file, GREEN after Task 1 implementation._

## Files Created/Modified

- `taskflow/src/stores/dashboard.store.ts` — Added `PmDashTab` type, `pmActiveTab` (default `sprint-progress`), `setPmActiveTab`
- `taskflow/src/routes/dashboard/index.tsx` — Role-conditional PM vs dev tab rendering
- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` — New: bucket rows + conditional progress bar + loading/error
- `taskflow/src/routes/dashboard/WorkloadTab.tsx` — New: per-assignee non-done task/point table + empty state
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — New: fix versions with date-matched GitLab links + issue counts
- `taskflow/src/routes/dashboard/SprintProgressTab.test.tsx` — 5 real tests replacing Wave 0 stubs
- `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` — 4 real tests replacing Wave 0 stubs
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` — 7 real tests replacing Wave 0 stubs

## Decisions Made

- SprintProgressTab and WorkloadTab share the TanStack cache key `['jira-issues', 'sprint-board', projectKey]` — zero duplicate fetches when both PM tabs are visited in the same session.
- `findByText` in tests must target computed values (e.g., `'8 / 16 pts'`, bucket count numbers) not bucket label text (`'To Do'`) — the component renders bucket labels with counts `0/0/0` in the disabled-query initial state (before `jiraToken` resolves from `readSecret`), so `findByText(/to do/i)` can match in skeleton→content transition before the data render.
- `vi.clearAllMocks()` clears `mockResolvedValue` implementations. Async `beforeEach` with dynamic re-import required to restore mock implementations for each test.
- `fetchGroupProjects` and `fetchVersionIssueCounts` kept as module-private helper functions in `ReleasesTab.tsx` rather than added to the gitlab/jira service files — these are UI-layer concerns specific to the tab.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TDD test timing race: disabled-query initial render**

- **Found during:** Task 1 (SprintProgressTab TDD GREEN)
- **Issue:** Tests awaiting `findByText(/to do/i)` matched the bucket label rendered in the initial disabled-query state (jiraToken=null, isLoading=false, data=undefined → shows bucket labels with count 0). When `readSecret` resolved and jiraToken was set, the query transitioned to `isLoading=true` (skeleton). Subsequent synchronous `getByText(/in progress/i)` ran while skeleton was shown — test failed.
- **Fix:** Changed test assertions to await computed values that only appear after data fetch (`'8 / 16 pts'`, specific count numbers). These are only rendered when the query has resolved with actual data.
- **Files modified:** `SprintProgressTab.test.tsx`
- **Verification:** All 5 SprintProgressTab tests GREEN
- **Committed in:** `4e98e4f` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test fix necessary for correctness. No scope creep. Plan logic executed exactly as designed.

## Issues Encountered

- Pre-existing test failure in `MyTasksTab.test.tsx` ("renders skeleton when isLoading") was present before this plan and is out of scope. Logged to deferred items.

## Next Phase Readiness

- All three PM dashboard tabs implemented and tested
- Phase 4 Plan 03 (Search) can proceed — PM dashboard is complete
- `PmDashTab` type and store state available for any future PM-specific navigation

---
*Phase: 04-pm-dashboard-search*
*Completed: 2026-03-11*
