---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/SprintProgressTab.tsx
  - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Assignees in the sprint progress breakdown table are ordered by total story points descending"
    - "Assignees with equal total points are ordered alphabetically"
  artifacts:
    - path: "taskflow/src/routes/dashboard/SprintProgressTab.tsx"
      provides: "Sort by total points desc, name asc tiebreaker"
      contains: "b.points - a.points"
  key_links:
    - from: "assigneeMap"
      to: "assigneeRows"
      via: "Array.from().sort()"
      pattern: "b\\.points - a\\.points"
---

<objective>
Sort assignees in the SprintProgressTab per-assignee breakdown table by total story points descending, with an alphabetical tiebreaker for ties.

Purpose: Mirrors the sort order already applied to WorkloadTab — highest-load assignees appear first, making sprint allocation visible at a glance.
Output: Updated sort comparator in SprintProgressTab.tsx + a new test asserting sort order.
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
  <name>Task 1: Sort assignee rows by total points desc with alphabetical tiebreaker</name>
  <files>taskflow/src/routes/dashboard/SprintProgressTab.tsx, taskflow/src/routes/dashboard/SprintProgressTab.test.tsx</files>
  <behavior>
    - Test: Charlie (8 pts) appears before Alice (5 pts) appears before Bob (3 pts)
    - Test: two assignees with equal total points are ordered alphabetically (e.g. "Alice" before "Zara" when both have 5 pts)
  </behavior>
  <action>
    In SprintProgressTab.tsx, line 123, replace the sort comparator:

    CURRENT:
      const assigneeRows = Array.from(assigneeMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    REPLACE WITH (compute total pts inline, sort desc by total then alpha by name):
      const assigneeRows = Array.from(assigneeMap.entries())
        .map(([name, buckets]) => ({ name, buckets, points: buckets.todo + buckets.inProgress + buckets.done }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
        .map(({ name, buckets }) => [name, buckets] as [string, { todo: number; inProgress: number; done: number }]);

    This matches the pattern used in WorkloadTab (b.points - a.points || a.name.localeCompare(b.name)).

    In SprintProgressTab.test.tsx, add a new test after the existing SPPG-03 test:

      it('SPPG-03: assignee rows sorted by total pts desc then alphabetically', async () => {
        const { fetchSprintIssues } = await import('@/services/jira');
        vi.mocked(fetchSprintIssues).mockResolvedValue([
          makeIssue('P-1', 'new', 5, { assigneeName: 'Alice' }),
          makeIssue('P-2', 'done', 3, { assigneeName: 'Bob' }),
          makeIssue('P-3', 'indeterminate', 8, { assigneeName: 'Charlie' }),
          makeIssue('P-4', 'new', 5, { assigneeName: 'Zara' }),  // tie with Alice — alpha second
        ]);

        const { default: SprintProgressTab } = await import('./SprintProgressTab');
        renderWithQuery(<SprintProgressTab />);

        await screen.findByText('Charlie');
        const rows = screen.getAllByTestId('assignee-row');
        expect(rows[0].querySelector('td')?.textContent).toBe('Charlie'); // 8 pts
        expect(rows[1].querySelector('td')?.textContent).toBe('Alice');   // 5 pts, alpha before Zara
        expect(rows[2].querySelector('td')?.textContent).toBe('Zara');    // 5 pts, alpha after Alice
        expect(rows[3].querySelector('td')?.textContent).toBe('Bob');     // 3 pts
      });
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx</automated>
  </verify>
  <done>All SprintProgressTab tests pass. Assignee rows ordered Charlie (8) → Alice (5) → Zara (5) → Bob (3) in the new sort test.</done>
</task>

</tasks>

<verification>
All existing SprintProgressTab tests continue to pass.
New sort-order test passes, confirming Charlie → Alice → Zara → Bob ordering.
</verification>

<success_criteria>
- `npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx` exits 0 with all tests green
- Line 123 of SprintProgressTab.tsx contains `b.points - a.points || a.name.localeCompare(b.name)`
</success_criteria>

<output>
After completion, create `.planning/quick/7-sort-assignees-by-total-story-points-in-/7-SUMMARY.md`
</output>
