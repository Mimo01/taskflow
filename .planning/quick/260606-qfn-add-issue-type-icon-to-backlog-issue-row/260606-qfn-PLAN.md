---
phase: 260606-qfn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
autonomous: true
requirements: [QFN-01]

must_haves:
  truths:
    - "Each backlog row shows an issue-type icon in its own column positioned before the key column (type → key → priority → summary)"
    - "Each sprint-board story swimlane header shows an issue-type icon before the key button (type → key → priority → summary)"
    - "Rows/headers whose issue has no issuetype.name render no icon (no fallback CheckSquare leaks in)"
    - "The backlog type column does not collapse to 0 width in the virtualized/absolute-row table"
    - "npm run check stays green"
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Dedicated issue-type-icon <td> as first cell of RowCells"
      contains: "IssueTypeIcon"
    - path: "taskflow/src/routes/dashboard/StoryHeaderRow.tsx"
      provides: "issueTypeName prop + IssueTypeIcon rendered before key button"
      contains: "issueTypeName"
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "issueTypeName threaded into all three StoryHeaderRow call sites"
      contains: "issueTypeName="
  key_links:
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "StoryHeaderRow"
      via: "issueTypeName prop from story.fields.issuetype?.name"
      pattern: "issueTypeName=\\{.*issuetype\\?\\.name"
    - from: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      to: "IssueTypeIcon"
      via: "issue.fields.issuetype?.name guarded render"
      pattern: "issue\\.fields\\.issuetype\\?\\.name"
---

<objective>
Add an issue-type icon (Story/Bug/Task/Epic/Subtask) to the backlog issue row and the sprint-board story swimlane header, mirroring the existing PriorityIcon placement so the two surfaces stay visually consistent (icon-first ordering: type → key → priority → summary).

Purpose: Surface issue type at a glance in the two list/board views that currently omit it, reusing the existing `IssueTypeIcon` component.
Output: Modified `BacklogRow.tsx` (new type column), `StoryHeaderRow.tsx` (new prop + icon), and `SprintBoardTab.tsx` (prop wiring at all three call sites).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260606-qfn-add-issue-type-icon-to-backlog-issue-row/260606-qfn-CONTEXT.md
@.planning/quick/260606-qfn-add-issue-type-icon-to-backlog-issue-row/260606-qfn-RESEARCH.md
@taskflow/src/components/ui/issue-type-icon.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
@taskflow/src/routes/dashboard/StoryHeaderRow.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add issue-type column to BacklogRow</name>
  <files>taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
    Import `IssueTypeIcon` from `@/components/ui/issue-type-icon` alongside the existing
    `PriorityIcon` import.

    In the `RowCells` function (currently returning a fragment whose first child is the key
    `<td>` at line ~88), insert a NEW `<td>` as the FIRST child of the fragment, before the
    key cell. The cell mirrors the existing PriorityIcon cell pattern (lines 111-123) so the
    column does not collapse in the position:absolute virtualized table — use an inline-px
    sized span, NOT a Tailwind size class (per CONTEXT decision and MEMORY
    project_virtualized_table_zero_width_col):
      - `<td className="px-0 py-2 density-compact:py-1 density-comfortable:py-3">`
      - inner `<span className="flex items-center justify-center" style={{ width: 18, height: 18 }} aria-hidden={!issue.fields.issuetype}>`
      - guarded render inside the span: only render `<IssueTypeIcon typeName={issue.fields.issuetype.name} />`
        when `issue.fields.issuetype?.name` is truthy (IssueTypeIcon has no null guard and would
        otherwise show the default CheckSquare). Use the component's default className (no override).

    Resulting cell order: type → key → priority → summary → epic → points → assignee.
    `issue` is already a field of `cellsProps` — no prop plumbing needed; both render paths
    (lines ~292 and ~315) call the same `<RowCells {...cellsProps} />` and the overlay/ghost
    table reuses RowCells, so they all inherit the new column automatically. Per QFN-01.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "IssueTypeIcon" src/routes/dashboard/BacklogRow.tsx && grep -q "width: 18, height: 18" src/routes/dashboard/BacklogRow.tsx && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i BacklogRow; test $? -ne 0</automated>
  </verify>
  <done>BacklogRow renders an IssueTypeIcon in a dedicated, explicit-18px-wide `<td>` placed before the key cell; missing issuetype renders nothing; tsc reports no BacklogRow errors.</done>
</task>

<task type="auto">
  <name>Task 2: Add issueTypeName prop + icon to StoryHeaderRow and wire SprintBoardTab</name>
  <files>taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
    In `StoryHeaderRow.tsx`:
      - Import `IssueTypeIcon` from `@/components/ui/issue-type-icon`.
      - Add `issueTypeName?: string;` to `StoryHeaderRowProps` (the flat props interface, lines 33-68)
        and destructure it in the function signature (lines 70-92). This is required because
        StoryHeaderRow receives flat props, not a JiraIssue.
      - In the key/summary flex div (`<div className="flex items-center gap-2 flex-1 min-w-0">`,
        line ~127), insert the icon BEFORE the key `<button>` (line ~129), after the optional flag
        icon (line 128): guarded render `{issueTypeName && <IssueTypeIcon typeName={issueTypeName} />}`.
        Use the default className so size/color match the backlog usage. Resulting order:
        type → key → priority → summary.

    In `SprintBoardTab.tsx`, thread the new prop at ALL THREE StoryHeaderRow call sites:
      - Site ~line 484: add `issueTypeName={story.fields.issuetype?.name}`
      - Site ~line 659: add `issueTypeName={story.fields.issuetype?.name}`
      - Site ~line 1669 (sticky header): add `issueTypeName={stickyHeader.story.fields.issuetype?.name}`
    Place the prop adjacent to the existing `priority={...}` prop at each site for readability.
    Per QFN-01.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "issueTypeName" src/routes/dashboard/StoryHeaderRow.tsx && test "$(grep -c 'issueTypeName=' src/routes/dashboard/SprintBoardTab.tsx)" -eq 3 && grep -q "IssueTypeIcon" src/routes/dashboard/StoryHeaderRow.tsx</automated>
  </verify>
  <done>StoryHeaderRow accepts an optional issueTypeName prop and renders IssueTypeIcon before the key button when present; all three SprintBoardTab call sites pass the prop from the issuetype.name source.</done>
</task>

<task type="auto">
  <name>Task 3: Verify quality gate green</name>
  <files>taskflow/src/routes/dashboard/BacklogRow.tsx, taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
    Run the project quality gate from the `taskflow/` subdir and resolve any biome/tsc findings
    introduced by Tasks 1-2 (unused imports, formatting, type errors). Do not introduce broad
    refactors — only fix issues attributable to this change.
  </action>
  <verify>
    <automated>cd taskflow && npm run check</automated>
  </verify>
  <done>`npm run check` (biome check + tsc) exits 0 with no errors.</done>
</task>

</tasks>

<verification>
- Backlog row: type icon column appears before the key column, does not collapse to 0 width, renders nothing for issues lacking issuetype.
- Swimlane header (all three render paths incl. sticky): type icon appears before the key button.
- `npm run check` green.
</verification>

<success_criteria>
- Issue-type icon visible before the key in both the backlog row and the swimlane header, consistent in size/color (same `IssueTypeIcon`, default className).
- Missing issuetype.name produces no icon (no fallback CheckSquare).
- Backlog type column holds its width (explicit-px span).
- Quality gate passes.
</success_criteria>

<output>
Create `.planning/quick/260606-qfn-add-issue-type-icon-to-backlog-issue-row/260606-qfn-SUMMARY.md` when done
</output>
