---
phase: quick-260401-ffx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/BacklogPage.test.tsx
autonomous: true
requirements: [FFX-01, FFX-02, FFX-03]

must_haves:
  truths:
    - "Backlog rows have no checkboxes — no multi-select UI visible"
    - "No bottom bar (bulk action bar) appears anywhere in backlog view"
    - "Right-clicking a backlog row opens a context menu with 'Move to sprint' options"
    - "Context menu lists all available sprints (active + future) from sprintList"
    - "Selecting a sprint in context menu moves the issue to that sprint with optimistic update"
    - "Context menu styling matches existing StoryHeaderRow context menu pattern"
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Right-click context menu on backlog rows"
      contains: "ContextMenu"
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      provides: "Backlog page without checkboxes or bulk action bar"
  key_links:
    - from: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      to: "@/components/ui/context-menu"
      via: "ContextMenu wrapper around row"
      pattern: "ContextMenu"
    - from: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      to: "addIssuesToSprint"
      via: "context menu sprint selection callback"
      pattern: "onMoveToSprint"
---

<objective>
Remove checkboxes and bottom bulk-action bar from BacklogPage. Replace with a right-click context menu on each BacklogRow that provides "Move to sprint" options, consistent with the existing ContextMenu pattern used in StoryHeaderRow on the sprint board.

Purpose: Simplify the backlog UI by removing multi-select clutter and providing a more natural right-click interaction for moving issues to sprints.
Output: Checkbox-free backlog rows with right-click context menu for sprint operations.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/BacklogPage.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
@taskflow/src/routes/dashboard/StoryHeaderRow.tsx (reference pattern for ContextMenu usage)
@taskflow/src/components/ui/context-menu.tsx

<interfaces>
<!-- Existing ContextMenu components from @/components/ui/context-menu -->
From taskflow/src/components/ui/context-menu.tsx:
```typescript
export { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger };
```

From taskflow/src/services/jira.ts:
```typescript
export async function addIssuesToSprint(baseUrl: string, token: string, sprintId: number, issueKeys: string[]): Promise<void>;
```

