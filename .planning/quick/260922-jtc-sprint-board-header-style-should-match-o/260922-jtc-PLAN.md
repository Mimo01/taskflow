---
phase: quick-260922-jtc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/SprintBoardHeader.tsx
  - taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx
autonomous: false
requirements: [QUICK-260922-JTC]

must_haves:
  truths:
    - "The sprint name on the Sprint Board renders at the same text size/weight as the 'Backlog' title on the Backlog page (text-lg font-semibold)"
    - "The Sprint Board header band has the same vertical/horizontal size as the Backlog page header band (px-4 py-3, border-b)"
    - "The sprint state badge and sprint goal still render inline on one line, with the goal de-emphasized and truncating"
    - "Header still returns null when there is no name and no goal"
  artifacts:
    - path: "taskflow/src/routes/dashboard/SprintBoardHeader.tsx"
      provides: "Page-header-matching sprint header"
      contains: "text-lg font-semibold"
    - path: "taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx"
      provides: "Regression coverage for heading semantics/size"
  key_links:
    - from: "taskflow/src/routes/dashboard/SprintBoardHeader.tsx"
      to: "taskflow/src/routes/dashboard/BacklogPage.tsx header band"
      via: "shared class treatment px-4 py-3 border-b + h1 text-lg font-semibold"
      pattern: "px-4 py-3"
---

<objective>
Make the Sprint Board header read as the same app-level page header as the Backlog page header.

Purpose: Today the Sprint Board sprint name is `text-sm font-semibold` inside a tinted `bg-muted/40` band with `px-3 py-1.5` padding, while every other page (Backlog, Merge Requests, Settings sections) uses an untinted `px-4 py-3 border-b` band with an `text-lg font-semibold` heading. The mismatch makes the Sprint Board look like a sub-toolbar rather than a page.

Output: Restyled `SprintBoardHeader.tsx` matching the Backlog header band and title size, plus test coverage locking the heading semantics.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/SprintBoardHeader.tsx
@taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx

Reference header (the canonical pattern to match) — `taskflow/src/routes/dashboard/BacklogPage.tsx` line 1301-1302:
container `div` with `flex items-center justify-between px-4 py-3 border-b flex-shrink-0`, title `h1` with `text-lg font-semibold`.
Same pattern in `taskflow/src/routes/dashboard/MergeRequestListPage.tsx:123` and all `src/routes/settings/*Section.tsx` (`h2 text-lg font-semibold`).

Render site (do not change): `taskflow/src/routes/dashboard/SprintBoardTab.tsx:1617-1629` — `SprintBoardHeader` is the first child of the fixed `shrink-0 bg-background` chrome stack, above `QuickFilterChipRow` and `UnifiedFilterBar`. It is a flex child of a `flex flex-col h-full` container, so a taller header is absorbed by the `flex-1` scroll area below.

