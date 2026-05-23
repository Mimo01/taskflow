---
phase: quick
plan: 260331-0dp
subsystem: sprint-board
tags: [sprint-board, story-header, assignee, ui]
dependency_graph:
  requires: [quick-260331-039]
  provides: [assignee-name-on-story-header]
  affects: [StoryHeaderRow]
tech_stack:
  added: []
  patterns: [text-truncation, flex-layout]
key_files:
  modified:
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
decisions:
  - shrink-0 on outer div retained so the avatar+name block does not collapse; inner span handles overflow via truncate
metrics:
  duration: 5m
  completed: 2026-03-31
  tasks_completed: 1
  files_modified: 1
---

# Phase quick Plan 260331-0dp: Show Assignee Name on Story Header Summary

**One-liner:** Added assignee display name text beside the avatar on sprint board story swimlane headers using `text-xs text-muted-foreground truncate max-w-[120px]`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add assignee display name text next to avatar | 409395f | taskflow/src/routes/dashboard/StoryHeaderRow.tsx |

## What Was Built

Updated the assignee block in `StoryHeaderRow.tsx` to render a `<span>` with the assignee's display name next to the `CachedAvatar`. The outer `div` now uses `flex items-center gap-1.5` to pair the avatar and name horizontally. The name span uses `text-xs text-muted-foreground truncate max-w-[120px]` to keep it visually subtle and prevent overflow on long names.

When no assignee is set, neither the avatar nor name renders (guard unchanged).

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript: compiles without errors (`npx tsc --noEmit` clean)
- Visual: story headers with assignees now show avatar + name text side by side
- Visual: long names truncate with ellipsis at 120px max-width
- Visual: unassigned stories show no avatar or name

## Self-Check: PASSED

- File modified: `/Users/mimo/Desktop/Tasker/taskflow/src/routes/dashboard/StoryHeaderRow.tsx` — exists
- Commit 409395f — exists
