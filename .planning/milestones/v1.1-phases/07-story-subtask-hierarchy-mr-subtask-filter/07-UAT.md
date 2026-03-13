---
status: resolved
phase: 07-story-subtask-hierarchy-mr-subtask-filter
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md
started: 2026-03-13T00:00:00Z
updated: 2026-03-13T12:00:00Z
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
  status: resolved
  reason: "User reported: the button to show subtasks is very small and hard to click"
  severity: minor
  test: 1
  root_cause: "The chevron <button> in TaskCard.tsx has no padding and uses a size-3 (12px) icon, making the hit target only ~12px square"
  artifacts:
    - path: "taskflow/src/routes/dashboard/TaskCard.tsx"
      issue: "Toggle button has no padding; icon is size-3 (12px), hit area is ~12px with no surrounding interactive zone"
  missing:
    - "Add p-1.5 or p-2 padding to the chevron button to expand hit target to ~32-44px"
    - "Consider making the entire Badge + chevron row the clickable toggle area"
    - "Optionally increase icon from size-3 to size-4 for better visual affordance"

- truth: "MR Attention tab shows reviewer MRs linked to subtask stories"
  status: resolved
  reason: "User reported: mr matching seems to be broken. When fetching mr, it returns empty array from gitlab"
  severity: major
  test: 6
  root_cause: "userId is not in the gitlab-mrs query key or enabled guard; query fires before validateGitLab resolves, fetchReviewerMRs falls back to [], and the stale cache is never invalidated when userId arrives"
  artifacts:
    - path: "taskflow/src/routes/dashboard/MrAttentionTab.tsx"
      issue: "enabled guard does not include !!userId; query key ['gitlab-mrs', gitlabBaseUrl] omits userId — stale cache with empty reviewer MRs is never busted when userId resolves"
    - path: "taskflow/src/services/gitlab.ts"
      issue: "Uncommitted diff re-adds fetchProjectMilestonesInRange which already exists at lines 469-508 — duplicate identifier will cause TypeScript error"
  missing:
    - "Add userId to query key: ['gitlab-mrs', gitlabBaseUrl, userId]"
    - "Add !!userId to enabled guard so query waits for validateGitLab to resolve"
    - "Remove duplicate fetchProjectMilestonesInRange block from uncommitted gitlab.ts changes"
    - "Switch stale-badge and linking tests to renderWithQueryAndUser to cover the userId race"
