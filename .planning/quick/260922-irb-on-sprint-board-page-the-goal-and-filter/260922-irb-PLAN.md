---
phase: quick-260922-irb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/SprintBoardHeader.tsx
  - taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx
  - taskflow/src/routes/dashboard/SprintGoalBanner.tsx
  - taskflow/src/routes/dashboard/SprintGoalBanner.test.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
autonomous: false
requirements: [IRB-01, IRB-02, IRB-03]

must_haves:
  truths:
    - "The sprint name is visible on the Sprint Board page whenever an active sprint exists, with or without a goal."
    - "The sprint goal renders de-emphasized next to the sprint name on a single line, without the old tinted full-width strip and without the redundant 'Goal' label."
    - "The sprint header, quick-filter chip row, and unified filter bar stay visible while the board scrolls."
    - "The JS-driven sticky swimlane header still pins and push-outs correctly after the layout change."
    - "The header region occupies exactly one line at compact, normal, and comfortable density."
  artifacts:
    - path: "taskflow/src/routes/dashboard/SprintBoardHeader.tsx"
      provides: "Single-line sprint name + de-emphasized goal header"
      exports: ["SprintBoardHeader"]
    - path: "taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx"
      provides: "Real assertions replacing the stale it.todo stubs"
      contains: "describe('SprintBoardHeader'"
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "Fixed (non-scrolling) chrome containing header + chips + filter bar"
  key_links:
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "SprintBoardHeader"
      via: "import + render inside the shrink-0 fixed region"
      pattern: "SprintBoardHeader"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "activeSprint.name"
      via: "existing ['jira-active-sprint'] query — no new fetch"
      pattern: "activeSprint"
---

<objective>
Make the Sprint Board's goal + filter region permanently visible, restyle the goal into a polished
de-emphasized treatment, and surface the active sprint's name — which is currently nowhere on the page.

Purpose: the header area scrolls away and the disliked tinted goal strip wastes a full row on a
redundant "Goal" label while the sprint identity is invisible.

Output: a new `SprintBoardHeader` component plus a layout change in `SprintBoardTab.tsx` that hoists
the header/chips/filter blocks out of the scroll container into the existing fixed chrome.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260922-irb-on-sprint-board-page-the-goal-and-filter/260922-irb-CONTEXT.md
@.planning/quick/260922-irb-on-sprint-board-page-the-goal-and-filter/260922-irb-RESEARCH.md
@taskflow/src/routes/dashboard/SprintGoalBanner.tsx
@taskflow/src/components/ui/badge.tsx

Key facts established by research (do not re-derive):
- `activeSprint` is already fetched at `SprintBoardTab.tsx:1005` (`['jira-active-sprint', …]`, staleTime 5min).
  Type `JiraActiveSprint` lives in `services/jira.ts:1511` — `{ id, name, state, startDate?, endDate?, goal? }`.
  Project memory "jira.ts dual-file gotcha": import from the legacy `services/jira.ts`, never `services/jira/types.ts`.
- Do NOT use CSS `position: sticky`. `SprintBoardTab.tsx:320-325` and `:1606-1610` document why
  (virtualizer transforms create containing blocks; the route root is `h-full` so `<main>`'s
  `overflow-auto` never scrolls). The JS sticky swimlane overlay at `:1668` is `absolute top-0 z-[9]`
  on the scroll-area wrapper and would paint over a sticky filter bar at the same y-position.
- Density variants `density-compact:` / `density-comfortable:` are declared in `index.css:10`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create SprintBoardHeader (sprint name + de-emphasized goal, one line)</name>
  <files>
taskflow/src/routes/dashboard/SprintBoardHeader.tsx,
taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx,
taskflow/src/routes/dashboard/SprintGoalBanner.tsx (delete),
taskflow/src/routes/dashboard/SprintGoalBanner.test.tsx (delete)
  </files>
  <behavior>
    - Renders the sprint name when `name` is provided.
    - Renders the goal text alongside the name when `goal` is a non-empty string.
    - Renders the sprint name with no goal element when `goal` is null/empty/whitespace-only.
    - Returns `null` when `name` is absent AND `goal` is absent (nothing to show).
    - Exposes `role="banner"` with an accessible label mentioning the sprint.
  </behavior>
  <action>
