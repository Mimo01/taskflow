---
quick_id: 260513-axn
status: complete
commit: da7f9d9
---

# Summary: Sprint board story 0-subtasks header text

Removed the `subtaskCount > 0` guard in `StoryHeaderRow.tsx` so the subtask count span is always rendered. Stories with 0 subtasks now show "0 subtasks" in the header, matching the layout of stories with subtasks.

**File changed:** `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:151`
**Tests:** 20/20 passed
