---
phase: 05-api-foundation-quick-wins
plan: "04"
subsystem: ui
tags: [react, badge, shadcn, releases, sort, testing]

# Dependency graph
requires:
  - phase: 05-api-foundation-quick-wins
    plan: "01"
    provides: "Badge component installed; REL-01/02/03 test stubs created (RED state)"
provides:
  - "ReleasesTab sorts versions newest-to-oldest (undated at bottom)"
  - "Released/Unreleased/Overdue/Due today/In N days badges per release row"
  - "getReleaseTimingLabel() timezone-safe helper function"
  - "REL-01, REL-02, REL-03 tests passing (GREEN)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IIFE badge rendering pattern: (() => { ... })() inside JSX for conditional multi-badge output"
    - "Timezone-safe date comparison using toISOString().slice(0, 10) for YYYY-MM-DD strings"
    - "Sort-then-map with id-based count lookup: avoids off-by-one when sort reorders fixVersions"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/ReleasesTab.tsx

key-decisions:
  - "Use version.id lookup (not idx) for versionCountQueries after sort — sort reorders array so original index is invalid"
  - "Status badge and timing label are separate DOM elements — not merged into one badge"
  - "getReleaseTimingLabel returns null for released=true so released rows never show timing labels"

patterns-established:
  - "Badge color coding: green=released, amber=future-unreleased, red=overdue, blue=due-today"
  - "Timing label uses YYYY-MM-DD lexicographic compare (no Date object) to avoid timezone bugs"

requirements-completed: [REL-01, REL-02, REL-03]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 5 Plan 04: Releases Tab Sort and Status Badges Summary

**ReleasesTab sorts fix versions newest-to-oldest with color-coded Released/Unreleased/Overdue/Due today/In N days badges using shadcn Badge component**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T13:23:09Z
- **Completed:** 2026-03-12T13:26:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Releases sort: `fixVersions` sorted by `releaseDate` descending (newest first) with undated versions at bottom
- Badge rendering: per-row inline badges communicating release status and urgency at a glance
- Fix count lookup: replaced index-based `versionCountQueries[idx]` with id-based `.find()` to survive sort reordering
- All 14 ReleasesTab tests pass (REL-01, REL-02, REL-03 + 7 pre-existing tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement releases sort in useMemo** - `57b46dd` (feat)
2. **Task 2: Implement Released/Unreleased/timing badges** - `1187fba` (feat)

**Plan metadata:** _(to be added by final commit)_ (docs: complete plan)

## Files Created/Modified
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` - Added sort step in useMemo, id-based count lookup, Badge import, getReleaseTimingLabel helper, inline badge rendering per row

## Decisions Made
- Used `version.id` lookup instead of array index for `versionCountQueries` — after sorting, the original index no longer corresponds to the correct query
- Status badge (Released/Unreleased) and timing label (Overdue/Due today/In N days) are separate DOM elements per spec
- `getReleaseTimingLabel` returns `null` for `released=true` to ensure released rows never show stale timing labels
- Used IIFE `(() => {...})()` inside JSX for clean conditional multi-badge rendering without extracted helper component

## Deviations from Plan

None — plan executed exactly as written.

Note: A git stash pop occurred during diagnostic verification (checking pre-existing test failures). This accidentally restored uncommitted Plan 05-02 jira.ts changes (APIF-01 type extension). Those changes were restored to committed state and logged as out-of-scope for this plan. The jira.ts stash content is for Plan 05-02/03 implementation.

## Issues Encountered
- Pre-existing test failures (5 tests in jira.test.ts APIF-03 and MyTasksTab RED state from Plan 05-02) confirmed pre-existing by git stash diagnostic — not caused by this plan.

## Next Phase Readiness
- REL-01/02/03 requirements complete — Releases tab UI polish done
- Remaining Plan 05-02 and 05-03 work (APIF-01/02/03 implementation) is next in queue
- jira.ts APIF-01 type extension changes are in the working tree stash and need to be committed in Plan 05-02 context

---
*Phase: 05-api-foundation-quick-wins*
*Completed: 2026-03-12*
