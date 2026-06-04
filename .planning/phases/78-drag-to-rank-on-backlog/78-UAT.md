---
status: partial
phase: 78-drag-to-rank-on-backlog
source: [78-01-SUMMARY.md, 78-02-SUMMARY.md, 78-03-SUMMARY.md, 78-04-SUMMARY.md]
started: 2026-06-04T12:12:42Z
updated: 2026-06-04T12:13:30Z
---

## Current Test

[testing complete]

## Tests

### 1. Intra-section drag-to-rank + persistence
expected: Press-hold ~150ms, drag a row within its section; siblings slide to open a gap, a solid clone follows the cursor, source row hidden. On drop the row stays in the new spot (no jump-back) and the order persists after reload.
result: pass

### 2. Click vs drag disambiguation
expected: A quick click on a row still opens the issue peek panel. A drag (past the 150ms press-hold) does NOT open the peek on release.
result: pass

### 3. No-flicker during background refetch
expected: After dropping a row (or during a drag), a background refetch (e.g. window refocus) does not make the list jump or revert — the new order holds steady.
result: issue
reported: "when i drag and the page auto scrolls, the layout gets a little broken and the drag is not happening where the cursor is"
severity: major

### 4. Failure rollback banner
expected: If the rank save fails (offline / 403), the list rolls back to the pre-drag order and an inline banner "Couldn't save new order — reverted" appears.
result: skipped
reason: user skipped

### 5. Cross-section drag is a no-op
expected: Dragging a row into a different section does nothing — the row returns to its original position, no confirm dialog appears, and no sprint-membership change happens. (Moving between sprint/backlog is done via right-click "Move to Sprint / Move to Backlog".)
result: pass

## Summary

total: 5
passed: 3
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "During a drag, the page can auto-scroll without breaking layout or desyncing the dragged clone from the cursor"
  status: failed
  reason: "User reported: when i drag and the page auto scrolls, the layout gets a little broken and the drag is not happening where the cursor is"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
