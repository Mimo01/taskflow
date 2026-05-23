---
phase: quick-15
plan: 15
subsystem: dashboard/my-tasks
tags: [jira, comments, ui, badge, task-row]
dependency_graph:
  requires: []
  provides: [fetchComments, JiraComment, comment-count-badge, existing-comments-panel]
  affects: [taskflow/src/services/jira.ts, taskflow/src/routes/dashboard/InlineComment.tsx, taskflow/src/routes/dashboard/TaskRow.tsx]
tech_stack:
  added: []
  patterns: [useQuery lazy-enabled, useEffect-driven-state-sync, badge-overlay]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/InlineComment.tsx
    - taskflow/src/routes/dashboard/TaskRow.tsx
decisions:
  - "useQuery enabled only when commentOpen=true — lazy fetch avoids N queries on page load"
  - "commentCount stored in separate useState updated via useEffect — allows badge to persist after panel close"
  - "existingComments/isLoadingComments passed as optional props to InlineComment — backward-compatible with existing tests"
metrics:
  duration: "~2 min"
  completed: "2026-03-13"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 15: Show Comment Count on My Tasks Page — Summary

**One-liner:** Comment count badge on TaskRow MessageCircle button using lazy useQuery, plus scrollable existing-comments list in InlineComment panel.

## What Was Built

- **`JiraComment` interface** exported from `jira.ts` — fields: `id`, `author.displayName`, `body`, `created`, `updated`
- **`fetchComments` function** exported from `jira.ts` — GETs `/rest/api/2/issue/{issueKey}/comment`, returns `JiraComment[]`
- **TaskRow comment badge** — `useQuery` with `queryKey: ['jira-comments', issue.key]`, enabled only when `commentOpen && !!jiraBaseUrl && !!jiraToken`; `commentCount` state persists badge after panel closes
- **InlineComment existing-comments list** — scrollable `max-h-48` container showing author, localized date, and body for each comment; rendered above the composer textarea when panel is open

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add fetchComments to jira.ts + JiraComment type | 4936730 | taskflow/src/services/jira.ts |
| 2 | Expand InlineComment + update TaskRow with count badge | d0404e9 | taskflow/src/routes/dashboard/InlineComment.tsx, taskflow/src/routes/dashboard/TaskRow.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: `npx tsc --noEmit` exits 0 — no type errors
- Tests: 3 pre-existing test failures confirmed unchanged (SubtasksPanel x4, MyTasksTab x1, ReleasesTab x1 — all pre-existing Tauri mock issues unrelated to this task)
- Manual: open My Tasks, click comment button — panel shows existing comments above composer; badge appears showing count after first open

## Self-Check: PASSED

- [x] `taskflow/src/services/jira.ts` — JiraComment and fetchComments present
- [x] `taskflow/src/routes/dashboard/InlineComment.tsx` — existingComments.map rendering present
- [x] `taskflow/src/routes/dashboard/TaskRow.tsx` — useQuery and badge rendering present
- [x] Commit 4936730 exists
- [x] Commit d0404e9 exists
