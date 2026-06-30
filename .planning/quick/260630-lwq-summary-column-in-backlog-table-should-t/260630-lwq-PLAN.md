---
phase: quick
plan: 260630-lwq
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: true
requirements: [VISUAL-01]
must_haves:
  truths:
    - "Summary text fills all available horizontal space in its column before truncating"
    - "Ellipsis appears when summary text is genuinely too long for the remaining space"
    - "Flag icon and OverdueBadge still render inline with the summary"
    - "Epic/fix-version column is unaffected and still right-aligned"
  artifacts:
    - path: taskflow/src/routes/dashboard/BacklogRow.tsx
      provides: "Fixed summary cell flex layout"
      contains: "flex items-center gap-2"
  key_links:
    - from: "summary td (max-w-0 w-full)"
      to: "inner flex span"
      via: "block-level flex fills td width → truncate fires at cell boundary"
      pattern: "flex items-center.*min-w-0"
---

<objective>
Fix the backlog summary column so it fills all available horizontal space and only truncates when the content genuinely does not fit.

Purpose: The summary `<td>` uses `max-w-0 w-full` to grow and fill remaining table width, but the inner wrapper is `inline-flex`, which is an inline-level box that sizes to its content — not to the cell width. This means the child `<span class="truncate">` never has a constrained parent to truncate against: long summaries overflow the cell boundary (clipped invisibly by `overflow-hidden`), while short summaries sit on the left with empty space to the right. Switching to a block-level `flex` span with `min-w-0` gives the container a proper width boundary, allowing `truncate` to fire exactly when needed.

Output: One file changed — BacklogRow.tsx summary cell inner wrapper corrected.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/BacklogRow.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix summary cell inner wrapper from inline-flex to block-level flex</name>
  <files>taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
In `RowCells`, locate the summary `<td>` (the one with `max-w-0 w-full px-2 py-2 ... overflow-hidden whitespace-nowrap text-ellipsis`).

Inside it, change the wrapper `<span>` from `inline-flex` to `flex` and add `min-w-0` so it fills the full cell width as a block-level flex container:

Before:
  `className="inline-flex items-center gap-2 text-sm text-left"`

After:
  `className="flex items-center gap-2 text-sm min-w-0"`

Also remove `whitespace-nowrap` and `text-ellipsis` from the `<td>` itself — these are text-node properties that don't cascade into flex children and are redundant now that the `<span class="truncate">` handles it directly. Keep `overflow-hidden` on the td.

The summary text `<span className="truncate">` already has `truncate` (overflow-hidden + text-ellipsis + whitespace-nowrap). With a block-level flex parent that has `min-w-0`, the flex item can shrink below its content size and the ellipsis will fire correctly.

The `isFlagged` Flag icon already has `shrink-0` — no change needed there.
The `OverdueBadge` renders after the summary text; no change needed.

Do NOT change the epic cell (`max-w-[20rem]`), the story-points cell, or any other column.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npm run check 2>&1 | tail -20</automated>
  </verify>
  <done>
    - BacklogRow.tsx summary cell inner span uses `flex items-center gap-2 text-sm min-w-0` (block-level flex, not inline-flex)
    - `whitespace-nowrap text-ellipsis` removed from the `<td>` (overflow-hidden remains)
    - `npm run check` passes with no type errors or lint warnings
  </done>
</task>

</tasks>

<verification>
After the change: open the backlog with issues whose summaries vary widely in length. Short summaries should show the full text with whitespace to the right; long summaries should truncate with an ellipsis exactly at the cell boundary (where the epic/fix-version column begins). The summary column should not collapse or leave unexplained gaps.
</verification>

<success_criteria>
- Summary text fills all space to the left of the epic/fix-version column
- Ellipsis appears on genuinely long summaries, not on short ones
- Flag icon and OverdueBadge remain inline and do not break layout
- `npm run check` clean
</success_criteria>

<output>
Create `.planning/quick/260630-lwq-summary-column-in-backlog-table-should-t/260630-lwq-SUMMARY.md` when done.
</output>
