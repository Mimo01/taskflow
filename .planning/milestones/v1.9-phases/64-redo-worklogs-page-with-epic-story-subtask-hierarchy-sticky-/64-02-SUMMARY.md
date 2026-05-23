---
phase: 64-redo-worklogs-page-with-epic-story-subtask-hierarchy-sticky-
plan: 02
subsystem: worklogs
status: checkpoint
tags:
  - worklogs
  - cell-popover
  - jira-worklog-crud
  - mutations
  - cache-invalidation
  - tdd
dependency_graph:
  requires:
    - 64-01 (WorklogsPage hierarchy table)
  provides:
    - WorklogCellPopover (TEMPO-09 cell drill-down)
    - WorklogEntryRow (entry view with edit/delete)
    - EditWorklogForm (inline edit form)
  affects:
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/routes/worklogs/WorklogCellPopover.tsx
    - taskflow/src/routes/worklogs/WorklogEntryRow.tsx
    - taskflow/src/routes/worklogs/EditWorklogForm.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
tech_stack:
  added: []
  patterns:
    - useMutation pattern from IssueDetailPage (worklogEditMutation / worklogDeleteMutation)
    - LogWorkPopover reuse for "Add entry" section
    - Base UI Popover (no asChild — use render prop or style trigger directly)
    - document.body queries for portal-rendered popover content in tests
    - queryClient.invalidateQueries broad prefix pattern for cache bust
key_files:
  created:
    - taskflow/src/routes/worklogs/EditWorklogForm.tsx
    - taskflow/src/routes/worklogs/WorklogEntryRow.tsx
    - taskflow/src/routes/worklogs/WorklogCellPopover.tsx
  modified:
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
decisions:
  - "Base UI PopoverTrigger does not support asChild — styled trigger directly with className"
  - "Epic-direct cell entries scoped to w.issue.key === epicKey to avoid rolled-up subtask duplication"
  - "document.body queries needed in tests because Base UI Popover renders content via Portal"
  - "formatSeconds and formatDayHeader promoted to named exports for WorklogCellPopover import"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 5
---

# Phase 64 Plan 02: Cell Popover + Entry Edit/Delete Summary

**Status: CHECKPOINT** — Tasks 1 and 2 complete; paused at Task 3 (human-verify checkpoint).

Adds cell drill-down editing on top of the Plan 01 hierarchy table. Three new sibling components (`EditWorklogForm`, `WorklogEntryRow`, `WorklogCellPopover`) wired into every non-zero story, subtask, and epic-direct data cell. Mutations invalidate the `['tempo', 'worklogs']` cache prefix. 8 new unit tests (4 per task), all passing.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing tests for WorklogEntryRow + EditWorklogForm | 6b8e2551 | WorklogsPage.test.tsx |
| 1 (GREEN) | Create WorklogEntryRow + EditWorklogForm sibling components | 75f3a354 | EditWorklogForm.tsx, WorklogEntryRow.tsx |
| 2 (RED) | Add failing tests for WorklogCellPopover wiring | cef13ea3 | WorklogsPage.test.tsx |
| 2 (GREEN) | Create WorklogCellPopover + wire into non-zero cells | 7c4b111f | WorklogCellPopover.tsx, WorklogsPage.tsx, WorklogsPage.test.tsx |

## What Was Built

**EditWorklogForm.tsx** — Inline edit form replacing a WorklogEntryRow when pencil is clicked:
- Pre-populated duration via `formatSecondsForInput` (guards sub-minute with `'0m'`, never empty)
- `parseDuration` validation with inline error (T-64-06 STRIDE mitigate)
- `started` uses `.replace('Z', '+0000')` (T-64-07 STRIDE mitigate)
- "Save Changes" / "Saving…" / "Discard Changes" per UI-SPEC Copywriting Contract

**WorklogEntryRow.tsx** — Per-entry row with time/author/comment + pencil/trash:
- Pencil swaps row in place with EditWorklogForm (local `editing` state)
- Trash triggers immediate `deleteWorklog` mutation (T-64-09 accepted — no confirmation)
- `aria-label="Edit worklog entry"` and `aria-label="Delete worklog entry"` for accessibility
- `type="button"` on all buttons to prevent accidental form submission

**WorklogCellPopover.tsx** — Popover shell opened on non-zero cell click:
- `Popover` / `PopoverTrigger` / `PopoverContent` from `@/components/ui/popover` (Base UI)
- Scrollable entry list (`max-h-48 overflow-y-auto`) of WorklogEntryRow components
- "Add entry" section reuses `LogWorkPopover` from `issue-detail/`
- All mutation success handlers call `queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] })` (D-14)

**WorklogsPage.tsx** — Wired in:
- `formatSeconds` and `formatDayHeader` promoted to named exports
- Epic-direct, story, and subtask data cells: conditional `WorklogCellPopover` when `secs > 0`
- Epic-direct cells scoped to `w.issue.key === epicKey` (comment explains subtask exclusion)

## Test Results

```
Tests: 41 passed (41) in WorklogsPage.test.tsx
TypeScript: 0 errors
Full suite: 1329 passed, 3 pre-existing failures in dashboard/index.test.tsx (unrelated)
Build: success
```

## Paused At

**Task 3: Human verification checkpoint** — awaiting operator to run the app and verify all 10 items in the how-to-verify checklist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Base UI PopoverTrigger has no `asChild` prop**
- **Found during:** Task 2 TypeScript check
- **Issue:** `WorklogCellPopover` used `<PopoverTrigger asChild>` following Radix UI convention, but the shadcn `popover.tsx` wraps Base UI (not Radix). Base UI's `PopoverTrigger` renders a `<button>` natively and accepts `className` directly — no `asChild` prop exists.
- **Fix:** Removed `asChild`, moved `className` and `aria-label` directly onto `<PopoverTrigger>`
- **Files modified:** WorklogCellPopover.tsx
- **Commit:** 7c4b111f

**2. [Rule 1 - Bug] Popover portal content not in `container` in tests**
- **Found during:** Task 2 tests (3 popover tests failing despite popover rendering)
- **Issue:** Base UI Popover renders content via `<Portal>` to `document.body`; tests queried `container.innerHTML` which missed the portal content
- **Fix:** Updated tests to use `document.body.querySelector/innerHTML` and wrap click events in `act(async () => {...})`
- **Files modified:** WorklogsPage.test.tsx
- **Commit:** 7c4b111f

## Known Stubs

None. All data flows from live Tempo worklog entries via `data` prop.

## Threat Flags

No new network endpoints introduced. All STRIDE mitigations from the threat register are implemented:
- T-64-06: `parseDuration` validation in EditWorklogForm
- T-64-07: `.replace('Z', '+0000')` in EditWorklogForm
- T-64-08: accepted (server-side enforcement)
- T-64-09: accepted (no confirmation dialog)
- T-64-10: accepted (React text node rendering)
- T-64-SC: accepted (zero new packages)

## Self-Check: PASSED

- EditWorklogForm.tsx: FOUND
- WorklogEntryRow.tsx: FOUND
- WorklogCellPopover.tsx: FOUND
- Commit 6b8e2551: FOUND
- Commit 75f3a354: FOUND
- Commit cef13ea3: FOUND
- Commit 7c4b111f: FOUND
