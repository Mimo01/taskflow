---
phase: quick-260330-wqj
plan: "01"
subsystem: sprint-board-ui
tags: [ui, strikethrough, done-status, sprint-board, backlog]
dependency_graph:
  requires: []
  provides: [strikethrough-on-done-issue-keys]
  affects: [StoryHeaderRow, TaskCard, BacklogRow]
tech_stack:
  added: []
  patterns: [conditional-cn-class, statusCategory-key-done]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
decisions:
  - Used cn() with conditional expression to keep class list readable and avoid ternary nesting
metrics:
  duration: ~5 minutes
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 260330-wqj: Strikethrough on Done Issue Keys Summary

**One-liner:** Conditional `line-through` CSS applied to PROJ-123 keys in sprint board headers, task cards, and backlog rows when `statusCategory.key === 'done'`.

## What Was Built

Three dashboard components now visually communicate completed items by striking through the issue key when the Jira status category is "done":

- **StoryHeaderRow.tsx** — Story swimlane headers on sprint board: storyKey span gets `line-through` when `statusCategoryKey === 'done'`
- **TaskCard.tsx** — Sprint board task/subtask cards: issue key div gets `line-through` when `issue.fields.status.statusCategory?.key === 'done'`
- **BacklogRow.tsx** — Backlog table rows: issue key span gets `line-through` when `issue.fields.status.statusCategory?.key === 'done'`

All three components already had `cn` imported — no new dependencies added.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add strikethrough to done issue keys in sprint board components | 2c3aa84 | StoryHeaderRow.tsx, TaskCard.tsx |
| 2 | Add strikethrough to done issue keys in backlog rows | 811fe6a | BacklogRow.tsx |

## Decisions Made

- Used `cn()` with `statusCategoryKey === 'done' && 'line-through'` pattern — consistent with existing conditional class patterns in the codebase, avoids ternary verbosity.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` — modified, contains `line-through`
- `taskflow/src/routes/dashboard/TaskCard.tsx` — modified, contains `line-through`
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — modified, contains `line-through`
- Commit 2c3aa84 exists (Task 1)
- Commit 811fe6a exists (Task 2)
- TypeScript: no errors (`npx tsc --noEmit` clean)
