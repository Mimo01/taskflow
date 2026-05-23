---
phase: quick-6
plan: 6
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Assignee rows are ordered highest-to-lowest by total story points (non-done)"
    - "Ties in points preserve stable ordering (secondary sort by name)"
  artifacts:
    - path: taskflow/src/routes/dashboard/WorkloadTab.tsx
      provides: "Sort by points descending"
      contains: "b.points - a.points"
  key_links:
    - from: useMemo sort
      to: WorkloadRow.points
      via: "Array.sort comparator"
      pattern: "b\\.points - a\\.points"
---

<objective>
Change the WorkloadTab assignee sort from open task count descending to total story points descending. Ties in points use assignee name as a stable tiebreaker.

Purpose: Story points are a more meaningful load indicator than raw task count. A developer with 2 stories at 13 pts each is more loaded than one with 5 single-point tasks.
Output: Updated WorkloadTab.tsx and accompanying test asserting sort order.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Sort assignees by story points descending</name>
  <files>taskflow/src/routes/dashboard/WorkloadTab.tsx, taskflow/src/routes/dashboard/WorkloadTab.test.tsx</files>
  <behavior>
    - Test: assignee with more points appears before assignee with fewer points
    - Test: when points are equal, rows are sorted alphabetically by name (stable tiebreaker)
    - Existing tests must continue to pass unchanged
  </behavior>
  <action>
    In WorkloadTab.tsx:

    1. Line 135 — change the sort comparator from:
       `sort((a, b) => b.count - a.count)`
       to:
       `sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))`
       The secondary `localeCompare` tiebreaker keeps order stable when two assignees have identical point totals.

    2. Update the JSDoc comment on line 8 from:
       `* Rows sorted by open task count descending.`
       to:
       `* Rows sorted by total story points (non-done) descending; ties broken alphabetically by name.`

    In WorkloadTab.test.tsx, add a new `it` block inside the top-level `describe('WorkloadTab')`:

    ```
    it('sorts assignee rows by story points descending', async () => {
      const { fetchSprintIssues } = await import('@/services/jira');
      vi.mocked(fetchSprintIssues).mockResolvedValue([
        makeIssue('P-1', 'Alice', 'new', 3),
        makeIssue('P-2', 'Bob', 'new', 8),
        makeIssue('P-3', 'Carol', 'new', 5),
      ]);

      const { default: WorkloadTab } = await import('./WorkloadTab');
      renderWithQuery(<WorkloadTab />);

      await screen.findByText('Bob');
      const rows = screen.getAllByTestId('workload-row');
      // Bob (8pts) > Carol (5pts) > Alice (3pts)
      expect(rows[0].textContent).toMatch(/Bob/);
      expect(rows[1].textContent).toMatch(/Carol/);
      expect(rows[2].textContent).toMatch(/Alice/);
    });
    ```
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx</automated>
  </verify>
  <done>All WorkloadTab tests pass. New sort test confirms Bob > Carol > Alice order. JSDoc updated.</done>
</task>

</tasks>

<verification>
All existing WorkloadTab tests pass and the new sort-order test passes.
</verification>

<success_criteria>
- `WorkloadTab.test.tsx` — all tests green including new sort test
- Line 135 of WorkloadTab.tsx uses `b.points - a.points` comparator
- JSDoc reflects the new sort criterion
</success_criteria>

<output>
After completion, create `.planning/quick/6-sort-assignees-by-total-story-points-in-/6-SUMMARY.md`
</output>
