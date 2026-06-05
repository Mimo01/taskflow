---
phase: 80-subtask-templates-and-bulk-creation
plan: "04"
subsystem: dashboard-ui
tags: [component, bulk-create, sequential-creation, retry-no-duplicate, placeholder-resolution, dnd-kit, tdd]
dependency_graph:
  requires:
    - useSubtaskTemplatesStore (subtask-templates.store.ts)
    - resolveTemplateFields (resolveTemplateFields.ts)
    - resolveRowForCreate / PlaceholderContext (resolveRowPlaceholders.ts)
    - SubtaskTemplateRow preview mode (create-edit-issue/SubtaskTemplateRow.tsx)
    - BulkProgressIndicator actionVerb/noun props (BulkProgressIndicator.tsx)
    - JiraIssueDetail.fields.components (jira.ts)
  provides:
    - BulkCreateSubtasksModal (bulk create modal with sequential creation loop + retry)
    - createAllRows (exported pure-ish async function for test isolation)
  affects:
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx (Bulk Create entry point)
tech_stack:
  added: []
  patterns:
    - "@base-ui/react/dialog shell (Root/Portal/Backdrop/Popup) — mirrors CreateEditIssueModal"
    - "dnd-kit SortableContext + fixed-height DragOverlay (P78 lesson: no live ghost)"
    - "Sequential for-loop with per-row status (pending→creating→created/failed)"
    - "SUBTPL-07 dedup: if (status === 'created') continue — sole guard"
    - "Snapshot rows at click time (Pitfall 6: edits disabled during creation)"
    - "Three cache invalidations after any success (invalidateGhAllData + 2x queryClient)"
    - "boardId via useBoardId hook — never direct store read (RESEARCH Pattern 7)"
key_files:
  created:
    - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx
  modified:
    - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.test.ts
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
decisions:
  - "createAllRows exported as pure-ish async function with CreateAllRowsOptions object param — enables test isolation without React component mount"
  - "handleTemplateChange/handleTypeChange accept string|null — base-ui Select.onValueChange contract (null guard coerces to __adhoc__ / '')"
  - "Rows snapshotted at handleCreate click time — prevents mid-flight row edits from affecting in-progress creates (Pitfall 6)"
  - "jiraToken loaded lazily at create time via readSecret — not held in useState across the modal's open lifetime"
  - "@unassigned: assignee key omitted entirely from options (Pitfall 7 — never null)"
metrics:
  duration: "8m"
  completed_date: "2026-06-05"
  tasks_completed: 3
  files_created: 1
  files_modified: 2
---

# Phase 80 Plan 04: BulkCreateSubtasksModal and IssueDetailContent Entry Point Summary

BulkCreateSubtasksModal with sequential creation loop, retry-no-duplicate guard, placeholder resolution at create time, and per-row progress — wired into IssueDetailContent as the phase's user-facing entry point.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Modal shell, toolbar, preview rows, field resolution | `d5f67a77` | BulkCreateSubtasksModal.tsx (created, 634 lines) |
| 2 | Sequential creation loop, retry-no-duplicate, complete modal test | `67767fb7` | BulkCreateSubtasksModal.tsx + .test.ts |
| 3 | Wire Bulk Create entry point into IssueDetailContent | `07ead94f` | IssueDetailContent.tsx + BulkCreateSubtasksModal.tsx (null fix) |

## What Was Built

**`BulkCreateSubtasksModal.tsx`** — 634-line bulk create modal. Main exports: `BulkCreateSubtasksModal` (React component) and `createAllRows` (pure-ish async function).

**Modal shell:** `@base-ui/react/dialog` Root/Portal/Backdrop/Popup at `w-[860px] max-h-[88vh]` per UI-SPEC §3. Header shows "Bulk Create Subtasks" title + "Parent: {parentKey}" subtitle.

**Toolbar:** Template `<Select w-48>` with "No template (ad-hoc)" as first item + saved templates from `useSubtaskTemplatesStore`. Subtask-type `<Select w-40>` filtered via `.subtask === true` flag (D-05 — never name comparison). Amber `"N field{s} skipped"` badge (`role="status"`, shown only when `totalSkipped > 0`). Createmeta query chain: `['createmeta-issuetypes']` → subtask filter → `['createmeta', projectKey, typeId, 'Subtask']` → `['assignable-users']`.

**Row list:** dnd-kit `SortableContext` + fixed-height `DragOverlay` ghost (P78 lesson: no live-rendered clone). `SubtaskTemplateRow mode="preview"` with `placeholderCtx` for chip hints. Ad-hoc empty state: "Add rows below, or choose a template above to pre-fill." "+ Add row" appends with `assignee: '@inherit'` (D-10).

