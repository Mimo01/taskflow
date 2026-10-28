---
phase: quick-261028-mgp
plan: 01
subsystem: filters
tags: [filter, story-points, backlog, sprint-board]
requires: [lib/assignee-filter pattern]
provides: [shared Story Points filter]
affects: [UnifiedFilterBar, BacklogPage, SprintBoardTab, filter.store]
key-files:
  created:
    - taskflow/src/lib/story-points-filter.ts
    - taskflow/src/lib/story-points-filter.test.ts
  modified:
    - taskflow/src/stores/filter.store.ts
    - taskflow/src/stores/filter.store.test.ts
    - taskflow/src/components/UnifiedFilterBar.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
decisions:
  - "storyPoints optional on QuickFilter; read as ?? [] so legacy saved filters need no migration"
completed: 2026-10-28
---

# Quick 261028-mgp: Shared Story Points filter

Story Points dropdown (numeric ascending, pinned italic "No estimate" sentinel) shared by the Backlog and Sprint Board via one helper and filter.store state; chips, badge count, Clear and quick filters all include it.

## Commits
- f451f173: helper + store (TDD in one commit, pre-commit hook blocks RED)
- d045c1b1: UnifiedFilterBar, BacklogPage, SprintBoardTab wiring

## Deviations from Plan
None. The first commit attempt of task 2 failed the pre-commit full vitest run once with a single failing test; the suite passed on rerun with no code change (apparent flake, not investigated).

## Notes
- The worktree had no node_modules; symlinked the main checkout's `taskflow/node_modules` (untracked, git-ignored).
- Human check (run app, verify dropdown/chips) not performed.

## Self-Check: PASSED
