---
phase: quick-260606-w2l
plan: "01"
subsystem: standup-notes
tags: [standup, subtask, grouping, rendering, markdown]
dependency_graph:
  requires: []
  provides: [standup-subtask-subgrouping]
  affects: [YesterdayColumn, IssueActivityGroup]
tech_stack:
  added: []
  patterns: [origin-key tagging, partition pass, nested rendering, SubItemList helper]
key_files:
  modified:
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
    - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
    - taskflow/src/routes/standup-notes/YesterdayColumn.test.ts
decisions:
  - "Distinct originKey field on SubItem (separate from issueKey click affordance) to cleanly drive partition pass without coupling clickability to sub-task membership"
  - "Single partition pass after all four source loops — keeps loop logic nearly unchanged, partitioning happens once"
  - "Composite key ${groupKey}::${originKey} for commit and MR-comment aggregation to get per-(group, origin) counts"
  - "SubItemList helper extracted inside IssueActivityGroup to avoid duplicating three-way clickable-MR/issue/plain branches"
  - "Today column (TodayInProgressSection) already nests via sprint-membership subtasks — confirmed no change required"
metrics:
  duration: ~12 minutes
  completed: "2026-06-06"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase quick-260606-w2l Plan 01: Standup Sub-task Sub-grouping Summary

**One-liner:** Yesterday column now nests sub-task-attributable activity (worklogs, commits, MR events) under clickable sub-task sub-headers within the parent story group, with 2/4-space indented markdown mirroring.

## What Was Built

### Task 1: buildGroups origin-key tagging + sub-task partition pass (6d4d24bc)

- Added `originKey?: string` to `SubItem` interface in `IssueActivityGroup.tsx` (distinct from `issueKey` click affordance)
- Exported new `SubTaskSubGroup` interface: `{ issueKey, summary, issueType?, subItems[] }`
- Extended `IssueGroup` with `subTaskGroups: SubTaskSubGroup[]` (initialised to `[]` in `ensureGroup`)
- Tagged `originKey` on every SubItem at attach time:
  - Worklogs: `originKey = worklog.issue.key`
  - Jira activity (transitions, comments): `originKey = activity.issueKey`
  - Commits: `originKey = extractedJiraKey`; aggregation changed from `commitCountByGroup` (keyed by `groupKey`) to composite `${groupKey}::${originKey}` for per-(group, origin) counts
  - MR events (approvals + comments): `originKey = extractedJiraKey`; comment aggregation key changed to composite for per-(group, origin, MR) attribution
- Added single partition pass after all four source loops: splits each group's `subItems` into story-level vs per-subtask map (using `issueMeta` to confirm `isSubtask && parentKey === group.issueKey`), builds `subTaskGroups` sorted by `issueKey` ascending; story-level items (no meta, or origin === groupKey, or origin is not a subtask of this group) stay flat in `group.subItems`

### Task 2: Nested rendering in IssueActivityGroup + prop wiring (8fabfc96)

- Extracted `SubItemList` helper function inside `IssueActivityGroup.tsx` to avoid duplicating the three-way clickable-MR / clickable-issue / plain item render branches
- Added `subTaskGroups?: SubTaskSubGroup[]` and `onOpenIssue?: (key: string) => void` props to `IssueActivityGroupProps`
- Rendered sub-task sub-groups below story-level items, guarded by `subTaskGroups.length > 0`:
  - Wrapper: `pl-6 ml-2` (matches TodayInProgressSection `IssueRow indented` pattern)
  - Sub-task header: `div[role=button]` + inner `<button>` key (Pitfall 1 — no nested-button invalid HTML)
  - Header body click: `(onOpenIssue ?? onIssueClick)?.(st.issueKey)` for peek panel
  - Key button click: `onIssueClick?.(st.issueKey)` + `stopPropagation`
  - Sub-task items: further `pl-6 ml-2` indented, rendered via `SubItemList`
  - React key: `st.issueKey` (stable, not array index — Pitfall 2)
- Wired `subTaskGroups={group.subTaskGroups}` and `onOpenIssue={onOpenIssue}` through `YesterdayColumn` render loop
- Fixed non-null assertion lint errors in partition pass; applied biome formatting

### Task 3: Nested markdown emit + extended tests (b7c86ae0)

- Updated `generateMarkdown` to emit nested sub-task block after story-level items:
  - `  - ${st.issueKey}: ${st.summary}` (2-space indent)
  - `    - ${item.label}` (4-space indent for each sub-task item)
  - Stories with no sub-task activity: no nested block emitted (regression guard)
- Updated existing "subtask worklog under parent" test to assert new `  - ESHOP-2: Wire up form` line (additive — existing `1h · ESHOP-2 Wire up form` label format unchanged)
- Added new tests:
  - Commit attributed to sub-task nests under it (4-space `- 1 commit`); no flat commit at story level
  - MR-comment attributed to sub-task nests under it; no flat comment at story level
  - Story with only story-level activity produces zero two-space-indented lines (regression guard)
- Fixed `GitLabCommit` fixture missing `author_email` field (tsc compliance)

## Deviations from Plan

None — plan executed exactly as written. The `node_modules` symlink required for running vitest from the worktree was a setup detail (worktree lacked `taskflow/node_modules`), not a code deviation.

## Today Column Audit

`TodayInProgressSection.tsx` already nests sub-tasks under stories via `row.subtasks.map((subtask) => <IssueRow indented ... />)` using sprint-membership-based `SprintRow.subtasks`. This is a separate, already-correct nesting path (sprint membership, not activity attribution). **No change required.** The `TodayColumn.markdown.test.ts` suite remains green (confirmed: 65/65 tests passing including Today tests).

## Verification Results

- `npx vitest run src/routes/standup-notes` — 65 tests, 8 files, all GREEN
- `npm run check` (biome + tsc) — GREEN, no errors

## Known Stubs

None.

## Threat Flags

None — this is a pure frontend rendering refactor with no new network endpoints, auth paths, or data sources.

## Self-Check

- [x] `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — modified (exists)
- [x] `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — modified (exists)
- [x] `taskflow/src/routes/standup-notes/YesterdayColumn.test.ts` — modified (exists)
- [x] Commit `6d4d24bc` — Task 1 (buildGroups)
- [x] Commit `8fabfc96` — Task 2 (rendering)
- [x] Commit `b7c86ae0` — Task 3 (markdown + tests)
- [x] All 65 standup tests GREEN
- [x] `npm run check` GREEN

## Self-Check: PASSED
