---
phase: 05-api-foundation-quick-wins
plan: 01
subsystem: ui
tags: [shadcn, badge, gitlab, vitest, tdd]

# Dependency graph
requires: []
provides:
  - "shadcn Badge component at taskflow/src/components/ui/badge.tsx"
  - "searchGitLabMRs URL includes &state=opened filter"
  - "Failing test stubs for REL-01 (sort), REL-02 (badges), REL-03 (timing labels)"
  - "Passing test for APIF-04 (searchGitLabMRs state filter)"
affects: [05-04]

# Tech tracking
tech-stack:
  added: [shadcn/ui Badge component]
  patterns: [TDD RED stubs for Nyquist compliance — stubs written before implementation plans run]

key-files:
  created:
    - taskflow/src/components/ui/badge.tsx
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx

key-decisions:
  - "Pre-existing TypeScript errors (unused imports in SearchOverlay.test.tsx, GitLabStep.tsx, JiraStep.tsx) are out of scope — confirmed pre-existing before any changes"
  - "REL-01/02/03 stubs intentionally fail (RED state) — Plan 04 is responsible for making them pass"
  - "APIF-04 stub passes immediately because Task 1 fixes the underlying searchGitLabMRs URL in the same plan"

patterns-established:
  - "Nyquist stubs pattern: failing test stubs written before implementation plans run, ensuring tests are not written to fit existing code"

requirements-completed: [APIF-04, REL-01, REL-02, REL-03]

# Metrics
duration: 8min
completed: 2026-03-12
---

# Phase 5 Plan 01: API Foundation Quick Wins — Prerequisites Summary

**shadcn Badge installed, searchGitLabMRs open-only filter fixed, and 7 REL/APIF test stubs written in RED state as Nyquist prerequisites for Plan 04**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-12T14:17:38Z
- **Completed:** 2026-03-12T14:25:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed shadcn Badge component (taskflow/src/components/ui/badge.tsx) — prerequisite for Releases UI in Plan 04
- Fixed searchGitLabMRs to include `&state=opened` in the API URL, preventing merged/closed MRs from appearing in search results
- Wrote APIF-04 test verifying state filter (passes immediately since Task 1 fixed the URL)
- Wrote 7 failing REL-01/02/03 test stubs (sort order, status badges, timing labels) that Plan 04 must implement

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn Badge and fix searchGitLabMRs state filter** - `af298f9` (feat)
2. **Task 2: Write failing test stubs for APIF-04 and REL-01/02/03** - `adea6d5` (test)

## Files Created/Modified
- `taskflow/src/components/ui/badge.tsx` - shadcn Badge component (created via `npx shadcn@latest add badge`)
- `taskflow/src/services/gitlab.ts` - Added `&state=opened` to searchGitLabMRs URL query string
- `taskflow/src/services/gitlab.test.ts` - Added searchGitLabMRs import + APIF-04 describe block (passes)
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` - Added REL-01/02/03 describe blocks with 7 failing stubs

## Decisions Made
- Pre-existing TypeScript errors in SearchOverlay.test.tsx, GitLabStep.tsx, JiraStep.tsx were confirmed out-of-scope via `git stash` check
- REL-01/02/03 stubs written with full assertion logic (not empty stubs), so failures are meaningful and specific
- APIF-04 test is a genuine passing test (not a stub), because the fix lands in the same plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript `--noEmit` reported 3 pre-existing errors (unused imports in unrelated files). Verified pre-existing via git stash before changes. No new errors introduced by this plan.

## Next Phase Readiness
- Badge component available for ReleasesTab import
- 7 failing REL-01/02/03 stubs are ready in ReleasesTab.test.tsx — Plan 04 must pass all of them
- searchGitLabMRs now filters open-only — Plan 02/03 can rely on this behavior

---
*Phase: 05-api-foundation-quick-wins*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: taskflow/src/components/ui/badge.tsx
- FOUND: taskflow/src/services/gitlab.ts
- FOUND: taskflow/src/services/gitlab.test.ts
- FOUND: taskflow/src/routes/dashboard/ReleasesTab.test.tsx
- FOUND: .planning/phases/05-api-foundation-quick-wins/05-01-SUMMARY.md
- FOUND commit: af298f9 (feat(05-01): install shadcn Badge and fix searchGitLabMRs state filter)
- FOUND commit: adea6d5 (test(05-01): add APIF-04 and REL-01/02/03 test stubs (RED state))
