# Quick Task 260929-fz1: Add Testing section to My Tasks (My Day view) - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Task Boundary

On the My Tasks page, My Day banded view (`taskflow/src/routes/my-tasks/MyTasksPage.tsx` + `taskflow/src/lib/my-tasks-sort.ts`), add a new "Testing" band. The real Jira workflow has statuses "Ready to test" and "Testing" (see `src/services/jira/greenhopper/__fixtures__/transitions.real.json`); today they fall into In Progress / To Do.

Also: the RENDERED order of bands changes to match the real workflow, while classification precedence stays as it is today.

</domain>

<decisions>
## Implementation Decisions

### Which statuses
- Any status whose name contains "test" (case-insensitive substring), same style as the existing "review"/"block" checks. Covers "Ready to test" and "Testing".
- Flagged/blocked and done still win (checked earlier in classifyBand). Overdue still wins. In-review-my-MR still wins.

### Ownership
- Status-only, via the existing subtree-min rule: any eligible row (my issue, or a parent where I own a subtask) where the parent's or a subtask's own status is testing gets the testing band index. No "foreign parent" special rule like in-review-my-subtasks.

### Precedence (classification) — UNCHANGED semantics, testing inserted
Precedence order (lowest index wins in subtree-min):
flagged-blocked → overdue → in-review-my-mr → in-review-my-subtasks → **testing** → in-progress → to-do → done
- 260929-fnq behavior (foreign story in review with my subtask still in progress → "In Review — my subtasks") MUST be preserved.

### Display order — NEW, decoupled from precedence
Sections render in real-workflow order:
Flagged / Blocked → Overdue → In Progress → In Review with my MR → In Review — my subtasks → Testing → To Do → Done
- Implement as a separate display-order list/rank (e.g. `MY_DAY_BAND_DISPLAY_ORDER`) used to sort the grouped output of `groupByMyDay`; precedence indices remain what classifyBand/subtreeBand compute. Within a band, keep stable server rank order.
- Band groups must still be merged per band (one group per band), not "consecutive" only — after re-sorting by display order this holds naturally if sort is by display rank then stable.

### Label / dot
- Label: "Testing". Dot color: distinct from existing dots (red, destructive, purple, indigo, blue, muted, green) — e.g. `bg-amber-500` or `bg-teal-500` (Claude's discretion).

### Claude's Discretion
- Band id string (`testing`), dot color, exact mechanism for display ordering.
- Any hardcoded band indices (DONE_BAND etc., comments "0–6", "cap at done") must be updated for shifted indices.
- Anything else that consumes MY_DAY_BANDS index order (summary strip, filters, tests) must be checked and kept correct.

</decisions>

<specifics>
## Specific Ideas

- Update `MY_DAY_BANDS`, `MY_DAY_BAND_LABELS`, `MY_DAY_BAND_DOT` together (Record<MyDayBand, string> gives compile-time completeness).
- Extend `my-tasks-sort.test.ts` (testing classification, precedence vs in-progress/review, display order) and MyTasksPage tests if they assert band order.
- Pre-commit hook runs the full vitest suite — RED/GREEN must be one commit per task.
- Biome: don't introduce new diagnostics.

</specifics>

<canonical_refs>
## Canonical References

- Prior task: `.planning/quick/260929-fnq-*/` (in-review-my-subtasks band) — its behavior must be preserved.

</canonical_refs>
