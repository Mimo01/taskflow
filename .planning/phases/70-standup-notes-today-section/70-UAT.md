---
status: complete
phase: 70-standup-notes-today-section
source: [70-01-SUMMARY.md, 70-02-SUMMARY.md, 70-03-SUMMARY.md]
started: 2026-05-25T00:00:00Z
updated: 2026-05-25T00:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Today column — In Progress section
expected: In Progress section lists in-progress sprint stories assigned to you, including parent stories where you only own a subtask (your subtasks nested under the parent). Done items are excluded.
result: pass

### 2. Up Next section
expected: An "Up Next" section lists new/not-yet-started sprint items assigned to you (same grouped story+subtask display). Section renders even when empty.
result: pass
note: "User confirmed section now displays even when empty (changed from hidden-when-empty)."

### 3. Row details — progress bar, assignee, story points
expected: Each sprint row shows a logged-vs-estimate progress bar with a "spent / estimate logged" caption, the assignee avatar, and a story-points badge placed to the left of the avatar.
result: pass

### 4. Log Work on a row
expected: Log Work action on Today column rows.
result: pass
note: "User confirmed Log Work was removed from the Today column rows — no longer present by design."

### 5. Row navigation
expected: Clicking a sprint row navigates to the issue detail view.
result: pass

### 6. MRs Awaiting You section
expected: Merge requests where you are a reviewer are surfaced, grouped under their matching sprint stories.
result: pass
note: "User confirmed reviewer MRs are now grouped with the stories (MR↔story matching) rather than a standalone section."

### 7. Participating section
expected: Open MRs you've commented on (last 30 days, still actionable) are surfaced, grouped under their matching sprint stories.
result: pass
note: "User confirmed participating MRs are now grouped with the stories (MR↔story matching) rather than a standalone section."

### 8. MR ↔ story matching
expected: MRs that match a displayed sprint story (by title or branch) appear nested under that story instead of in the MR sections. Unmatched MRs remain in their own MR sections.
result: pass

### 9. Empty state
expected: When every section resolves empty (no sprint work, no MRs), the Today column shows a single full-column empty state rather than multiple empty section headers.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
