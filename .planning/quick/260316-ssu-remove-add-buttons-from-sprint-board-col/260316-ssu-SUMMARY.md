---
phase: quick
plan: 260316-ssu
subsystem: sprint-board
tags: [ui, cleanup, sprint-board]
dependency_graph:
  requires: []
  provides: [sprint-board-no-quick-create]
  affects: [SprintBoardTab]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
decisions:
  - QuickCreateInput component files (QuickCreateInput.tsx, QuickCreateInput.test.tsx) left intact for potential use by other consumers
metrics:
  duration_minutes: 2
  completed: "2026-03-16T19:48:00Z"
---

# Quick Task 260316-ssu: Remove Add Buttons from Sprint Board Columns Summary

Removed QuickCreateInput "+ Add" buttons from sprint board column cells, cleaning up unwanted inline issue creation UX.

## What Was Done

### Task 1: Remove QuickCreateInput from SprintBoardTab

- Removed `QuickCreateInput` import from SprintBoardTab.tsx (line 44)
- Removed the QuickCreateInput JSX block inside each DroppableCell (the `{jiraToken && activeJiraProject && (...)}` block at lines 471-482)
- Removed the `BOARD-04 QuickCreateInput wiring` describe block from SprintBoardTab.test.tsx containing two tests:
  - "renders a QuickCreateInput in each column when data is loaded"
  - "passes numeric Jira status ID (not category key) to QuickCreateInput so transition lookup succeeds"
- Removed unused `createIssue` mock from the jira service mock factory
- **Commit:** cad6eff

## Verification Results

- All 17 remaining SprintBoardTab tests pass
- `grep QuickCreateInput SprintBoardTab.tsx` returns no matches
- Pre-existing TS errors in test file (BOARD-02 statusCategory type narrowing) are unrelated and unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | cad6eff | fix(quick-260316-ssu): remove QuickCreateInput from sprint board columns |
