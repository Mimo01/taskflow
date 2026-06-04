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

### 4. Cross-section drag (accepted design: highlight + dialog)
expected: Drag a row over another section; the target section highlights, and on drop the ConfirmSprintMoveDialog appears ("Keep Position" / "Confirm"). Confirm moves + persists; Keep Position reverts. (No in-target ghost — accepted per UAT.)
result: [confirmed live — design accepted]

### 5. Failure rollback banner
expected: Induce a rank failure (offline / 403); the list rolls back to the pre-drag order and the inline banner "Couldn't save new order — reverted" appears and is dismissible.
result: [pending]

## Summary

total: 5
passed: 2
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
