---
quick_id: 260518-ist
slug: show-test-case-key-badge-defect-count-ru
description: Show test case key badge, defect count, run count, and assignedToID in cycle detail executions table rows
date: 2026-05-18
commit: e63c5b5
status: complete
---

# Summary: 260518-ist

## What changed

**`types.ts`** — Added `assignedToID?: string` and `runCount?: number` to `AioTestRun`

**`cycles.ts`** — Extended `RawTestCaseWithRun` with `assignedToID` and `runCount`; mapped in return value

**`AioCycleDetailPage.tsx`** — Executions table updated:
- Test Case cell: key as gray monospace badge above title
- New Defects column: red pill with count when > 0, dash otherwise
- New Runs column: `runCount` value
- New Assignee column: raw `assignedToID` in monospace
- Date column retained

## Tests

25/25 pass. TypeScript: no errors.
