---
phase: quick-261105-fkj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/my-tasks/MyTaskRow.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
  - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
  - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/TodayColumn.test.tsx
autonomous: true
requirements: [QUICK-261105-fkj]

must_haves:
  truths:
    - "In My Tasks (My Day bands and the sprint-grouped All Assigned / All Reported views), a faint hairline separates each story group (story row + its shown subtask rows) from the next"
    - "No hairline appears between a story row and its own subtask rows, nor above the first group or below the last group of a band/section"
    - "Standup Today (In Progress, Up Next) and Yesterday (Worked On) show the same faint hairline between story groups (story + nested subtask/MR/activity rows)"
    - "Row heights are unchanged at every density; the total spacing between two groups stays equal to the old gap (hairline sits centred in it)"
  artifacts:
    - path: "taskflow/src/routes/my-tasks/MyTaskRow.tsx"
      provides: "Top-level (non-subtask) MyTaskRow renders a single group wrapper div around the story row + subtask rows"
      contains: "my-task-group"
    - path: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      provides: "Band/sprint row containers use divide-y divide-border/40 instead of space-y"
      contains: "divide-border/40"
    - path: "taskflow/src/routes/standup-notes/TodayInProgressSection.tsx"
      provides: "Group list uses divide-y divide-border/40; per-row wrapper carries half-gap padding"
      contains: "divide-border/40"
    - path: "taskflow/src/routes/standup-notes/TodayUpNextSection.tsx"
      provides: "Same as In Progress"
      contains: "divide-border/40"
    - path: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      provides: "Worked On list uses divide-y divide-border/40"
      contains: "divide-border/40"
  key_links:
    - from: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      to: "MyTaskRow group wrapper"
      via: "divide-y on the parent list container draws border between direct-child group wrappers"
      pattern: "divide-y divide-border/40"
---

<objective>
Add a subtle hairline between story groups in My Tasks and the Standup Today/Yesterday lists. A "group" = story row + all rows rendered beneath it (subtasks, nested MRs, activity sub-items). The line goes between groups only, never between a story and its own children.

