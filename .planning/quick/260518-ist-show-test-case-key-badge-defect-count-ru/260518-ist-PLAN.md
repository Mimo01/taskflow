---
quick_id: 260518-ist
slug: show-test-case-key-badge-defect-count-ru
description: Show test case key badge, defect count, run count, and assignedToID in cycle detail executions table rows
date: 2026-05-18
status: planned
---

# Quick Task 260518-ist

## Goal

Enrich executions table rows with: test case key badge, defect count badge, run count, and assignee ID.

## Tasks

### Task 1 — Extend AioTestRun type

**File:** `taskflow/src/services/aio/types.ts`
- Add `assignedToID?: string`
- Add `runCount?: number`

### Task 2 — Pass new fields through fetchAioCycleTestCasesWithRuns

**File:** `taskflow/src/services/aio/cycles.ts`
- Extend `RawTestCaseWithRun` with `assignedToID?: string` and `runCount?: number`
- Map them in the return value

### Task 3 — Update executions table UI

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx`
- Test Case cell: show `testCaseKey` as small gray monospace badge above/inline the title
- Add Defects column: count badge when `jiraDefectIDs.length > 0`
- Add Runs column: `runCount` value
- Add Assignee column: `assignedToID` in muted text
- Update table header `<th>` entries accordingly

### Task 4 — Update tests

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx`
- Add `assignedToID` and `runCount` to mockRuns entries that need them
- Verify tests still pass
