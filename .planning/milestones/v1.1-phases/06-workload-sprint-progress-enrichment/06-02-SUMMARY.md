---
phase: 06-workload-sprint-progress-enrichment
plan: 02
subsystem: ui
tags: [react, vitest, jira, sprint, zustand]

# Dependency graph
requires:
  - phase: 05-api-foundation-quick-wins
    provides: fetchSprintIssues two-query strategy with subtask fields including issuetype.subtask and timetracking
  - phase: 06-workload-sprint-progress-enrichment-01
    provides: WorkloadTab pattern with storyPointsFieldKey from useSettingsStore and formatSeconds utility
provides:
  - Three-segment stacked bar (gray To Do / blue In Progress / green Done) replacing old single-color progress bar
  - Sprint time summary row (Total Est / Spent / Remaining) with graceful hide when no time data
  - Per-assignee points breakdown table by status bucket
  - Stories-only counting for all bucket/point metrics; subtasks included only in time totals
affects:
  - SprintProgressTab downstream UI consumers
  - Sprint board query cache (shared queryKey)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - subtask partition: filter issues by issuetype.subtask === false before bucket/point logic
    - graceful hide: render conditional blocks only when hasTimeData / total > 0 (not zero-value display)
    - storyPointsFieldKey via useSettingsStore: dynamic field access prevents hardcoded customfield_10016
    - donePct = 100 - todoPct - inProgPct to avoid rounding gap in stacked bar segments

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx

key-decisions:
  - "Use issuetype.subtask boolean (not name comparison) for story vs subtask partition — admin can rename the type"
  - "donePct computed as 100 - todoPct - inProgPct to ensure segments sum to exactly 100% despite Math.round"
  - "Assignee rows always rendered alphabetically; Unassigned appears as a row when no assignee on story"

patterns-established:
  - "findByTestId('stacked-bar') used as data-loaded sentinel in tests — avoids ambiguous text queries"
  - "Per-assignee table built from stories only; story status drives bucket assignment for points"

requirements-completed:
  - SPPG-01
  - SPPG-02
  - SPPG-03

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 06 Plan 02: Sprint Progress Enrichment Summary

**Three-segment stacked bar (gray/blue/green) with sprint time totals and per-assignee points table, counting stories only — subtasks excluded from bucket/point metrics**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-12T21:16:54Z
- **Completed:** 2026-03-12T21:20:46Z
- **Tasks:** 2 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- Replaced single-color progress bar with three-segment stacked bar (gray To Do, blue In Progress, green Done) with inline percentage label
- Sprint time summary row (Total Est / Spent / Remaining) shown only when any issue has time tracking data
- Per-assignee breakdown table with To Do pts / In Progress pts / Done pts columns
- All bucket counts and point sums filter to parent stories only via `issuetype.subtask === false`
- `storyPointsFieldKey` from `useSettingsStore` — no hardcoded `customfield_10016`
- All 10 SprintProgressTab tests pass (5 original + 5 new SPPG-01/02/03 cases)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SprintProgressTab tests (RED)** - `38711d2` (test)
2. **Task 2: Rewrite SprintProgressTab implementation (GREEN)** - `5fd5076` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

_Note: TDD tasks had RED → GREEN commits; no separate REFACTOR needed_

## Files Created/Modified

- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` — Full rewrite: extended useMemo with subtask partition, stacked bar JSX, time summary, per-assignee table
- `taskflow/src/routes/dashboard/SprintProgressTab.test.tsx` — Extended makeIssue factory, added settings store mock, 6 new SPPG test cases

## Decisions Made

- Used `issuetype.subtask` boolean not name comparison — consistent with Phase 5 decision and admin-rename safety
- `donePct = 100 - todoPct - inProgPct` prevents rounding gap where three `Math.round()` segments could sum to 99 or 101
- Assignee rows sorted alphabetically; null assignee mapped to "Unassigned" string key

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ambiguous text queries in tests after DOM structure changed**

- **Found during:** Task 2 (GREEN phase — running tests)
- **Issue:** Original tests used `screen.getByText(/to do/i)` but new DOM has three elements matching: the "To Do" label, the "33% to do" stacked bar label, and the "To Do pts" table header
- **Fix:** Changed `getByText` → `getAllByText` in two existing tests; changed SPPG-01 stacked bar test to `findByTestId('stacked-bar')` as data-loaded sentinel instead of text-based wait
- **Files modified:** `SprintProgressTab.test.tsx`
- **Verification:** All 10 tests pass after fix
- **Committed in:** `5fd5076` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correction for test reliability. No scope creep.

## Issues Encountered

- Pre-existing test failures in `MyTasksTab.test.tsx` and `ReleasesTab.test.tsx` — confirmed out-of-scope via `git stash` check (failures exist before this plan's changes). Logged to deferred items.

## Next Phase Readiness

- SprintProgressTab is fully enriched per SPPG-01/02/03 requirements
- Phase 06 complete — both WorkloadTab (06-01) and SprintProgressTab (06-02) delivered
- Pre-existing failures in MyTasksTab and ReleasesTab need investigation in a future session

---
*Phase: 06-workload-sprint-progress-enrichment*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: SprintProgressTab.tsx
- FOUND: SprintProgressTab.test.tsx
- FOUND: 06-02-SUMMARY.md
- FOUND: commit 38711d2 (test RED)
- FOUND: commit 5fd5076 (feat GREEN)
