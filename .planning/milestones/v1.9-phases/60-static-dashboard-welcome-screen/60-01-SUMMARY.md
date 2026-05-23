---
phase: 60-static-dashboard-welcome-screen
plan: 01
subsystem: ui
tags: [react, tanstack-query, shadcn, vitest, tdd, progress-bar, base-ui]

# Dependency graph
requires:
  - phase: 59-dashboard-cleanup-dependency-removal
    provides: "Cleaned dashboard without widget grid system; prior SprintHealthPanel/SprintBoardTab patterns available"
provides:
  - "shadcn Progress component at @/components/ui/progress (base-nova / @base-ui/react/progress)"
  - "DashboardSprintCard component with sprint name, days remaining, % complete progress bar"
  - "DashboardSprintCard unit test suite (5 tests, DASH-02 coverage)"
affects:
  - 60-02-PLAN (DashboardInProgressCard — reuses makeSprintIssue fixture builder)
  - 60-03-PLAN (DashboardReleaseCard — Progress component available)
  - 60-04-PLAN (dashboard index.tsx — will import DashboardSprintCard as child)

# Tech tracking
tech-stack:
  added:
    - "@base-ui/react/progress (via shadcn base-nova Progress primitive — already in @base-ui/react dep)"
  patterns:
    - "Props-only auth isolation: card components receive jiraBaseUrl/jiraToken/activeJiraProject/storyPointsFieldKey as props, never calling readSecret or store hooks directly (D-16)"
    - "Dual useQuery with exact cache keys matching SprintHealthPanel for shared cache"
    - "TDD RED/GREEN: test file written first (fails with Cannot find module), then implementation passes all 5 tests"
    - "useDelayedLoading(isLoading) skeleton pattern with 3 animate-pulse blocks"

key-files:
  created:
    - taskflow/src/components/ui/progress.tsx
    - taskflow/src/routes/dashboard/DashboardSprintCard.tsx
    - taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx
  modified: []

key-decisions:
  - "shadcn base-nova Progress uses @base-ui/react/progress (not @radix-ui/react-progress) — this is the correct primitive for this project's style preset; @base-ui/react was already in dependencies"
  - "worktree node_modules symlink: worktree taskflow/ had no node_modules; created symlink to main repo's taskflow/node_modules to enable vitest + tsc"
  - "JSDoc comment in DashboardSprintCard.tsx omits readSecret/useAuthStore function names to pass D-16 verification grep cleanly"

patterns-established:
  - "Pattern 1: DashboardCard props contract — all four fields (jiraBaseUrl, jiraToken, activeJiraProject, storyPointsFieldKey) passed as props; no store reads inside card components"
  - "Pattern 2: makeSprintIssue fixture builder accepts (key, statusCategoryKey, storyPoints?, isSubtask?, displayName?) — reusable across DashboardSprintCard, DashboardInProgressCard test files"
  - "Pattern 3: @base-ui/react/progress Root renders role=progressbar with aria-valuenow — testable via getByRole('progressbar')"

requirements-completed: [DASH-02]

# Metrics
duration: 10min
completed: 2026-05-20
---

# Phase 60 Plan 01: DashboardSprintCard Summary

**shadcn Progress primitive installed and DashboardSprintCard built with sprint name, days-remaining, % complete bar, and empty state — all 5 unit tests pass (TDD GREEN)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-20T22:31:00Z
- **Completed:** 2026-05-20T22:41:20Z
- **Tasks:** 3
- **Files modified:** 3 created, 0 modified

## Accomplishments

