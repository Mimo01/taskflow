---
phase: quick-260929-h2q
plan: 01
subsystem: subtask-ordering
tags: [jira, ordering, my-tasks, standup, worklogs, sprint-board]
key-files:
  created: [taskflow/src/lib/subtask-order.ts, taskflow/src/lib/subtask-order.test.ts]
  modified:
    - taskflow/src/lib/my-tasks-sort.ts
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
    - taskflow/src/routes/standup-notes/filterSprintItems.ts
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SubtasksPanel.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
metrics:
  completed: 2026-09-29
---

# Quick 260929-h2q: Order subtasks by Jira subtask sequence Summary

Shared pure helper (parent `fields.subtasks` sequence, numeric-key fallback) wired into My Tasks, Standup Today/Yesterday, Sprint Board (numeric only), My Subtasks panel and Worklogs.

## Commits
- c655c3c4 Task 1: helper + My Tasks (groupByMyDay, by-sprint list)
- a63ac3a3 Task 2: Standup Today, fetchIssueMeta subtaskKeys (+ conditional follow-up), Yesterday
- cf9464cd Task 3: Sprint Board, SubtasksPanel, Worklogs

## Decisions
- Worklogs ordering site: render time (subtask rows map in WorklogsPage.tsx), using `enrichMap.get(storyKey)?.fields.subtasks`; hierarchy memo untouched (ordered once only). Grandparent/epic enrichment URL left without `,subtasks`; both story-level URLs (enrichQuery, parentEnrichQuery) request it.
- Sprint Board: numeric fallback only, no fetch (user declined fetchSubtaskOrder).
- Standup Today: `_placementStatusKey` still uses the UNSORTED first subtask (asserted by test).

## Deviations from Plan
- [Rule 3] Yesterday/Standup test fixtures: initial keys `X-1` did not match the app's Jira-key regex (2+ letter project); fixed the fixtures to `PX-*`. No production change.
- Worklogs test: each subtask renders two `Open <key>` buttons; test dedupes labels. Fixture only.
- Biome `--write` reordered an import and reformatted one line in my-tasks-sort(.test).ts; included in commit 3 (formatting only). An unrelated biome touch to IssueDetailPage.progressive.test.tsx was reverted.
- Worktree setup: reset to expected base e3c75937 (was 540def1c); symlinked taskflow/node_modules from the main repo (gitignored). CONTEXT/RESEARCH are untracked in the main repo, read from there.
- No mocks were bent to fit production code; existing jira-standup single-mock test passes unmodified.

## Known Stubs
None.

## Self-Check: PASSED
Full vitest suite, tsc and biome ran green in each pre-commit hook. `fetchSubtaskOrder` and `localeCompare(b.issueKey)` no longer appear in src.
