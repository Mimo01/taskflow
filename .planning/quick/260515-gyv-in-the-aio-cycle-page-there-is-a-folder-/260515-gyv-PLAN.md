---
phase: quick-260515-gyv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
autonomous: false
requirements:
  - QUICK-260515-GYV-01
must_haves:
  truths:
    - "Folder rows in the AIO cycle page reserve right-side padding so the count badge is not flush against the panel edge"
    - "Existing folder selection, expansion, and badge visibility behavior is unchanged"
  artifacts:
    - path: "taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx"
      provides: "FolderNode button with right padding so the count Badge breathes"
      contains: "pr-3"
  key_links:
    - from: "FolderNode button className"
      to: "Badge with count"
      via: "right padding on the button container"
      pattern: "pr-3"
---

<objective>
Fix the visual bug on the AIO cycle page: folder rows in the left-side folder tree have no right padding, so the count pill/badge sits flush against the right edge of the folder section.

Purpose: Restore visual breathing room so the count badge does not appear cut at the section boundary.
Output: Updated `FolderNode` button in `AioProjectOverviewPage.tsx` with right padding applied to the row.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
@taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx

<interfaces>
<!-- The current FolderNode button (lines 121-150 of AioProjectOverviewPage.tsx) -->
<!-- relevant excerpt: -->

The folder row is a `<button>` with:
- `className="w-full flex items-center gap-1 py-2 text-left text-sm transition-colors ..."`
- inline `style={{ paddingLeft }}` where `paddingLeft = 12 + depth * 16`
- Inner layout: ChevronRight (or spacer) → `<span className="flex-1 truncate">{node.name}</span>` → `<Badge variant="secondary" className="ml-1 shrink-0">{count}</Badge>` (only when `count > 0`)

There is currently NO right padding on the button — neither via Tailwind class (`pr-*`) nor inline style — so the Badge ends exactly at the row's right edge.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add right padding to FolderNode button</name>
  <files>taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx</files>
  <action>In the `FolderNode` component (around line 121-150), add `pr-3` to the folder row button's `className` so the count Badge has breathing room from the right edge of the folder section. The button currently has no right padding — only `paddingLeft` via inline style and `py-2` vertical padding. Insert `pr-3` into the existing className string (e.g., after `py-2`): `className={`w-full flex items-center gap-1 py-2 pr-3 text-left text-sm transition-colors ${...}`}`. Do NOT touch the inline `style={{ paddingLeft }}` — depth-based left padding must remain intact. Do NOT modify the Badge's own classes (`ml-1 shrink-0`) or the truncating name span. The change is a single className token addition.</action>
  <verify>
    <automated>cd taskflow && npm test -- --run src/routes/dashboard/AioProjectOverviewPage.test.tsx</automated>
  </verify>
  <done>The `FolderNode` button className contains `pr-3`. All existing `AioProjectOverviewPage.test.tsx` tests still pass. Lint is clean for the modified file.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Folder rows in the AIO cycle page now have right padding so the count badge no longer touches the section edge.</what-built>
  <how-to-verify>
    1. Run `cd taskflow && npm run dev` (or use the running dev instance).
    2. Open the app, navigate to the AIO Projects → cycle/folder overview page (left-side folder tree with cycles).
    3. Locate a folder row that displays a count badge (a folder with cycles in it).
    4. Confirm the count pill/badge is no longer cut off against the right edge of the folder section — there should be visible space (~12px) between the badge and the right edge of the panel.
    5. Confirm folder selection, expand/collapse, and badge rendering still behave correctly (click rows, expand parents, verify counts still show).
    6. Optional: inspect a folder row in DevTools and confirm `padding-right: 12px` (from `pr-3`) is applied to the button.
  </how-to-verify>
  <resume-signal>Type "approved" or describe the remaining visual issue.</resume-signal>
</task>

</tasks>

<verification>
- Existing tests in `AioProjectOverviewPage.test.tsx` still pass (folder rendering, selection, expansion, badge count visibility).
- Manual visual confirmation: count badge in folder rows is no longer flush against the right edge of the folder section.
</verification>

<success_criteria>
- `FolderNode` button has `pr-3` in its className.
- No other behavior change in the folder tree (depth-based left padding, selection state, expansion state, badge visibility all unchanged).
- All existing tests pass.
- Human verifies the visual fix in the running app.
</success_criteria>

<output>
Create `.planning/quick/260515-gyv-in-the-aio-cycle-page-there-is-a-folder-/260515-gyv-SUMMARY.md` when done.
</output>
