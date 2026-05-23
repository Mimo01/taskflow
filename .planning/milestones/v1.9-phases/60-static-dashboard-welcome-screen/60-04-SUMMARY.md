---
plan: 60-04
phase: 60-static-dashboard-welcome-screen
status: complete
completed: 2026-05-21
---

# Plan 60-04: Dashboard Orchestrator (hero + 3-card grid)

## What Was Built

Overwrote the empty `taskflow/src/routes/dashboard/index.tsx` stub with the full dashboard orchestrator. The route now renders:

1. **Hero section** — gradient background (`from-primary/5 to-background`), centered `Welcome back, {displayName ?? 'there'}` heading, and today's date in en-GB long format (`Thursday, 21 May 2026`).
2. **Responsive 3-card grid** — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` wiring `DashboardSprintCard`, `DashboardInProgressCard`, and `DashboardReleaseCard`.
3. **Single PAT load** — `readSecret('jira-pat')` called once in a `useEffect` keyed on `jiraBaseUrl` (D-16). All three cards receive `jiraToken` as a prop.

Added `taskflow/src/routes/dashboard/index.test.tsx` with 5 Vitest tests covering DASH-01 and DASH-05.

## Files Created / Modified

| File | Action | Lines |
|------|--------|-------|
| `taskflow/src/routes/dashboard/index.tsx` | Overwritten (was `<div />` stub) | 57 |
| `taskflow/src/routes/dashboard/index.test.tsx` | Created | 116 |

## Commits

- `7f34ff65` — `test(60-04): add failing tests for Dashboard index.tsx (TDD RED)` — 5 tests covering hero/date/fallback/DASH-05/cards
- `c6056bdb` — `feat(60-04): implement Dashboard hero + 3-card grid orchestrator (DASH-01, DASH-05)` — full implementation, all 5 tests green

## Verification

- All 5 index tests pass: greeting, en-GB date, null fallback, no widget controls (DASH-05), three card stubs present
- Full dashboard suite: 397 tests pass across all 27 test files (including SprintCard + InProgressCard + ReleaseCard)
- `tsc --noEmit`: clean
- `npm run build`: succeeds
- `grep -c "readSecret('jira-pat')" index.tsx` → 1 (D-16 single point of PAT load)
- `grep -c "react-grid-layout|WidgetGrid|react-resizable" index.tsx` → 0 (DASH-05)

## Must-Haves Satisfied

- [x] Hero with `Welcome back, ${jiraUserDisplayName ?? 'there'}` centered (D-01, D-02, D-03)
- [x] Today's date via `toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })`
- [x] PAT loaded via `readSecret('jira-pat')` in `useEffect` keyed on `jiraBaseUrl` (D-16)
- [x] `DashboardSprintCard`, `DashboardInProgressCard`, `DashboardReleaseCard` in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` grid
- [x] No drag handles, widget picker, resize grips, or configuration controls (DASH-05)

## Self-Check: PASSED
