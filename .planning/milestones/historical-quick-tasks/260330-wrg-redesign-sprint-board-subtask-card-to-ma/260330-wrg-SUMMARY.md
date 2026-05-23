---
phase: quick
plan: 260330-wrg
subsystem: sprint-board
tags: [ui, sprint-board, task-card, jira-style]
depends_on: []
provides: [redesigned-task-card]
affects: [sprint-board, drag-overlay]
tech_stack:
  added: []
  patterns: [jira-style-card-layout]
key_files:
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
decisions:
  - "Removed healthDot prop and ReviewHealth import entirely — prop was never passed from SprintBoardTab, making the dot always render as meaningless gray"
  - "Used customfield_10016 directly for story points — dynamic field key not available in component scope, this is the standard Jira field key and is always fetched"
  - "Kept CachedAvatar component for avatar rendering"
  - "Added assignee display name next to avatar per user feedback"
  - "Applied visual polish: tighter line heights, muted opacities, pill-shaped story points badge"
metrics:
  duration_seconds: 95
  completed_date: "2026-03-30"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Quick Task 260330-wrg: Redesign Sprint Board TaskCard to Jira Style

**One-liner:** Removed gray mystery dot, added issue type label top-right, and moved story points badge into bottom-right metadata row to match Jira's familiar card layout.

## What Was Built

Redesigned `TaskCard.tsx` to match Jira's card style:

- **Top row:** Issue key (left, monospace) + issue type name (right, muted) — e.g. "PROJ-123" / "Sub-task"
- **Summary:** 2-line clamp unchanged
- **Bottom row:** Assignee avatar + name (left) + story points pill badge + status badge (right)
- **Removed:** Gray health dot placeholder (`ReviewHealth`, `HEALTH_COLORS`, `healthDot` prop) — it was never populated from SprintBoardTab

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Redesign TaskCard to Jira-style layout and remove mystery dot | Done | 0d29e93 |

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Notes

- `CachedAvatar` referenced in the plan doesn't exist in this codebase — kept existing `<img>` + initials fallback pattern
- TypeScript environment errors in the worktree (`TS2307`, `TS7026`) are pre-existing across the whole project (missing lucide-react and react type declarations in the worktree environment) — not introduced by this change

## Self-Check

- [x] `taskflow/src/routes/dashboard/TaskCard.tsx` modified
- [x] Commit `0d29e93` exists
- [x] No `healthDot` or `ReviewHealth` references remain in TaskCard.tsx
- [x] `customfield_10016` accessed for story points
- [x] Issue type name rendered in top-right of card
