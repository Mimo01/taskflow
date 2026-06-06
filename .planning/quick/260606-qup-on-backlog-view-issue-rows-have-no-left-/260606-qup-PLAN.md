---
phase: quick-260606-qup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: false
requirements: [QUP-01]
must_haves:
  truths:
    - "Backlog issue rows have left padding so the issue-type icon is not flush against the row's left edge"
    - "Backlog issue rows have right padding so the assignee avatar is not flush against the row's right edge"
    - "Row content horizontal padding matches the px-4 convention used by the section header above the table"
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Backlog row cells with edge padding on first (type icon) and last (assignee) columns"
      contains: "pl-4"
  key_links:
    - from: "BacklogRow.tsx RowCells first <td> (issue-type icon)"
      to: "row left edge"
      via: "left padding class"
      pattern: "pl-4"
    - from: "BacklogRow.tsx RowCells last <td> (assignee)"
      to: "row right edge"
      via: "right padding class"
      pattern: "pr-4"
---

<objective>
Add horizontal edge padding to Backlog issue rows so the leftmost content (issue-type icon) and rightmost content (assignee avatar) have comfortable breathing room from the row edges, matching the `px-4` convention already used by the section header above the table.

Purpose: Fix a visual spacing defect where row content sits flush against the left/right edges.
Output: Updated `BacklogRow.tsx` with edge padding on the first and last cells.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# The row component to edit (already located — RowCells renders all <td> cells):
@taskflow/src/routes/dashboard/BacklogRow.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add left/right edge padding to Backlog row cells</name>
  <files>taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
In the `RowCells` function, two cells sit flush against the row edges and need edge padding. The horizontal-edge convention in this view is `px-4` (used by the section header in BacklogPage.tsx, e.g. line ~1060).

1. FIRST cell — the issue-type icon `<td>` (currently `className="px-0 py-2 density-compact:py-1 density-comfortable:py-3"`, around line 95). Change the horizontal padding from `px-0` to `pl-4 pr-0` so the icon gains left breathing room while preserving the explicit-width inner span technique (do NOT touch the inner `<span>` with `style={{ width: 18, height: 18 }}`).

2. LAST cell — the assignee `<td>` (currently `className="w-10 px-2 py-2 density-compact:py-1 density-comfortable:py-3"`, around line 197). Change `px-2` to `pl-2 pr-4` so the avatar gains right breathing room. Keep `w-10` and the CachedAvatar untouched.

Do not change any other cells, the row `<tr>`, the drag/sortable wiring, or the inner pixel-sized spans. This is a CSS-class-only change to two `className` strings. Both render paths (plain `<tr>` and the ContextMenu-wrapped `<tr>`) share the same `RowCells`, so editing `RowCells` covers both.
  </action>
  <verify>
    <automated>cd taskflow && npm run check</automated>
  </verify>
  <done>BacklogRow.tsx first icon cell uses `pl-4 pr-0` and assignee cell uses `pl-2 pr-4`; `npm run check` (biome + tsc) is GREEN with no new errors.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Added left padding (`pl-4`) to the issue-type icon cell and right padding (`pr-4`) to the assignee cell in Backlog issue rows.</what-built>
  <how-to-verify>
1. Run the app (`cd taskflow && npm run tauri dev` or the project's usual dev command).
2. Navigate to the Backlog view.
3. Confirm the issue-type icon on the left of each row now has visible breathing room from the row's left edge (no longer flush).
4. Confirm the assignee avatar on the right of each row now has visible breathing room from the row's right edge (no longer flush).
5. Confirm the left/right padding roughly aligns with the section header text above the table (the `px-4` convention).
6. Confirm columns still render correctly — no collapsed/0-width columns, icons still aligned.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any spacing/alignment issues.</resume-signal>
</task>

</tasks>

<verification>
- `npm run check` passes (biome lint/format + tsc) with no new errors.
- Visual: type icon and assignee avatar have comfortable edge spacing matching the `px-4` header convention.
- No column collapse regression in the virtualized table.
</verification>

<success_criteria>
- Backlog rows render the issue-type icon with left padding and the assignee with right padding.
- Padding visually matches the section-header `px-4` alignment.
- Build/lint/typecheck GREEN; no other behavior changed.
</success_criteria>

<output>
Create `.planning/quick/260606-qup-on-backlog-view-issue-rows-have-no-left-/260606-qup-SUMMARY.md` when done.
</output>
