---
phase: quick-261112-of2
plan: 01
subsystem: dashboard
tags: [error-state, dashboard, ux]
key-files:
  created: []
  modified:
    - taskflow/src/components/ui/error-state.tsx
    - taskflow/src/components/ui/error-state.test.tsx
    - taskflow/src/routes/dashboard/MyIssuesCard.tsx
    - taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx
    - taskflow/src/routes/dashboard/HoursCommitsChart.tsx
    - taskflow/src/routes/dashboard/MyIssuesCard.test.tsx
    - taskflow/src/routes/dashboard/UpcomingReleasesTimeline.test.tsx
    - taskflow/src/routes/dashboard/HoursCommitsChart.test.tsx
decisions:
  - "CardErrorState wraps EmptyState (compact) in a role=alert div; fixed copy only, never error.message"
  - "Action wrapper span stops click and keydown propagation so clickableCard never navigates"
completed: 2026-11-12
---

# Quick 261112-of2: Dashboard cards error state Summary

Compact, centred `CardErrorState` (EmptyState-based; auth errors say "{Jira|GitLab} token rejected" + Open Settings, others "Couldn't load X" + Retry) now used by My Issues, Upcoming Releases and Past 7 days, with button events isolated from the whole-card click handlers.

## Commits

- 877523b5: CardErrorState + tests (task 1)
- 9c0b04c4: dashboard cards use CardErrorState, chart heights 280 to 300, legend hidden on worklogs error, "Commits unavailable" + en dash labels on GitLab commit errors, tests (task 2)

## Deviations from Plan

None to production behaviour. Notes:
- Imported `ReactNode` type in error-state.tsx rather than `React.ReactNode`.
- Added a `biome-ignore` (noStaticElementInteractions) on the propagation-stopping span and the test parent div.
- UpcomingReleasesTimeline.test renderWithQuery wrapped in MemoryRouter (CardErrorState uses useNavigate), as the plan anticipated.
- The worktree had no node_modules; symlinked to the main checkout's (untracked, not committed).

## Verification

Full pre-commit suite (biome, tsc, vitest 5139 tests) passed on both commits. The manual UAT human-check (wrong PAT / offline in the running app) was not performed.

## Self-Check: PASSED
