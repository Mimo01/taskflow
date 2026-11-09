---
quick_id: 261109-jzm
status: complete
commit: 4c8ed6f9
---

# Quick Task 261109-jzm Summary

Removed `rounded-md` from both My Tasks row containers (story/parent row and subtask row) in
`taskflow/src/routes/my-tasks/MyTaskRow.tsx`. The peek selection (PEEKED_ROW_CLASS tint + 3px
inset leading bar) and hover background now render as straight-edged bands, consistent with
other lists. No other styling changed.

Verification: my-tasks tests 27/27; full suite (pre-commit) 4510 passed.
