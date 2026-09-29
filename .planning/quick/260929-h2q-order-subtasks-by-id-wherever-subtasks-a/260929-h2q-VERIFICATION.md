---
phase: quick-260929-h2q
verified: 2026-09-29
status: passed
score: 7/7 must-haves verified
---

# Quick 260929-h2q Verification

Goal: order subtasks by the parent's fields.subtasks sequence with a numeric-key fallback on every listing surface.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Subtasks follow parent fields.subtasks | VERIFIED | `orderSubtasks` / `orderSubtaskKeys` are wired into groupByMyDay, MyTasksPage by-sprint, filterSprintItems, Yesterday buildGroups, SubtasksPanel and Worklogs |
| 2 | Numeric fallback, not lexical | VERIFIED | `compareIssueKeysNumeric` uses integer suffix compare with an isInteger guard. The `localeCompare(b.issueKey)` sort is gone |
| 3 | Unlisted subtasks come after listed ones | VERIFIED | `compareWithIndex` puts indexed keys first, then numeric order |
| 4 | Status does not affect order | VERIFIED | No status input in any comparator |
| 5 | Story order unchanged | VERIFIED | The diff touches only the subtasks fields. `bandedParents.sort` is untouched, and `_placementStatusKey` still reads the unsorted `[0]` |
| 6 | Sprint Board numeric only, no new fetch | VERIFIED | SprintBoardTab is a 1-line change: `orderSubtasks(...)` with no sequence. `fetchSubtaskOrder` is absent from src |
| 7 | Issue Detail untouched | VERIFIED | `fetchEnrichedSubtasks` does not appear in the diff |

## Checks run
- vitest on the 17 relevant files: 250 tests passed.
- `tsc --noEmit`: clean.
- fetchIssueMeta follow-up fetch: conditional (only when parents are missing), wrapped in try/catch, and returns the primary map on failure.
- SubtasksPanel orders before `.slice(0, 5)`.
- Worklogs orders at a single site (render time), and both story enrichment URLs request `subtasks`.

## Notes
- The Worklogs epic/grandparent enrichment URL was intentionally left without `,subtasks`. This is not needed, because only story-level sequences are used.
- The import order in MyTasksPage.tsx is slightly off: `@/lib/subtask-order` comes after `@/services/jira`. It is a cosmetic biome-ordering nit only.

No gaps. No human verification required.

## Human UAT

2026-09-29: Approved by user — subtasks follow Jira subtask order across all surfaces; stories keep rank order.
