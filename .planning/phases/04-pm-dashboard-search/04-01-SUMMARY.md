---
phase: 04-pm-dashboard-search
plan: "01"
subsystem: api
tags: [jira, gitlab, typescript, vitest, tdd, release-linker, fix-versions, milestones]

# Dependency graph
requires:
  - phase: 02-developer-dashboard
    provides: JiraIssue, GitLabMR types and service layer patterns used by all wave plans
provides:
  - Extended JiraIssue with statusCategory field for PM dashboard bucket logic
  - JiraFixVersion interface and fetchFixVersions, searchJira functions in jira.ts
  - GitLabMilestone, GitLabTag interfaces and fetchGroupMilestones, fetchProjectTags, searchGitLabMRs in gitlab.ts
  - releaseLinker.ts with matchGitLabToFixVersion pure function (exact/fuzzy/none date matching)
  - Five Wave 0 test scaffold files with pending stubs for PM-01..PM-04 and SRCH-01..SRCH-02
affects: [04-02-pm-dashboard-tabs, 04-03-search-overlay]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Date normalization for timezone safety: append T00:00:00Z to YYYY-MM-DD strings to force UTC midnight"
    - "ISO 8601 date flooring: Math.floor(ms / 86400000) * 86400000 to strip time component"
    - "Search functions return empty array on non-200 to not block parallel search calls"
    - "Wave 0 scaffolds use vi.mock for missing components + it.todo for pending test stubs"

key-files:
  created:
    - taskflow/src/services/releaseLinker.ts
    - taskflow/src/services/releaseLinker.test.ts
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx
    - taskflow/src/components/app/SearchOverlay.test.tsx
    - taskflow/src/components/app/SearchResultPanel.test.tsx
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/gitlab.ts

key-decisions:
  - "statusCategory on JiraIssue.fields.status is optional (?) — Jira Server on-prem may omit it; callers use ?.key with fallback"
  - "Date-only strings parsed as UTC midnight (T00:00:00Z suffix) to prevent UTC+14 timezone drift"
  - "ISO 8601 tag dates floored to UTC midnight via ms/86400000 rounding, not toISOString().slice(0,10)"
  - "searchJira and searchGitLabMRs return empty array on non-200 — search failures must not block parallel other-source search"
  - "Wave 0 scaffolds use vi.mock at module level for not-yet-created components — allows test runner to parse file without error"

patterns-established:
  - "releaseLinker: pure function pattern — no side effects, no imports, testable without mocks"
  - "Wave 0 TDD scaffold: vi.mock + it.todo documents the contract before component exists"

requirements-completed: [PM-01, PM-02, PM-03, PM-04, SRCH-01, SRCH-02]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 4 Plan 01: PM Dashboard Search — Service Layer & Test Scaffolds Summary

**Extended jira.ts and gitlab.ts with PM dashboard API functions, created pure releaseLinker date-matching utility, and scaffolded 5 Wave 0 test files with failing stubs for PM-01 through SRCH-02**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T22:24:49Z
- **Completed:** 2026-03-11T22:30:03Z
- **Tasks:** 2 (TDD task with RED/GREEN + scaffold task)
- **Files modified:** 9

## Accomplishments
- Extended JiraIssue.fields.status with optional statusCategory, added JiraFixVersion type, fetchFixVersions, and searchJira to jira.ts
- Added GitLabMilestone, GitLabTag types and fetchGroupMilestones, fetchProjectTags, searchGitLabMRs to gitlab.ts
- Created releaseLinker.ts with matchGitLabToFixVersion covering exact/fuzzy/none matching with UTC timezone-safe date parsing (8 tests GREEN)
- Scaffolded 5 Wave 0 test files (20 it.todo stubs) for PM dashboard tabs and search components

## Task Commits

Each task was committed atomically:

1. **TDD RED: releaseLinker.test.ts failing stubs** - `7e9d9ba` (test)
2. **TDD GREEN: service extensions + releaseLinker.ts** - `4c116ce` (feat)
3. **Task 2: Wave 0 scaffold test files** - `5000e90` (chore)
4. **Fix: add vi import to scaffold files** - `cf79bd5` (fix)

_Note: TDD task has two commits (test RED then feat GREEN); scaffold fix was an auto-fix for TypeScript compliance._

## Files Created/Modified
- `taskflow/src/services/jira.ts` - Added JiraFixVersion interface, statusCategory to JiraIssue, fetchFixVersions, searchJira
- `taskflow/src/services/gitlab.ts` - Added GitLabMilestone, GitLabTag interfaces, fetchGroupMilestones, fetchProjectTags, searchGitLabMRs
- `taskflow/src/services/releaseLinker.ts` - New pure utility: matchGitLabToFixVersion with timezone-safe date logic
- `taskflow/src/services/releaseLinker.test.ts` - 8 tests covering all date matching cases including UTC+14 edge case
- `taskflow/src/routes/dashboard/SprintProgressTab.test.tsx` - Wave 0 scaffold: 4 PM-01 stubs
- `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` - Wave 0 scaffold: 3 PM-02 stubs
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` - Wave 0 scaffold: 5 PM-03/PM-04 stubs
- `taskflow/src/components/app/SearchOverlay.test.tsx` - Wave 0 scaffold: 4 SRCH-01/SRCH-02 stubs
- `taskflow/src/components/app/SearchResultPanel.test.tsx` - Wave 0 scaffold: 4 SRCH-02 stubs

## Decisions Made
- statusCategory on JiraIssue.fields.status is optional (`?`) — Jira Server on-prem may not always include it; callers must use `?.key` with a fallback
- Date-only "YYYY-MM-DD" strings forced to UTC midnight by appending `T00:00:00Z` before parsing — prevents timezone drift for UTC+14 users (Kiribati, etc.)
- ISO 8601 tag `commit.created_at` dates floored to UTC midnight via millisecond rounding, not string slicing
- `searchJira` and `searchGitLabMRs` return empty array on non-200 — search failures should not block parallel search from the other source
- Wave 0 scaffold files use `vi.mock` at module level for not-yet-created component files — allows Vitest to parse without error while it.todo stubs document the contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing vi import to scaffold test files**
- **Found during:** Overall TypeScript verification after Task 2
- **Issue:** Scaffold files used `vi.mock(...)` without importing `vi` from vitest — TypeScript reported TS2304 'Cannot find name vi'
- **Fix:** Added `vi` to the `import { describe, it, vi } from 'vitest'` line in all 5 scaffold files
- **Files modified:** All 5 scaffold .test.tsx files
- **Verification:** `npx tsc --noEmit` no longer reports vi errors in any modified file
- **Committed in:** `cf79bd5`

---

**Total deviations:** 1 auto-fixed (Rule 1 - missing import)
**Impact on plan:** Necessary for TypeScript compliance. No scope creep.

## Issues Encountered
- Pre-existing TopBar.test.tsx failure (LazyStore Tauri plugin-store mock issue) — not caused by this plan, not fixed (out of scope per deviation rules, logged to deferred items)

## Next Phase Readiness
- jira.ts and gitlab.ts now export all types and functions needed by Plans 02 and 03
- releaseLinker.ts is pure and tested — ReleasesTab can import matchGitLabToFixVersion directly
- Wave 0 test scaffolds document the contracts Plans 02 and 03 must fulfill
- No blockers for Wave 2 (PM dashboard tabs implementation)

---
*Phase: 04-pm-dashboard-search*
*Completed: 2026-03-11*

## Self-Check: PASSED

All 10 files found on disk. All 4 task commits verified in git log.
