# Quick Task 261027-iz9: AIO test cycle page — split Executions and Defects tabs into Not done / Done tables with empty states - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning

<domain>
## Task Boundary

On the AIO test cycle detail page (`taskflow/src/routes/dashboard/AioCycleDetailPage.tsx`), the
Executions tab (`aio-cycle/ExecutionsList.tsx`) and Defects tab (`aio-cycle/DefectsList.tsx`) each
render one table. Split each into two tables: **Not done** and **Done**. When a table is empty,
show a nice visual (empty state) instead of the table. Must look nice and be usable.

User's words: "on aio tc page, there are tabs with executions and defekts. they both show one table.
I want to split it into two tables: done and not-done. If a table is empty a nice visual for it
should be shown instead of the table. Make it look nice and usable"

</domain>

<decisions>
## Implementation Decisions

### Executions "Done" definition
- Done = status **Pass only** (normalizeStatus(run.status) === 'pass').
- Not done = everything else: Fail, Blocked, In progress, Not run.

### Defects "Done" definition
- Done = Jira `fields.status.statusCategory.key === 'done'`.
- Not done = every other status category. Loading rows (no issue yet) belong in Not done (or a
  neutral place) — never silently dropped.

### Layout
- Stacked vertically: **Not done first**, then **Done**. Both sections always open (no collapsing).
- Each section has a section header with label + count.

### Filters / sort / search
- Keep all existing filters, search, and sort. They are shared: one toolbar drives both tables.
- Each section shows its own (filtered) count.
- Empty state per section should distinguish "nothing here at all" vs "nothing matches the filters".

### Claude's Discretion
- Exact empty-state visuals/copy (use existing `@/components/ui/empty-state` or a refined variant;
  e.g. Done empty in Executions = "No passed runs yet", Not done empty = celebratory "All runs passed").
- Section header styling, sticky column headers handling with two tables (page uses
  `--aio-sticky-top` sticky offsets).
- Whether the whole-tab "No defects" empty state stays when there are zero defects total.

</decisions>

<specifics>
## Specific Ideas

- Follow project UI preferences: colour = status only, one row = one line at every density,
  detail pages use h3/rows not card panels, no legends.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