- Installed shadcn Progress component (`npx shadcn@latest add progress`) — base-nova style uses `@base-ui/react/progress` which was already in deps; no new dependency added
- Wrote 5-test TDD scaffold (`DashboardSprintCard.test.tsx`) against the component contract before implementation (RED state confirmed: "Cannot find module ./DashboardSprintCard")
- Implemented `DashboardSprintCard.tsx` satisfying all DASH-02 requirements: sprint name, days remaining (`getDaysRemaining` verbatim from SprintHealthPanel), `<Progress value={donePct}>` with zero-denominator guard, "No active sprint" empty state, skeleton with `useDelayedLoading`
- All 5 unit tests pass; `tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn Progress component** - `9837b1a5` (chore)
2. **Task 2: DashboardSprintCard test scaffold (RED)** - `9147d54d` (test)
3. **Task 3: Implement DashboardSprintCard component (GREEN)** - `4c991070` (feat)
4. **Fix: D-16 comment cleanup** - `8a65ebec` (fix)

_TDD tasks have test commit (RED) followed by feat commit (GREEN)._

## Files Created/Modified

- `taskflow/src/components/ui/progress.tsx` - shadcn Progress primitive wrapping @base-ui/react/progress; exports Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue
- `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` - Sprint health card: dual useQuery (sprint-board + active-sprint cache keys), getDaysRemaining, donePct zero-denominator guard, Zap icon header, Progress bar, empty state
- `taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx` - 5 tests: sprint name/days-remaining, 60% aria-valuenow, 0% zero-denominator, "No active sprint" exact text, loading skeleton no-throw

## Decisions Made

- **shadcn base-nova uses @base-ui/react/progress**: The installed Progress component does not use `@radix-ui/react-progress` (as the plan's acceptance criteria specified) — this is because the project uses the `base-nova` style preset which is built on `@base-ui/react`. `@base-ui/react` was already a project dependency so no new package was added to `package.json`. The component correctly renders `role="progressbar"` with `aria-valuenow` as required by the tests.
- **worktree node_modules symlink**: The git worktree's `taskflow/` directory had no `node_modules`. Created a symlink to the main repo's `taskflow/node_modules` to enable vitest and tsc to run within the worktree context.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc comment contained readSecret/useAuthStore names causing D-16 grep false positive**
- **Found during:** Task 3 final verification
- **Issue:** The plan's D-16 check `grep -c "readSecret\|useAuthStore" DashboardSprintCard.tsx` returned 1 instead of 0 because the JSDoc comment mentioned these function names to describe what the component avoids
- **Fix:** Rewrote the comment to describe the pattern without naming the forbidden functions
- **Files modified:** `taskflow/src/routes/dashboard/DashboardSprintCard.tsx`
- **Verification:** `grep -c "readSecret\|useAuthStore"` now returns 0; all 5 tests still pass
- **Committed in:** `8a65ebec`

---

**Total deviations:** 1 auto-fixed (Rule 1 — comment grep false positive)
**Impact on plan:** Trivial cosmetic fix to satisfy verification criteria. No behavioral change.

## Issues Encountered

- **worktree missing node_modules**: The worktree's `taskflow/` directory lacked `node_modules`. This was resolved by creating a symlink (`ln -s /path/to/main/taskflow/node_modules ./node_modules`) before running vitest/tsc. No plan deviation — this is a standard worktree setup issue.
- **@radix-ui/react-progress not installed**: The plan acceptance criteria mentioned `@radix-ui/react-progress` in `package.json`. The base-nova shadcn style uses `@base-ui/react/progress` instead. Since `@base-ui/react` was already in dependencies and the Progress component correctly renders `role="progressbar"` with `aria-valuenow`, this is functionally equivalent and not a defect.

## Known Stubs

None — DashboardSprintCard renders live data from TanStack Query cache. The `enabled` guard ensures it shows skeleton/empty state until real credentials are available.

## Next Phase Readiness

- `@/components/ui/progress` is available for plans 02 and 03 (DashboardInProgressCard, DashboardReleaseCard)
- `makeSprintIssue` fixture builder exported pattern documented in SUMMARY for plan 02 to replicate
- `DashboardSprintCard` shares `['jira-issues', 'sprint-board', ...]` cache key with SprintBoardTab/SprintProgressTab — no duplicate fetches when user visits dashboard after visiting sprint board
- Plan 04 (index.tsx) can import DashboardSprintCard with the documented props contract

---
*Phase: 60-static-dashboard-welcome-screen*
*Completed: 2026-05-20*
