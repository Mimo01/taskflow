---
quick_id: 260513-axn
slug: sprint-board-story-0-subtasks-header
description: On sprint board if story has 0 subtasks print the text in the header the same way as if it did
date: 2026-05-13
mode: quick
---

# Quick Task 260513-axn: Sprint board story 0-subtasks header text

## Task

On sprint board, if a story has 0 subtasks the subtask count text in the header should be rendered the same way as when it has subtasks (e.g. "0 subtasks").

## Plan

### Task 1: Remove subtaskCount > 0 guard in StoryHeaderRow

**File:** `taskflow/src/routes/dashboard/StoryHeaderRow.tsx`

**Change:** Remove the `{subtaskCount > 0 && (...)}` conditional so the subtask count span is always rendered. Stories with 0 subtasks now show "0 subtasks" keeping layout consistent with stories that have subtasks.
