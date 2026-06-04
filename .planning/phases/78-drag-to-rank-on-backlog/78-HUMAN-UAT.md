---
status: partial
phase: 78-drag-to-rank-on-backlog
source: [78-VERIFICATION.md]
started: 2026-06-04
updated: 2026-06-04
---

## Current Test

[awaiting human sign-off — most items exercised live during the execution session]

## Tests

### 1. Intra-section drag visual + persistence
expected: Press-hold a row ~150ms, drag within the active-sprint section; a dashed ghost placeholder opens at the drop slot, the row lands there with no snap-back, and the new order persists after reload.
result: [confirmed live — "intra section works"]

### 2. Click vs drag disambiguation
expected: A quick click still opens the peek panel / navigates; a drag (past the 150ms PointerSensor delay) does NOT open the peek on release (justDragged guard).
result: [pending]

### 3. No-flicker during refetchOnWindowFocus
expected: Begin a drag, trigger a window-focus refetch mid-drag; the list order does not jump or revert (cancelQueries + isDraggingRef gate).
result: [pending]

### 4. Failure rollback banner
expected: Induce a rank failure (offline / 403); the list rolls back to the pre-drag order and the inline banner "Couldn't save new order — reverted" appears and is dismissible.
result: [pending]

> Cross-section drag was DISABLED per user request (commit 0d8ef8ea) — dragging only
> reorders within a section; a cross-section drop is a no-op. Sprint membership changes
> remain available via the right-click "Move to Sprint / Move to Backlog" context menu.

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
