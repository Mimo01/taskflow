---
phase: quick-261029-qez
plan: 01
subsystem: aio-dashboard
tags: [aio, refresh, react-query]
key-files:
  created:
    - taskflow/src/lib/aio-refresh.ts
    - taskflow/src/lib/aio-refresh.test.ts
  modified:
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
    - taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
requirements-completed: [QUICK-261029-qez]
---

# Quick 261029-qez: Refresh button on AIO cycles and cycle detail pages

Backlog-style Refresh control (muted "Refreshed: HH:MM:SS" text plus icon-only RefreshCw button) on the Test cycles page and the cycle detail header, backed by upstream-first invalidation helpers.

## Commits
- 84b44c34: aio-refresh helpers + unit tests (stage ordering, defect predicate)
- d500ca2c: wired controls into both pages + tests (spin/disabled while pending)

## Decisions
- Spinner/disabled driven by a local `refreshing` state that spans the whole awaited chain.
- Defect invalidation reads fresh runs from cache after the runs refetch, matching numeric jiraDefectIDs.

## Deviations from Plan
None. (Worktree base was reset to 96a3036e per the branch check.)

## Self-Check: PASSED