Create `SprintBoardHeader.tsx` exporting `SprintBoardHeader({ name, goal, state }: { name?: string | null; goal?: string | null; state?: string | null })`.

Layout: a single horizontal flex row, one line at every density (project memory: "one row = one line at
every density" — density variants change padding/font size only, never wrap to a second line).
Contents left-to-right:
1. Sprint name as `text-sm density-compact:text-xs font-semibold text-foreground`, `truncate` guarded by a
   `min-w-0` parent so a long name does not push the goal out of the row.
2. A `<Badge variant="secondary" tone="green">` (from `components/ui/badge.tsx`) showing the sprint state,
   rendered only when `state` is truthy — mirrors the section-title + state-badge precedent at
   `BacklogPage.tsx:1209-1210`. `shrink-0`.
3. A thin separator (a `·` in `text-muted-foreground/50`, `shrink-0`) then the goal as
   `text-xs text-muted-foreground truncate` inside `flex-1 min-w-0`, with `title={goal}` so the full text
   is available on hover. Include `pr-0.5` if the goal is styled italic (project memory: italic overhang
   gets clipped by `truncate`) — plain (non-italic) is preferred here.

Deliberately DROP from the old banner (this is the disliked look per CONTEXT): the `Target` icon, the
literal "Goal" label, the `bg-muted/30` tinted band. Keep only a quiet bottom hairline
`border-b border-border/40` so it reads as chrome rather than content. Padding rhythm matches the
existing bars: `px-3 py-1.5 density-compact:py-1 density-comfortable:py-2.5`.

Accessibility: `role="banner"` plus `aria-label="Sprint header"`.

Delete `SprintGoalBanner.tsx` and `SprintGoalBanner.test.tsx` (`git rm`). The old test file is entirely
`it.todo` stubs — one of which (`applies border-l-4 border-primary accent styling`) already contradicts
the shipped implementation. Do not port the stubs forward.

Write `SprintBoardHeader.test.tsx` with real assertions (React Testing Library, matching the conventions
of neighbouring `*.test.tsx` files in `routes/dashboard/`) covering each bullet in `<behavior>`.

Project memory "Pre-commit hook blocks RED commits": the full vitest suite runs on commit, so combine the
RED and GREEN steps into a single commit for this task.
  </action>
  <verify>
    <automated>cd taskflow &amp;&amp; npx vitest run src/routes/dashboard/SprintBoardHeader.test.tsx</automated>
    <automated>cd taskflow &amp;&amp; git grep -n "SprintGoalBanner" -- src | grep -v '^$' ; test -z "$(cd taskflow &amp;&amp; git grep -l SprintGoalBanner -- src)"</automated>
  </verify>
  <done>`SprintBoardHeader.test.tsx` passes with real (non-todo) assertions; no `SprintGoalBanner` reference remains anywhere under `taskflow/src`.</done>
</task>

<task type="auto">
  <name>Task 2: Hoist header + chips + filter bar into the fixed chrome</name>
  <files>taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
In the returned JSX of `SprintBoardTab` (around `:1604-1800`):

1. Remove the three blocks currently at `:1774-1787` from inside `div[ref=scrollContainerRef].h-full.overflow-auto`:
   the `SprintGoalBanner` block, the `QuickFilterChipRow` block, and the `UnifiedFilterBar` block.
2. Insert them as a single `shrink-0` wrapper `div` inside the root `div[ref=boardRef].flex.flex-col.h-full`,
   positioned ABOVE the fixed column-header row at `:1613`. Resulting visual order:
   `[sprint name + goal][chips][filters][column headers][board]`. This is a visible reorder versus today
   (headers currently sit above the filters) — it is intentional and is the subject of the checkpoint below.
3. Give the wrapper `className="shrink-0"` and nothing else. No `min-w`, no `z-index` — it lives outside
   the scroll area so it needs neither. Research pitfall 3: `UnifiedFilterBar` relies on
   `flex-1 min-w-0 … overflow-x-auto no-scrollbar` for horizontal containment; adding width constraints
   to the wrapper would regress quick task 260531-3ey.
4. Replace the old gating. The current condition `!showSkeleton && !isError && data && activeSprint?.goal`
   hides the sprint name whenever no goal is set. Render `SprintBoardHeader` under
   `!showSkeleton && !isError && data && activeSprint` and pass
   `name={activeSprint.name} goal={activeSprint.goal} state={activeSprint.state}`.
   Keep `!showSkeleton && !isError && data` for the chip row and filter bar verbatim.
5. Update the import: `SprintGoalBanner` → `SprintBoardHeader`.
6. Update the architectural comment at `:1606-1610` to say that the sprint header, chip row, filter bar,
   and column headers are all fixed chrome, and that CSS sticky is still avoided for the reasons already
   documented at `:320-325`.

Do not touch `QuickFilterChipRow` or `UnifiedFilterBar` markup — the user stated the filters look fine.
Do not alter `swimlaneListOffsetRef` (`:300-318`) or the sticky push-out math (`:414-417`): both measure
via `getBoundingClientRect` and self-correct when the offset drops to ~0.

Side effect to accept: the filter bar is now outside `DndContext`, which it does not need.
  </action>
  <verify>
    <automated>cd taskflow &amp;&amp; npm run check</automated>
    <automated>cd taskflow &amp;&amp; npx vitest run src/routes/dashboard/</automated>
    <automated>cd taskflow &amp;&amp; awk '/ref=\{scrollContainerRef\}/,0' src/routes/dashboard/SprintBoardTab.tsx | grep -v '^\s*[/*]' | grep -c -E 'UnifiedFilterBar|QuickFilterChipRow|SprintBoardHeader' | grep -qx 0</automated>
  </verify>
  <done>`npm run check` passes; dashboard test suite passes; none of the three header components appear inside the scroll container any more.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Sprint Board page now shows, as fixed non-scrolling chrome above the column headers: the sprint name
(with a state badge), the sprint goal as quiet muted text on the same line, the quick-filter chip row,
and the unified filter bar. The old tinted "Goal" strip is gone.
  </what-built>
  <how-to-verify>
1. `cd taskflow && npm run dev`, open the app, go to the Sprint Board page.
2. Confirm the current sprint's NAME is visible at the top.
3. Scroll the board down — the sprint name, goal, chips, and filter bar must all stay put.
4. While scrolled, confirm the sticky swimlane (story) header still pins at the top of the board area
   and still gets pushed out by the next swimlane header approaching from below. This is the main
   regression risk of the change.
5. Cycle density (compact / normal / comfortable) — the header must stay ONE line at each.
6. Confirm the new visual order reads well: [sprint name + goal] → [chips] → [filters] → [column headers].
   If you prefer the old order (column headers above the filters), say so and it will be moved.
7. Drag a card between columns to confirm drag-and-drop still works after the filter bar moved out of
   `DndContext`.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what still looks off.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API → renderer | `activeSprint.name` / `.goal` are attacker-influenceable strings rendered into the DOM |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-irb-01 | Tampering | `SprintBoardHeader` goal/name rendering | mitigate | Render as React text children only — no `dangerouslySetInnerHTML`, no wiki/markdown pipeline |
| T-irb-02 | Denial of Service | Long sprint name/goal breaking layout | mitigate | `truncate` + `min-w-0` containment; full text exposed via `title` |
| T-irb-SC | Tampering | npm/pip/cargo installs | accept | Zero new dependencies in this task — no install step |
</threat_model>

<verification>
- `cd taskflow && npm run check` clean (biome + tsc). Project memory: biome baseline drifts — gate on
  "no NEW files flagged", not an absolute diagnostic count.
- `cd taskflow && npm test` — no new failures versus the pre-change baseline.
- No `position: sticky` / `sticky top-` introduced in `SprintBoardTab.tsx` or `SprintBoardHeader.tsx`.
</verification>

<success_criteria>
- Sprint name visible on the Sprint Board page whether or not the sprint has a goal.
- Goal renders de-emphasized, single line, no icon, no "Goal" label, no tinted band.
- Header + chips + filter bar remain visible while the board scrolls.
- Sticky swimlane header behavior unchanged (human-verified).
- One line at every density.
</success_criteria>

<output>
Create `.planning/quick/260922-irb-on-sprint-board-page-the-goal-and-filter/260922-irb-SUMMARY.md` when done
</output>
