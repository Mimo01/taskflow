---
phase: quick-260523-neb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/index.tsx
autonomous: true
requirements:
  - QUICK-260523-NEB
must_haves:
  truths:
    - "At narrow viewports the three dashboard cards stack vertically (1 column) — no lonely card hanging on the left"
    - "At wide viewports (>= lg breakpoint, 1024px) the three cards sit on a single row (3 columns)"
    - "The 2+1 layout (2 cards on row 1, 1 orphan on row 2) never appears at any viewport width"
  artifacts:
    - path: "taskflow/src/routes/dashboard/index.tsx"
      provides: "Dashboard layout with rebalanced responsive grid"
      contains: "grid-cols-1 lg:grid-cols-3"
  key_links:
    - from: "taskflow/src/routes/dashboard/index.tsx"
      to: "Tailwind responsive grid"
      via: "className on cards container div"
      pattern: "grid-cols-1\\s+lg:grid-cols-3"
---

<objective>
Fix the unbalanced 2+1 card layout on the Dashboard page at medium viewport widths by removing the `sm:grid-cols-2` step so the grid jumps from 1 column (stacked) directly to 3 columns at the `lg` breakpoint.

Purpose: At the current breakpoints (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), viewports between `sm` (640px) and `lg` (1024px) render 2 cards on row 1 and 1 orphan card hanging on the left of row 2 — visually unbalanced. The user explicitly disliked this. Stacking vertically below `lg` is the cleanest fix and matches the "either all in a row or all stacked" mental model.

Output: One updated className string on the cards container in `taskflow/src/routes/dashboard/index.tsx`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/index.tsx

<interfaces>
<!-- Current grid container (line 89 of taskflow/src/routes/dashboard/index.tsx) -->
<!-- This is the ONE line that changes. -->

Current:
  <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">

Target:
  <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">

Cards inside (unchanged): DashboardSprintCard, DashboardInProgressCard, DashboardReleaseCard.
Tailwind breakpoints: sm=640px, lg=1024px. Removing `sm:grid-cols-2` makes the layout 1-col from 0 to 1023px and 3-col at 1024px+.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rebalance Dashboard cards grid — 1 column below lg, 3 columns at lg+</name>
  <files>taskflow/src/routes/dashboard/index.tsx</files>
  <action>
    In `taskflow/src/routes/dashboard/index.tsx`, locate the cards container div (currently line 89) with the className `"relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6"`. Remove the `sm:grid-cols-2` class so the className becomes `"relative grid grid-cols-1 lg:grid-cols-3 gap-6 p-6"`.

    Rationale (do not add as a comment in code — keep this change a one-liner): the intermediate 2-column step caused 3 cards to wrap as 2+1 (orphan on the left) at viewports between 640px and 1024px. Going straight from 1-col to 3-col guarantees the cards are either fully stacked or fully aligned in a row, never orphaned.

    Do NOT change the cards themselves, the gap, the padding, the wrapping `<div className="relative flex flex-col min-h-full bg-background">`, the welcome `<section>`, or the SVG. Only the grid-cols utilities on the cards container change.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow &amp;&amp; grep -E 'grid-cols-1 lg:grid-cols-3 gap-6 p-6' src/routes/dashboard/index.tsx &amp;&amp; ! grep -E 'sm:grid-cols-2' src/routes/dashboard/index.tsx &amp;&amp; npx biome check src/routes/dashboard/index.tsx</automated>
  </verify>
  <done>
    The container div className on line 89 of `taskflow/src/routes/dashboard/index.tsx` reads exactly `"relative grid grid-cols-1 lg:grid-cols-3 gap-6 p-6"`, the string `sm:grid-cols-2` no longer appears in the file, and Biome reports no errors for that file. At runtime, narrow viewports (<1024px) stack the three cards vertically and wider viewports place them on a single row.
  </done>
</task>

</tasks>

<verification>
- `grep -n 'grid-cols' taskflow/src/routes/dashboard/index.tsx` shows only `grid-cols-1 lg:grid-cols-3` on the cards container; no `sm:grid-cols-2` anywhere in the file.
- `cd taskflow && npx biome check src/routes/dashboard/index.tsx` passes.
- Manual sanity (optional, not gating): run the app and resize from ~700px → ~1100px — cards transition from stacked (1 col) directly to a single row (3 cols), never showing a 2+1 orphan.
</verification>

<success_criteria>
- Exactly one line changed in `taskflow/src/routes/dashboard/index.tsx` (the cards container className).
- The 2+1 unbalanced layout is impossible at any viewport width.
- No regressions to the welcome hero section, SVG background, or card content.
</success_criteria>

<output>
Create `.planning/quick/260523-neb-on-dashboard-there-are-3-cards-on-smalle/260523-neb-SUMMARY.md` when done.
</output>