From BacklogPage.tsx — sprintList data already available:
```typescript
// sprintList: JiraActiveSprint[] — ordered list of sprints (active + future)
// Each sprint has: { id: number, name: string, state: 'active' | 'future' | 'closed' }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove checkboxes and bulk action bar from BacklogPage and BacklogRow</name>
  <files>taskflow/src/routes/dashboard/BacklogPage.tsx, taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
**BacklogRow.tsx:**
1. Remove the checkbox column entirely — delete the `<div>` wrapping the `<input type="checkbox">` (lines 90-105).
2. Remove props: `selected`, `onSelect` from `BacklogRowProps` interface and component destructuring.
3. Update the grid-cols template to remove the 32px checkbox column: change `grid-cols-[32px_96px_auto_1fr_56px_40px]` to `grid-cols-[96px_auto_1fr_56px_40px]`.
4. Add new props to BacklogRowProps: `sprints?: Array<{ id: number; name: string; state: string }>` and `onMoveToSprint?: (issueKey: string, sprintId: number, sprintName: string) => void`.
5. Wrap the existing row `<div>` with `<ContextMenu>` / `<ContextMenuTrigger>` / `<ContextMenuContent>`, following the exact pattern from StoryHeaderRow.tsx (lines 114-155).
6. Context menu content:
   - `<ContextMenuLabel>Move to...</ContextMenuLabel>` + `<ContextMenuSeparator />`
   - Map over `sprints` prop: for each sprint, render a `<ContextMenuItem>` with sprint name. Active sprint gets a green badge like `(Active)`. On click, call `onMoveToSprint(issue.key, sprint.id, sprint.name)`.
   - If no sprints available, show "No sprints available" italic label (same pattern as StoryHeaderRow "No transitions available").
   - If `onMoveToSprint` is not provided, skip the ContextMenu wrapper entirely (render row directly, same conditional pattern as StoryHeaderRow lines 110-155).
7. Import ContextMenu components from `@/components/ui/context-menu`.

**BacklogPage.tsx:**
1. Update `GRID_COLS` constant to remove the 32px checkbox column: `'grid-cols-[96px_auto_1fr_56px_40px]'`.
2. Remove the empty checkbox header cell `<div className="w-8 px-3 py-2" />` from BacklogTable header row.
3. Remove `selectedKeys` state (`useState<Set<string>>`), `handleSelect` function, `bulkError` state, and `handleMoveToSprint` async function entirely.
4. Remove props `selectedKeys`, `onSelect` from BacklogTable component definition and its JSX usage.
5. Delete the entire bottom bulk action bar JSX block (lines 700-723, the `{selectedKeys.size > 0 && ...}` section).
6. Add a new `handleMoveToSprint` function that takes `(issueKey: string, sprintId: number, sprintName: string)`. This function should:
   - Optimistically remove the issue from the relevant cache (backlog-issues or sprint-stories or future-sprint-issues, depending on which section the issue is in).
   - Call `addIssuesToSprint(jiraBaseUrl!, jiraToken!, sprintId, [issueKey])`.
   - On success, invalidate all sprint/backlog queries (same invalidation pattern as existing handleMoveToSprint).
   - On error, rollback the optimistic update.
7. Pass `sprints` and `onMoveToSprint` props to each `<BacklogRow>`. The `sprints` prop should be the `orderedSprintSections.map(s => s.sprint)` — i.e., the sprint objects from sprintList. Only pass sprints that are active or future state.
8. Remove `selectedKeys` and `onSelect` from BacklogTable props and from BacklogRow usage inside BacklogTable.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>No checkboxes visible in backlog rows, no bottom bulk action bar, grid columns adjusted (5 columns instead of 6), right-click on any backlog row shows context menu with sprint options, selecting a sprint moves the single issue.</done>
</task>

<task type="auto">
  <name>Task 2: Update BacklogPage tests to match new context-menu behavior</name>
  <files>taskflow/src/routes/dashboard/BacklogPage.test.tsx</files>
  <action>
1. Remove all test code that references checkboxes: `row-checkbox-*` test IDs, `handleSelect`, `selectedKeys`, bulk action bar assertions.
2. Remove or update the BACK-02 test (bulk "Move to sprint") — it no longer applies in its current form. Replace with a test that verifies: when right-clicking a backlog row, a context menu appears (check for "Move to..." text in the document).
3. Keep all other tests intact (BACK-01 backlog list, BACK-03 create story, BACK-04 filters, BACK-05 row click, LOAD-04 epic skeleton).
4. Update any test that checks for the 32px checkbox column or 6-column grid layout.
5. Add the `fetchTransitions` mock if not already present (though it may not be needed since we're using sprints, not transitions).
6. Ensure `fetchSprintList` mock returns test sprint data so the context menu sprints are available.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>All BacklogPage tests pass. No references to checkboxes or bulk action bar in tests. Test coverage for right-click context menu presence.</done>
</task>

</tasks>

<verification>
1. `cd taskflow && npx tsc --noEmit` — zero type errors
2. `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx` — all tests pass
3. Visual check: backlog rows show 5 columns (key, epic, summary, points, assignee) — no checkbox column
4. Visual check: no bottom bar appears on backlog page
5. Visual check: right-clicking a row opens context menu with sprint names
</verification>

<success_criteria>
- Checkboxes completely removed from backlog rows
- Bottom bulk action bar completely removed
- Right-click context menu on backlog rows shows available sprints
- Moving an issue via context menu works with optimistic update
- Context menu styling matches existing StoryHeaderRow pattern
- All existing tests pass (updated for new behavior)
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260401-ffx-remove-checkboxes-and-bottom-bar-in-back/260401-ffx-SUMMARY.md`
</output>
