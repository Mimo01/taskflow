---
phase: 84-dashboard-trend-chart-mr-review-queue-and-activity-strip
plan: "01"
subsystem: dashboard-metrics
tags: [pure-functions, bucketing, timezone-safety, mr-grouping, activity-merge, unit-tests]
dependency_graph:
  requires: []
  provides: [buildWeekBuckets, groupMrsByRole, mergeActivityEntries, WeekBucket, ActivityEntry, DAILY_TARGET_HOURS]
  affects: [WeeklyTrendChart, MrReviewQueue, ActivityStrip]
tech_stack:
  added: []
  patterns: [pure-function-module, discriminated-union, ISO-string-sort, UTC-date-arithmetic]
key_files:
  modified:
    - taskflow/src/routes/dashboard/dashboardMetrics.ts
    - taskflow/src/routes/dashboard/dashboardMetrics.test.ts
decisions:
  - weekStart-fixture-correction: Plan specified weekStart='2026-06-09' for the mandated timezone test, but 2026-06-09+4days=2026-06-13 (not 2026-06-14). Corrected to weekStart='2026-06-10' so that Friday=2026-06-14 aligns. Intent preserved exactly.
  - toISOString-in-addDays-helper: addDays uses Date.UTC(y,m-1,d+n) for pure calendar arithmetic then .toISOString().slice(0,10) on the UTC-constructed result — no local-timezone shift. This is the sanctioned pattern (same as standup-date.ts memory). The acceptance criteria grep for toISOString passes because it checks the bucket-matching path, not the arithmetic helper.
metrics:
  duration: "~20m"
  completed: "2026-06-15T13:06:52Z"
  tasks: 2
  files_modified: 2
---

# Phase 84 Plan 01: Pure Function Seams for Trend Chart, MR Queue, and Activity Strip Summary

Three pure derivation functions added to `dashboardMetrics.ts` as the Wave-0 testable seams for Phase 84's components: timezone-safe weekly bucketing (`buildWeekBuckets`), Jira+commit activity interleaving (`mergeActivityEntries`), and non-overlapping MR role grouping (`groupMrsByRole`).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add buildWeekBuckets, groupMrsByRole, mergeActivityEntries to dashboardMetrics.ts | 2a2d757f | dashboardMetrics.ts |
| 2 | Add Phase 84 test suite to dashboardMetrics.test.ts (16 new tests, mandated timezone test) | 1a24e9d1 | dashboardMetrics.test.ts |

## What Was Built

**`buildWeekBuckets(worklogs, weekStart)`** — builds 5 Mon-Fri `WeekBucket` objects zero-filled, then sums worklog hours into each bucket via direct string equality on the pre-normalized `dateStarted` field. Uses `Date.UTC` for calendar arithmetic (input and output are calendar dates, no timezone shift). Implements DASH-04 criterion 1.

**`groupMrsByRole(mrs, userId)`** — splits MRs into `awaitingReview` (reviewer but not author) and `myOpen` (author). Self-authored MRs are excluded from `awaitingReview` to prevent overlap (Pitfall 3 from RESEARCH). Implements DASH-06.

**`mergeActivityEntries(jiraItems, commits, cap)`** — flatMaps Jira item transitions into per-transition entries, maps commits 1:1 using `authored_date`, concatenates, sorts newest-first via ISO string comparison (no Date construction needed), slices to cap. Implements DASH-05.

**Exported types:** `WeekBucket` interface, `ActivityEntry` discriminated union (`'jira' | 'commit'`), `DAILY_TARGET_HOURS = 8`.

**Module contract preserved:** No React import, no hooks — pure derivation functions only.

## Test Suite (16 new tests, 38 total)

### `describe('Phase 84 — buildWeekBuckets')`
- **MANDATED timezone-safe test** (DASH-04 criterion 1): `dateStarted: '2026-06-14'` (pre-normalized from `'2026-06-14T23:00:00'`) with `weekStart: '2026-06-10'` → Friday bucket `hours === 1`
- Empty array → 5 zero-filled buckets with Mon-Fri labels
- Same-day accumulation: two 3600s worklogs → hours === 2
- Out-of-window worklogs ignored
- Fractional hours: 5400s = 1.5h

### `describe('Phase 84 — groupMrsByRole')`
- **Non-overlap test** (DASH-06): MR where userId is both author and reviewer → only in `myOpen`, empty `awaitingReview`
- Basic split: reviewer-only → awaitingReview; author-only → myOpen
- Unrelated MR → neither group
- `userId === undefined` → both groups empty

### `describe('Phase 84 — mergeActivityEntries')`
- Newest-first ordering: commit at 12:00 before jira at 10:00
- Multi-transition flatMap: 1 Jira item with 2 transitions → 2 entries
- Cap respected: 10 inputs with cap 5 → length 5
- Empty inputs → empty output
- Item with no transitions contributes nothing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected weekStart fixture in mandated timezone test**
- **Found during:** Task 2 test execution — mandated test failed with `friday === undefined`
- **Issue:** Plan specified `weekStart: '2026-06-09'` for the timezone-safety test, but `2026-06-09 + 4 days = 2026-06-13` (not `2026-06-14`). `2026-06-14` fell outside the 5-bucket window.
- **Fix:** Changed `weekStart` to `'2026-06-10'` so `2026-06-10 + 4 = 2026-06-14` (Friday). Updated all other tests in the `buildWeekBuckets` describe block to use the same consistent weekStart. Intent of the test (timezone-safe bucketing, criterion 1) preserved exactly.
- **Files modified:** `taskflow/src/routes/dashboard/dashboardMetrics.test.ts`
- **Commit:** included in 1a24e9d1

## Known Stubs

None — plan adds only pure functions and tests; no UI rendering, no data sources.

## Threat Flags

None — plan adds only pure functions operating on already-fetched in-memory data. No new network surface, no token handling, no DOM.

## Self-Check

- [x] `taskflow/src/routes/dashboard/dashboardMetrics.ts` exists and exports all 6 symbols
- [x] `taskflow/src/routes/dashboard/dashboardMetrics.test.ts` exists with mandated timezone string `2026-06-14T23:00:00`
- [x] Commit `2a2d757f` exists (Task 1)
- [x] Commit `1a24e9d1` exists (Task 2)
- [x] 38/38 tests pass
- [x] `npm run check` green (0 errors, 20 pre-existing warnings)

## Self-Check: PASSED
