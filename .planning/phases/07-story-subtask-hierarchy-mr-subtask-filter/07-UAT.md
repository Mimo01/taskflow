---
status: complete
phase: 07-story-subtask-hierarchy-mr-subtask-filter
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md
started: 2026-03-13T00:00:00Z
updated: 2026-03-13T03:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

## Current Test

[testing complete]

## Tests

### 1. Sprint Board groups stories with subtasks below them
expected: Open the Sprint Board tab. Stories appear as regular task cards in their columns. Below each story (indented with a left border), its subtasks appear as nested cards. Subtasks that have no parent story in the sprint are not shown anywhere on the board.
result: issue
reported: "the button to show subtasks is very small and hard to click"
severity: minor

### 2. Column header counts stories only
expected: The column headers (e.g. "In Progress", "Done") show a number next to the status name. That number reflects only story-level issues — subtasks do not inflate the count.
result: pass

### 3. Subtask sections collapsed by default
expected: When Sprint Board first loads, story cards that have subtasks show a subtask count badge (e.g. "2") and a chevron icon, but the subtask cards themselves are hidden. The board starts in collapsed state.
result: pass

### 4. Chevron toggles subtask visibility
expected: Clicking the chevron (or the subtask count badge area) on a story card reveals the subtasks below it. Clicking again hides them. Each story's collapse state is independent.
result: pass

### 5. My Tasks tab hides orphan subtasks
expected: In the My Tasks tab, subtask issues that have no parent story in your task list are silently hidden. You only see story-level issues (and subtasks that belong to stories also in your list).
result: pass

### 6. MR Attention tab includes reviewer MRs linked to subtask stories
expected: If you are a reviewer on an MR whose Jira issue is a story where you have an assigned subtask, that MR appears in the MR Attention tab — even if it has unresolved discussions (those are bypassed for subtask-linked MRs).
result: issue
reported: "mr matching seems to be broken. When fetching mr, it returns empty array from gitlab"
severity: major

### 7. "via" label appears on subtask-path MRs
expected: MRs that appeared in the MR Attention tab solely because of the subtask-story connection show a muted "via PROJ-XXX" label (where PROJ-XXX is your subtask key) after the linked task badge. MRs that are already in your sprint or directly assigned to you do NOT show this label.
result: skipped
reason: no MRs available to test — blocked by empty array bug from test 6

## Summary

total: 7
passed: 4
issues: 2
pending: 0
skipped: 1

## Gaps

- truth: "Subtask toggle button is easy to click on story cards"
  status: failed
  reason: "User reported: the button to show subtasks is very small and hard to click"
  severity: minor
  test: 1
  artifacts: []
  missing: []

- truth: "MR Attention tab shows reviewer MRs linked to subtask stories"
  status: failed
  reason: "User reported: mr matching seems to be broken. When fetching mr, it returns empty array from gitlab"
  severity: major
  test: 6
  artifacts: []
  missing: []