Project notes that apply:
- One row = one line at every density — the name/badge/goal must stay on a single line; do not wrap the goal to a second line.
- Italic/truncate clipping: the goal span already carries `pr-0.5`; keep it.
- The pre-commit hook runs the full vitest suite, so combine the test edit and implementation in a single commit per task.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Restyle SprintBoardHeader to the canonical page-header treatment</name>
  <files>taskflow/src/routes/dashboard/SprintBoardHeader.tsx, taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx</files>
  <behavior>
    - Sprint name renders as a level-1 heading: `screen.getByRole('heading', { level: 1, name: 'Sprint 42' })` exists.
    - The heading element's className contains `text-lg` and `font-semibold`.
    - The `banner` element's className contains `px-4` and `py-3` and does NOT contain `bg-muted/40`.
    - Existing behaviors still pass unchanged: goal renders inline, no goal element for null/empty/whitespace goal, returns null when name and goal are both absent/whitespace, state badge renders only when `state` is truthy, `banner` role with accessible name matching /sprint/i.
  </behavior>
  <action>
    In `SprintBoardHeader.tsx`:
    1. Change the `<header>` className from `flex items-center gap-2 min-w-0 bg-muted/40 border-b border-border px-3 py-1.5 density-compact:py-1 density-comfortable:py-2.5` to `flex items-center gap-2 min-w-0 border-b px-4 py-3` — drop the `bg-muted/40` tint and the density padding modifiers so the band geometry is byte-for-byte the same as the Backlog header band (`px-4 py-3 border-b`). Keep `role="banner"` and `aria-label="Sprint header"` and the biome-ignore comment above the element.
    2. Replace the sprint-name `<span>` with an `<h1>` carrying `min-w-0 max-w-[40%] truncate text-lg font-semibold text-foreground` (drop `shrink-0` — `truncate` + `min-w-0` handles overflow, and `shrink-0` alongside `max-w-[40%]` fights the flex row).
    3. Leave the state `<Badge variant="secondary" tone="green" className="shrink-0">`, the middle-dot separator span, and the goal span (`flex-1 min-w-0 truncate pr-0.5 text-xs text-muted-foreground` with `title`) exactly as-is — the goal stays de-emphasized inline text per the prior 260922-irb decision.
    4. Update the file's top doc comment: it currently claims the component is styled to match "the Backlog section-header treatment (bg-muted/40 tint, solid border-b)". Restate it as matching the Backlog *page* header band (`px-4 py-3 border-b`, `text-lg font-semibold` title).

    In `SprintBoardHeader.test.tsx`, add two tests before running: one asserting the level-1 heading exists with the sprint name and its className includes `text-lg` and `font-semibold`; one asserting the banner className includes `px-4` and `py-3` and excludes `bg-muted/40`. Do not delete or weaken any existing test.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/SprintBoardHeader.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx</automated>
    <automated>cd taskflow && npx tsc --noEmit</automated>
    <automated>cd taskflow && grep -v '^ \*' src/routes/dashboard/SprintBoardHeader.tsx | grep -c 'text-lg font-semibold'</automated>
  </verify>
  <done>All SprintBoardHeader tests pass including the two new size/semantics assertions; typecheck clean; no `bg-muted/40` or `density-compact:py-` remains in the file.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Sprint Board header band and sprint title restyled to match the Backlog page header (untinted `px-4 py-3 border-b` band, `text-lg font-semibold` h1 title), with the state badge and goal still inline on one line.</what-built>
  <how-to-verify>
    1. Run `cd taskflow && npm run tauri dev` (or the usual dev command).
    2. Open the Backlog page. Note the "Backlog" title size and the height of the header band above the filter bar.
    3. Switch to the Sprint Board. The sprint name should read at the same size/weight as "Backlog", and the header band should be the same height with the same left padding; the chip row and filter bar sit directly beneath it, unchanged.
    4. Confirm the state badge and the sprint goal are still on the same single line as the name, goal still truncates with a tooltip on a long goal, and there is no leftover grey tint behind the header.
    5. Toggle density (compact / comfortable) and confirm the header still reads as one line and no longer shrinks out of alignment with the Backlog header.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what still looks off (include a screenshot or the rendered DOM for any spacing complaint).</resume-signal>
</task>

</tasks>

<verification>
- `npx vitest run src/routes/dashboard/SprintBoardHeader.test.tsx` passes
- `npx tsc --noEmit` clean
- `npx biome check src/routes/dashboard/SprintBoardHeader.tsx` flags no new files (baseline drifts — gate on no NEW findings, not an absolute count)
- Human confirms visual parity with the Backlog header
</verification>

<success_criteria>
- Sprint name renders as `h1` with `text-lg font-semibold`, matching Backlog's title
- Header band uses `px-4 py-3 border-b`, untinted, matching Backlog's band geometry
- Name + badge + goal remain on one line at all densities; goal truncates with tooltip
- No test regressions in the dashboard suite
</success_criteria>

<output>
Create `.planning/quick/260922-jtc-sprint-board-header-style-should-match-o/260922-jtc-SUMMARY.md` when done
</output>