**`createAllRows`:** Sequential `for` loop (no `Promise.all`). SUBTPL-07 guard at loop top: `if (status === 'created') continue` — the sole dedup mechanism, unit-tested. Per-row `pending→creating→created/failed` via `onStateChange` callbacks. `@unassigned` omits assignee key entirely from payload (Pitfall 7 — never `null`). Rows snapshotted at click time (Pitfall 6).

**Payload assembly:** `resolveRowForCreate(row, ctx)` for assignee/priority/labels/duedate; additional: `timetracking.originalEstimate`, `storyPointsFieldKey`, `components[{id}]`, custom fields via `wrapCustomFieldValue`, always `parent: { key: parentKey }` + `issueTypeId: selectedSubtaskTypeId`.

**Cache invalidations** (after any row `'created'`): `invalidateGhAllData(queryClient, boardId ?? undefined)`, `['jira-issue-detail', parentKey, jiraBaseUrl]`, `['jira-subtask-enrichment', parentKey]` (prefix invalidation hits signature-keyed cache). boardId sourced via `useBoardId(jiraBaseUrl, jiraToken, activeJiraProject)` — never direct store read (RESEARCH Pattern 7).

**Footer:** `BulkProgressIndicator` in left slot once creating starts (`actionVerb="Creating" noun="subtasks"`). After partial failure + `isComplete`: primary button swaps to "Retry Failed" (`variant="outline"`) — re-invokes `handleCreate`, which calls `createAllRows` with existing `rowStates` so already-created rows are skipped. Close disabled during `creating === true`.

**`BulkCreateSubtasksModal.test.ts`** — 10 tests passing, 0 todos. Imports `createAllRows` from real module. Covers: sequential ordering, createFn called in array order, parent key in payload, retry-no-duplicate (created rows skipped), createdKey retention, failed→created transition, @unassigned omits assignee key, `onStateChange` creating→created transitions, invalidation trigger, all-rows-created final state.

**`IssueDetailContent.tsx`** — Added `useState` import, `bulkCreateOpen` state, "Bulk Create Subtasks" Button with `LayoutList` icon (after "Add subtask"), `BulkCreateSubtasksModal` mount with `parentKey={issueKey} parentIssue={issue}`.

## Verification

- `BulkCreateSubtasksModal.test.ts`: **10 passing, 0 failing, 0 todo**
- `biome check ./src`: **clean** (458 files, no fixes)
- `tsc --noEmit`: **clean** (no errors)
- All acceptance criteria met for all 3 tasks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] base-ui Select onValueChange passes `string | null` not `string`**
- **Found during:** Task 3 `tsc --noEmit` verification
- **Issue:** `handleTemplateChange(templateId: string)` and `handleTypeChange(typeId: string)` rejected by tsc — base-ui Select.Root.onValueChange signature is `(value: string | null, eventDetails: SelectRootChangeEventDetails) => void`
- **Fix:** Changed parameter types to `string | null` with `?? '__adhoc__'` / `?? ''` coercion guards (consistent with SubtaskTemplateRow's established pattern from Plan 02 deviation 2)
- **Files modified:** `BulkCreateSubtasksModal.tsx`
- **Commit:** `07ead94f`

## Known Stubs

None — all data flows are wired: template store → rows → createAllRows → Jira DC API. The modal operates on real `creatmetaFields`, real `allAssignees`, and real `parentIssue` from the caller.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: injection | BulkCreateSubtasksModal.tsx | T-80-07: resolved values passed as discrete typed fields through wrapCustomFieldValue; no string interpolation — mitigated as planned |
| threat_flag: tampering | BulkCreateSubtasksModal.tsx | T-80-08: SUBTPL-07 guard (`if status==='created' continue`) unit-tested in 3 retry scenarios — mitigated as planned |
| threat_flag: repudiation | BulkCreateSubtasksModal.tsx | T-80-09: @unassigned omits assignee key (never null), verified by @unassigned test — mitigated as planned |

## Self-Check: PASSED

Files exist:
- `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx` (634 lines) ✓
- `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.test.ts` ✓
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (modified) ✓

Commits exist:
- `d5f67a77` feat(80-04): build BulkCreateSubtasksModal shell, toolbar, preview rows, and field resolution ✓
- `67767fb7` feat(80-04): add sequential creation loop, retry-no-duplicate guard, and complete modal test ✓
- `07ead94f` feat(80-04): wire Bulk Create entry point into IssueDetailContent + fix null coercion ✓
