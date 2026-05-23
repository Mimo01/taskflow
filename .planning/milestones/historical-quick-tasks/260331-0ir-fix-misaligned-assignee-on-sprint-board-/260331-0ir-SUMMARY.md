---
phase: quick
plan: 260331-0ir
subsystem: sprint-board
tags: [alignment, css, sprint-board, story-swimlane]
dependency_graph:
  requires: []
  provides: []
  affects: [sprint-board story header rows]
tech_stack:
  added: []
  patterns: [Tailwind min-w utility for fixed-width badge columns]
key_files:
  modified:
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
decisions:
  - min-w-[5.5rem] chosen to accommodate "In Progress" (longest common status) at 88px
metrics:
  duration: 5m
  completed: 2026-03-31
---

# Quick Task 260331-0ir: Fix Misaligned Assignee on Sprint Board Summary

**One-liner:** Added `min-w-[5.5rem] text-center` to status badge in StoryHeaderRow so To Do / In Progress / Done badges occupy equal horizontal space, aligning subtask count columns across all story swimlane headers.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix status badge alignment with min-width | 499bcbf | taskflow/src/routes/dashboard/StoryHeaderRow.tsx |

## Changes Made

**StoryHeaderRow.tsx** — Status badge `<span>` at line 58: added `min-w-[5.5rem] text-center` to the Tailwind className alongside the existing `shrink-0 rounded px-1.5 py-0.5 text-xs font-medium` and dynamic `statusStyle`. This ensures the badge column is always 88px wide regardless of status text length, so all columns to the right (subtask count) align consistently across rows.

## Verification

- TypeScript compiled without errors
- Single-line CSS change with no logic impact

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- taskflow/src/routes/dashboard/StoryHeaderRow.tsx: modified and committed at 499bcbf