Purpose: long lists of stories with indented subtasks currently run together; a faint divider makes group boundaries scannable without changing the row design.
Output: grouped wrappers + `divide-y divide-border/40` list containers in 5 components, plus structural tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Repo layout: `.planning` + git at outer `/Users/mimo/Documents/Projects/taskflow`; app source, npm, vitest, biome in inner `taskflow/taskflow/`. Run all npm/vitest/biome commands from `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Findings (current state, verified while planning):

1. **My Tasks** — `taskflow/src/routes/my-tasks/MyTaskRow.tsx` (lines ~372-390) returns a FRAGMENT: `rowContent` then `subtasks.map(... <MyTaskRow isSubtask .../>)`. So rows are NOT grouped in the DOM; each story row and each subtask row is a direct child of the list container in `MyTasksPage.tsx`:
   - `renderMyDayList` line ~589: `<div className="space-y-0.5 density-compact:space-y-0 density-comfortable:space-y-1">` around `sortedParents.map(... renderFlatRows ...)`
   - `renderBySprintList` line ~683: identical class string around `groupParents.map(... renderFlatRows ...)`
   - `renderFlatRows` (line ~520) renders exactly one top-level `<MyTaskRow>` per parent — MyTaskRow is used only here (and in MyTaskRow.test.tsx).
2. **Standup Today** — `TodayInProgressSection.tsx` (line ~230) and `TodayUpNextSection.tsx` (line ~240) ALREADY wrap each group in `<div key={row.issue.key}>` (IssueRow + subtask IssueRows + NestedMrRows) inside `<div className="flex flex-col gap-1 density-compact:gap-0.5 density-comfortable:gap-2">`. Rows inside a group have no gap between them.
3. **Standup Yesterday** — `YesterdayColumn.tsx` "Worked On" (line ~771) `<div className="flex flex-col gap-1 density-compact:gap-0.5 density-comfortable:gap-2">` maps `<IssueActivityGroup>`; `IssueActivityGroup.tsx` (line ~258) root is a bare `<div>` containing the story header + nested sub-items/subtask groups. So it is already one wrapper per group.
4. Existing convention: hairlines in this area are `border-border/40` (MyTasksPage.tsx line ~152) / `border-border/50`; other standup lists (TodayMrsSection, TodayParticipatingSection, Other Merge Requests) use `divide-y divide-border`. Use `divide-y divide-border/40` (subtle) — do not touch the MR/participating/standalone lists (they are not story lists).
5. Density variant: `@variant density-compact (&:is([data-density="compact"] *))` in `src/index.css`.

Design approach (chosen to satisfy Tailwind v4 pitfalls — no negative margins, no `first:` vs density-variant specificity fights):
- Put `divide-y divide-border/40` on the LIST container (Tailwind v4 divide-y draws a border between direct children only — never above the first or below the last).
- Remove the container's `space-y-*` / `gap-*` and instead give each GROUP WRAPPER symmetric vertical padding equal to half the old gap, so the gap between groups is unchanged and the hairline sits centred in it. Row elements themselves are not touched → row height unchanged (one row = one line preserved).
- Half-gap mapping:
  - My Tasks old `space-y-0.5 / compact space-y-0 / comfortable space-y-1` (2px / 0 / 4px) → wrapper `py-px density-compact:py-0 density-comfortable:py-0.5`.
  - Standup old `gap-1 / compact gap-0.5 / comfortable gap-2` (4px / 2px / 8px) → wrapper `py-0.5 density-compact:py-px density-comfortable:py-1`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: My Tasks — wrap each story + subtasks in a group and divide groups with a hairline</name>
  <files>taskflow/src/routes/my-tasks/MyTaskRow.tsx, taskflow/src/routes/my-tasks/MyTasksPage.tsx, taskflow/src/routes/my-tasks/MyTasksPage.test.tsx</files>
  <behavior>
    - Rendering My Tasks with two parent stories (one having 2 subtasks) produces exactly two elements with `data-testid="my-task-group"`; the first contains the story row and both subtask rows (the subtask keys are found `within` the first group), the second contains only its story.
    - Each band's row container (the parent element of the groups) has classes `divide-y` and `divide-border/40` and no `space-y-0.5`.
    - Subtask rows do NOT get their own `my-task-group` wrapper (nested count stays 2, not 4).
  </behavior>
  <action>
    In `MyTaskRow.tsx`, change the final return: when `isSubtask` is false, return a `<div data-testid="my-task-group">` with className `space-y-0.5 density-compact:space-y-0 density-comfortable:space-y-1 py-px density-compact:py-0 density-comfortable:py-0.5` wrapping `rowContent` and the `subtasks.map(...)` subtask rows (the space-y moves inside the group so in-group row spacing is unchanged). When `isSubtask` is true keep returning just the row (fragment or rowContent — subtasks is always empty there). Use `cn` only if needed; a static string is fine. Do not touch row classes (`rowContent`, subtask row `ml-9 ... py-1.5` classes) — row height must stay identical.

    In `MyTasksPage.tsx`, replace the class on BOTH row containers (`renderMyDayList` ~line 589 and `renderBySprintList` ~line 683) `space-y-0.5 density-compact:space-y-0 density-comfortable:space-y-1` with `divide-y divide-border/40`. Leave the outer band container (`space-y-4 ...`) and `GroupHeader` untouched. Do not do a bulk find-replace of the class string — edit the two sites individually and grep afterwards to confirm both changed (the string also appears in the new MyTaskRow wrapper, which is expected).

    In `MyTasksPage.test.tsx`, add a `describe('MyTasksPage — story group separators (261105-fkj)', ...)` block reusing the existing render helpers/fixtures in that file (look at the 'DONE parent subtask suppression (260618-ckn)' block for how parents + subtasks are mocked) asserting the behavior bullets above via `screen.getAllByTestId('my-task-group')`, `within(group).getByText(subtaskKey)`, and `group.parentElement` classList checks. Write tests and implementation together and commit once (pre-commit hook runs the full suite and blocks RED commits).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/my-tasks && npx biome check src/routes/my-tasks && grep -c "divide-y divide-border/40" src/routes/my-tasks/MyTasksPage.tsx</automated>
  </verify>
  <done>My Tasks tests (existing + new) pass; biome clean on the my-tasks folder; grep count of `divide-y divide-border/40` in MyTasksPage.tsx is 2; MyTaskRow.test.tsx still passes unchanged (or with only selector-level adjustments if it asserted a fragment root).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Standup Today + Yesterday — divide story groups with the same hairline</name>
  <files>taskflow/src/routes/standup-notes/TodayInProgressSection.tsx, taskflow/src/routes/standup-notes/TodayUpNextSection.tsx, taskflow/src/routes/standup-notes/YesterdayColumn.tsx, taskflow/src/routes/standup-notes/IssueActivityGroup.tsx, taskflow/src/routes/standup-notes/TodayColumn.test.tsx</files>
  <behavior>
    - TodayColumn rendered with two In Progress stories (one with a subtask) yields two `data-testid="standup-story-group"` elements; the subtask key is inside the first group; their shared parent has `divide-y` and `divide-border/40` and no `gap-1`.
  </behavior>
  <action>
    In `TodayInProgressSection.tsx` (~line 230) and `TodayUpNextSection.tsx` (~line 240): change the group list container class from `flex flex-col gap-1 density-compact:gap-0.5 density-comfortable:gap-2` to `flex flex-col divide-y divide-border/40`, and give the existing per-group wrapper `<div key={row.issue.key}>` `data-testid="standup-story-group"` plus className `py-0.5 density-compact:py-px density-comfortable:py-1`. Do NOT change the Up Next empty-state div or IssueRow/NestedMrRow classes.

    In `YesterdayColumn.tsx` "Worked On" list (~line 771): change the container class the same way (`flex flex-col divide-y divide-border/40`). In `IssueActivityGroup.tsx`, give the root `<div>` (~line 258) `data-testid="standup-story-group"` and className `py-0.5 density-compact:py-px density-comfortable:py-1`. Leave the nested subtask sub-group divs unchanged (no lines between a story and its subtasks). Do not touch the "Other Merge Requests" `divide-y divide-border` list, TodayMrsSection, or TodayParticipatingSection.

    Edit each site individually (the gap class string occurs in several files/places, including the outer `gap-6` Yesterday container which must stay). Add a `describe('Story group separators (261105-fkj)', ...)` block to `TodayColumn.test.tsx` reusing the fixture setup from the existing 'Parent story with subtasks — gap #5 regression guard' block, asserting the behavior above. Single commit for tests + implementation.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/standup-notes && npx biome check src/routes/standup-notes && grep -l "divide-y divide-border/40" src/routes/standup-notes/TodayInProgressSection.tsx src/routes/standup-notes/TodayUpNextSection.tsx src/routes/standup-notes/YesterdayColumn.tsx | wc -l && grep -c "standup-story-group" src/routes/standup-notes/IssueActivityGroup.tsx</automated>
  </verify>
  <done>Standup tests (existing + new) pass; biome clean on standup-notes; all three list files contain `divide-y divide-border/40` (count 3); IssueActivityGroup root carries the group testid; MR/participating lists unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Pure presentational class/DOM-wrapper change; no new input, data, or network paths |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261105-fkj-01 | Denial of Service | list rendering | accept | One extra div per story group; negligible render cost |
</threat_model>

<verification>
- `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/my-tasks src/routes/standup-notes` green.
- `npx tsc --noEmit` clean; `npx biome check src/routes/my-tasks src/routes/standup-notes` reports no new diagnostics (do NOT run `biome --write` on all of src).
- Visual sanity (executor, optional): in the app at compact/default/comfortable density, a faint line between story groups, none between story and its subtasks, none above the first/below the last group; row heights unchanged.
</verification>

<success_criteria>
- Faint `divide-border/40` hairline between story groups in My Tasks (both list modes), Standup Today In Progress/Up Next, and Yesterday Worked On.
- No hairline inside a group; inter-group spacing equals the previous gap; row heights unchanged at every density.
- New structural tests pass alongside the full existing suite (pre-commit hook).
</success_criteria>

<output>
Create `.planning/quick/261105-fkj-story-group-separators/261105-fkj-SUMMARY.md` when done
</output>
