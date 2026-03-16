---
phase: quick
plan: 260316-v6i
subsystem: backlog-table
tags: [polish, ui, backlog]
dependency_graph:
  requires: []
  provides: [question-mark-badge-unestimated, nowrap-issue-keys]
  affects: [BacklogRow, BacklogPage]
tech_stack:
  added: []
  patterns: [consistent-badge-styling]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
decisions:
  - "Unestimated ? badge uses text-muted-foreground instead of text-foreground to visually distinguish from estimated badges"
metrics:
  duration_minutes: 1
  completed: "2026-03-16T21:30:15Z"
---

# Quick Task 260316-v6i: Display ? for Unassigned Story Points in Backlog

Consistent badge styling for unestimated issues (? in bordered badge) and whitespace-nowrap on issue key cells to prevent text wrapping in narrow columns.

## Changes Made

### Task 1: Show ? badge for null story points and prevent key wrapping

**Commit:** `0bbcc51`

**BacklogRow.tsx:**
- Replaced `<span className="text-xs text-muted-foreground">--</span>` with a badge matching the estimated-points style: `inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground` showing `?`
- Added `whitespace-nowrap` to the key cell `<td>` so keys like `LONGPROJECT-1234` never wrap

**BacklogPage.tsx:**
- Added `whitespace-nowrap` to the Key column `<th>` header to match row cell behavior

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without new errors (pre-existing test file errors unrelated to changes)
- Badge styling matches estimated-points badge pattern
- whitespace-nowrap applied to both header and row cells

## Self-Check: PASSED
