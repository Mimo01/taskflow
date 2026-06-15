---
phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
plan: "01"
subsystem: dashboard
tags: [dashboard, my-issues, releases, sprint-progress, timeline, tanstack-query]
dependency_graph:
  requires: []
  provides:
    - MyIssuesCard (props-only segmented-bar sprint-progress card)
    - UpcomingReleasesTimeline (props-only 3-dot release timeline card)
  affects:
    - taskflow/src/routes/dashboard/index.tsx (will compose these in Plan 03)
tech_stack:
  added: []
  patterns:
    - warm-cache read via shared TanStack Query keys (zero new network calls)
    - statusCategory bucketing for issue counts (not story points)
    - useQueries parallel per-release fetches
    - useDelayedLoading 200ms skeleton gate
    - filterNonSubtasks + displayName filter for personal issues
    - getReleaseTimingLabel lifted verbatim from DashboardReleaseCard
    - formatTimingLabel render layer with Tomorrow/Today/overdue/in-N-days
    - Math.min(100,...) donePct clamp (T-86-02 STRIDE mitigation)
key_files:
  created:
    - taskflow/src/routes/dashboard/MyIssuesCard.tsx
    - taskflow/src/routes/dashboard/MyIssuesCard.test.tsx
    - taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx
    - taskflow/src/routes/dashboard/UpcomingReleasesTimeline.test.tsx
  modified: []
decisions:
  - mockQuery/mockQueriesResult helpers for type-safe vi.fn() mocks (no explicit any — project constraint)
  - node_modules symlink from worktree to main repo for test runner access
metrics:
  duration_minutes: 8
  completed: "2026-06-15T21:17:17Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
  tests_added: 23
---

# Phase 86 Plan 01: MyIssuesCard + UpcomingReleasesTimeline Summary

Props-only sprint-progress and release-timeline cards sharing existing TanStack Query cache keys with zero new network calls.

## What Was Built

### Task 1: MyIssuesCard (commit `2223a09d`)

`taskflow/src/routes/dashboard/MyIssuesCard.tsx` — props-only card (D-16) that displays personal sprint progress as a segmented horizontal bar. Receives `jiraBaseUrl`, `jiraToken`, `activeJiraProject`, `storyPointsFieldKey`, `jiraUserDisplayName` from `index.tsx`.

Key implementation details:
- Reuses VERBATIM cache key `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` — same key as `SprintHealthSection` and the sprint board tab; zero new network calls
- Derives counts via `filterNonSubtasks()` (imported from `dashboardMetrics`) then `.filter(displayName === me)` then buckets by `statusCategory?.key`: `'new'`→toDo, `'indeterminate'`→inProgress, `'done'`→done
- D-03 invariant: issue counts (not story points); unknown statusCategory keys fall through all buckets so sum always equals total (T-86-03)
- D-05: total === 0 renders EmptyState "No issues assigned" (never ErrorState)
- Segmented bar: `role="img"` with aria-label encoding all three counts (T-86-01 — all strings rendered as plain text, no `dangerouslySetInnerHTML`)
- Degradation: useDelayedLoading(isLoading) → 3-line skeleton; error → ErrorState; total===0 → EmptyState; else data view

`taskflow/src/routes/dashboard/MyIssuesCard.test.tsx` — 10 tests:
- D-03 pure unit invariant: `toDo + inProgress + done === myNonSubtasks.length` for mixed fixtures
- D-05: empty state renders when no issues match displayName; no `role="alert"` present
- Render: big done number, "of N done" annotation, segmented bar role=img, legend items, subtask exclusion
- Accessibility: role="region" aria-label="My issues this sprint"

### Task 2: UpcomingReleasesTimeline (commit `981382a9`)

`taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx` — props-only card (D-16) that renders up to 3 upcoming unreleased fix versions as a horizontal timeline with readiness bars.

