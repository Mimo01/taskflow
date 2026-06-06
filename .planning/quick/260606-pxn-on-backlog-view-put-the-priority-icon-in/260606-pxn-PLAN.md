---
phase: quick-260606-pxn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: false
requirements: [PXN-01]
must_haves:
  truths:
    - "Each backlog task row displays the issue's Jira priority icon"
    - "Rows for issues with no priority (or no iconUrl) render no broken image"
    - "Priority icon is the existing Jira iconUrl image, not a new invented icon"
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "PriorityIcon rendered within the backlog row summary cell"
      contains: "PriorityIcon"
  key_links:
    - from: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      to: "taskflow/src/components/ui/priority-icon.tsx"
      via: "import { PriorityIcon }"
      pattern: "PriorityIcon"
---

<objective>
On the Backlog view, display each issue's Jira priority icon inside its task row, reusing the existing `PriorityIcon` component (the same one already used on the sprint board `TaskCard` and the `StoryHeaderRow`).

Purpose: Bring the backlog list to parity with the sprint board so users can scan priority at a glance without opening each issue.
Output: `BacklogRow.tsx` renders the priority icon per row.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md

# The row component to modify
@taskflow/src/routes/dashboard/BacklogRow.tsx

# The existing priority icon component to reuse (do NOT invent a new one)
@taskflow/src/components/ui/priority-icon.tsx

# Reference usage — how TaskCard wires PriorityIcon (mirror this prop-cast convention)
@taskflow/src/routes/dashboard/TaskCard.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Render PriorityIcon in the backlog row summary cell</name>
  <files>taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
    Import the existing `PriorityIcon` from `@/components/ui/priority-icon` (do NOT create a new icon — reuse this component, per the constraint that the 9-level Jira priority scheme already has a shared icon component).

    In the `RowCells` function, render `<PriorityIcon priority={...} />` inside the Summary cell's leading inline-flex span (the `<span className="inline-flex items-center gap-2 ...">` at line ~105), placed BEFORE the flag icon and summary text so priority reads as a leading meta indicator. Match the prop convention used in TaskCard.tsx (line ~218): pass `issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined`.

    `PriorityIcon` already returns null when priority or iconUrl is missing, so no broken images appear and no extra guard is needed. Use its default `className` (`w-3.5 h-3.5 shrink-0`) which already matches the row's existing `size-3.5 shrink-0` flag-icon sizing — do not override unless visual alignment requires it.

    Do not change the table column structure, the drag/sortable wiring, the context menu, or any other cell. This is an additive change to the summary cell content only.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && grep -q "PriorityIcon" src/routes/dashboard/BacklogRow.tsx && grep -q "from '@/components/ui/priority-icon'" src/routes/dashboard/BacklogRow.tsx && npm run check</automated>
  </verify>
  <done>BacklogRow imports and renders PriorityIcon in the summary cell; `npm run check` (biome + tsc) is GREEN; rows with no priority render no image.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>The priority icon now renders inside each Backlog view task row (leading the summary cell), reusing the existing Jira PriorityIcon component.</what-built>
  <how-to-verify>
    1. Run the app (`npm run dev` in taskflow/ if not already running) and open the Backlog view for a board with issues that have priorities set.
    2. Confirm each task row shows the correct Jira priority icon (e.g. Blocker/Must/High vs Minor) at the start of the summary, matching the icons shown on the Sprint Board cards.
    3. Confirm issues without a priority show no broken-image placeholder.
    4. Confirm row click (peek), key-link navigation, drag-to-rank, and right-click context menu still all work — the icon must not intercept clicks or break drag.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `PriorityIcon` is imported from the existing component path, not redefined.
- `npm run check` passes (biome + tsc clean).
- Backlog rows visually show priority icons consistent with the sprint board.
</verification>

<success_criteria>
Every backlog task row displays its issue's Jira priority icon using the shared `PriorityIcon` component, with graceful absence for issues lacking a priority, and no regression to row interactions (click/peek, navigate, drag-to-rank, context menu).
</success_criteria>

<output>
Create `.planning/quick/260606-pxn-on-backlog-view-put-the-priority-icon-in/260606-pxn-SUMMARY.md` when done.
</output>
