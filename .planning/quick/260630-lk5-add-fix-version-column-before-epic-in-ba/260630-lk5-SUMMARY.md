---
phase: 260630-lk5
plan: "01"
subsystem: backlog-ui
tags: [backlog, fix-version, column, badge]
dependency_graph:
  requires: []
  provides: [fix-version-column-backlog]
  affects: [BacklogPage, BacklogRow]
tech_stack:
  added: []
  patterns: [useMemo-versionMap, fields-synthesis, badge-td-cell]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
decisions:
  - Use IIFE inside JSX for fixVersions extraction to avoid polluting RowCells function scope
  - Use muted border/bg styling to distinguish fix version badge from colored epic badge
  - max-w-[10rem] on fix version td matches WebKit/Tauri anti-collapse pattern used elsewhere
metrics:
  duration: "~5 minutes"
  completed: "2026-06-30T15:37:10Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 260630-lk5 Plan 01: Add Fix Version Column in Backlog Summary

Fix version column added to backlog story rows showing first fix version name as a muted badge, positioned between summary and epic columns.

## What Was Built

- `BacklogPage.tsx`: `versionMap` useMemo flattens `backlog.versionData.versionsPerProject` into `Map<number, {id,name}>`. The `adaptedIssues` useMemo now synthesizes `fixVersions: Array<{id,name}>` on each adapted issue by resolving `gh.fixVersions` (number IDs) through the map.

- `BacklogRow.tsx`: New fix version `<td>` inserted in `RowCells` between summary and epic badge cells. Reads `issue.fields.fixVersions` via the JiraIssue index signature, shows the first version name as a compact muted badge (`border-border bg-muted text-muted-foreground`), renders an empty cell when no fix version is set.

## Deviations from Plan

None - plan executed exactly as written. The plan suggested extracting `fixVersions` and `firstFixVersion` as named variables at the top of `RowCells`; an IIFE was used instead to keep the derivation co-located with the render without touching `RowCells`' function signature (equivalent semantics, cleaner scope isolation).

## Self-Check

- [x] `BacklogPage.tsx` modified: versionMap + fixVersions synthesis present
- [x] `BacklogRow.tsx` modified: fix version <td> inserted before epic <td>
- [x] `npx tsc --noEmit` passes with zero errors
- [x] Commits: 51967327 (Task 1), 36cd7447 (Task 2)

## Self-Check: PASSED