Key implementation details:
- Reuses VERBATIM cache key `['jira-fix-versions',activeJiraProject]` — same as `ReleasesTab` and `DashboardReleaseCard`
- Per-release issues fetched via `useQueries` with VERBATIM key `['jira-release-issues',activeJiraProject,v.name]`
- D-06: filter `!released && !!releaseDate`, then ascending `localeCompare` sort (soonest first), then `.slice(0,3)`
- D-08: renders only what exists (1, 2, or 3 dots) — no placeholder dots
- `getReleaseTimingLabel` lifted VERBATIM from `DashboardReleaseCard` (timezone-safe, returns `'overdue'|'due-today'|{daysUntil}|null`)
- `formatTimingLabel` render layer adds "Tomorrow" case for `daysUntil === 1` (the key D-08 addition vs the analog)
- T-86-02: `donePct = Math.min(100, Math.round(...))` clamps to 0–100 including division-by-zero guard
- All Jira strings (version names, timing labels, counts) rendered as plain JSX text — zero `dangerouslySetInnerHTML` (T-86-01)

`taskflow/src/routes/dashboard/UpcomingReleasesTimeline.test.tsx` — 13 tests:
- D-08 dot count: exactly 2/3 dots for 2/3-version fixtures; max 3 when >3 versions exist
- D-06/D-08 empty state: no versions, all released, no releaseDate — all render empty state
- D-08 timing labels: "Tomorrow" for daysUntil===1, "Today" for due-today, "in 7 days" for future, "overdue" amber for past
- Readiness: 50% ready renders correctly from 5-done/10-total fixture
- Accessibility: role="region" aria-label="Upcoming releases"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript errors in UpcomingReleasesTimeline.test.tsx mock casts**
- **Found during:** Task 2 — `npm run check` (tsc) step
- **Issue:** `vi.mocked(useQueries).mockReturnValue([...] as ReturnType<typeof useQueries>)` caused TS2352/TS2537 errors because the partial mock object doesn't overlap with the full `UseQueryResult` union type
- **Fix:** Added `mockQuery<T>()` and `mockQueriesResult()` helper functions that use the project-approved `as unknown as` double-cast (single cast from unknown; no explicit `any` — matches project constraint from BIOME.md `noExplicitAny`)
- **Files modified:** `UpcomingReleasesTimeline.test.tsx`
- **Commit:** `981382a9`

**2. [Rule 1 - Bug] Biome formatting violations in both component files**
- **Found during:** Task 2 — `biome check` step
- **Issue:** Line-length wrapping differences in filter chains and JSX attributes
- **Fix:** `biome check --write` auto-applied; tests confirmed still passing after format
- **Files modified:** `MyIssuesCard.tsx`, `UpcomingReleasesTimeline.tsx`
- **Commit:** `981382a9`

**3. [Rule 3 - Blocking] No node_modules in worktree for test runner**
- **Found during:** Task 1 test verification
- **Issue:** The git worktree has no `taskflow/node_modules/` — vitest cannot be found
- **Fix:** Created symlink `taskflow/node_modules → /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules` (main repo's node_modules). Tests then ran correctly via the symlinked vitest binary. Symlink is not committed (only appears in the filesystem of the worktree).
- **Commit:** not committed (filesystem-only fix)

## Known Stubs

None — both components are fully wired to their TanStack Query cache keys and render real data from the shared cache. No hardcoded empty values or placeholder text in rendering paths.

## Threat Flags

No new threat surface introduced. Both components are read-only dashboard cards. All Jira strings render as plain JSX text (no `dangerouslySetInnerHTML`). T-86-01, T-86-02, T-86-03 mitigations confirmed present.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `taskflow/src/routes/dashboard/MyIssuesCard.tsx` | FOUND |
| `taskflow/src/routes/dashboard/MyIssuesCard.test.tsx` | FOUND |
| `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx` | FOUND |
| `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.test.tsx` | FOUND |
| Commit `2223a09d` (Task 1: MyIssuesCard) | FOUND |
| Commit `981382a9` (Task 2: UpcomingReleasesTimeline) | FOUND |
| 23 tests passing | VERIFIED |
| `npm run check` (biome + tsc) GREEN | VERIFIED |
| No `dangerouslySetInnerHTML` in either component | VERIFIED |
