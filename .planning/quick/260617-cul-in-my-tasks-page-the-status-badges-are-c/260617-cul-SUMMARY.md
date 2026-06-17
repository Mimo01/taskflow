---
phase: quick-260617-cul
plan: "01"
subsystem: my-tasks
tags: [status-pill, my-tasks, ux, non-interactive]
dependency_graph:
  requires: []
  provides: [static-status-pill-my-tasks]
  affects: [taskflow/src/routes/my-tasks/MyTaskRow.tsx]
tech_stack:
  added: []
  patterns: [statusPillClass from statusStyles.ts]
key_files:
  modified:
    - taskflow/src/routes/my-tasks/MyTaskRow.tsx
decisions:
  - "Prefix now-unused projectId/issueTypeId with _ rather than delete — they may be useful later if StatusPopover is re-added elsewhere"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-17"
---

# Phase quick-260617-cul Plan 01: Replace StatusPopover with static status pill in MyTaskRow Summary

Static, non-interactive status pill replaces interactive StatusPopover in My Tasks rows so badge clicks bubble to the row's PeekPanel handler.

## What Was Built

Removed `StatusPopover` (with its `stopPropagation` wrapper and biome-ignore comments) from the `rightCluster` in `MyTaskRow.tsx`. In its place: a plain `<span>` with `statusPillClass(statusCategoryKey)` inside a `flex shrink-0` div (required flex parent per the statusPill pitfall). The span carries no `onClick`, `cursor-pointer`, or hover handlers — clicks fall through to the parent row's `onClick={() => onOpenPeek(issue.key)}`.

Also removed the `onStatusSelect` prop entirely from the `MyTaskRowProps` interface, the destructured params, and the recursive subtask `MyTaskRow` render.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Replace StatusPopover with static status pill | dc4405d8 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused variables after StatusPopover removal**
- **Found during:** Task 1 verification (biome check)
- **Issue:** `projectId` and `issueTypeId` were computed solely to pass to `StatusPopover`; removing that block left them unused, causing biome `noUnusedVariables` errors
- **Fix:** Prefixed both with `_` per biome convention
- **Files modified:** `taskflow/src/routes/my-tasks/MyTaskRow.tsx`
- **Commit:** dc4405d8 (included in main task commit)

**2. [Rule 1 - Style] Formatter: span must be on one line**
- **Found during:** Task 1 verification (biome check)
- **Issue:** Biome formatter required the `<span>` and its text content on a single line
- **Fix:** Collapsed to `<span className={...}>{issue.fields.status.name}</span>`
- **Files modified:** `taskflow/src/routes/my-tasks/MyTaskRow.tsx`
- **Commit:** dc4405d8 (included in main task commit)

## Verification

- `biome check` on MyTaskRow.tsx: PASSED (no fixes applied)
- `tsc --noEmit`: PASSED (no output)
- No remaining `StatusPopover` or `onStatusSelect` references in MyTaskRow.tsx

## Self-Check: PASSED

- dc4405d8 exists in git log
- taskflow/src/routes/my-tasks/MyTaskRow.tsx modified (6 insertions, 25 deletions)
- No StatusPopover or onStatusSelect references remain
