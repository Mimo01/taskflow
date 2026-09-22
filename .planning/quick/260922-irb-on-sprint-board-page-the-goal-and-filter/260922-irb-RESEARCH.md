# Quick Task 260922-irb: Sprint Board sticky header (goal + filters + sprint name) — Research

**Researched:** 2026-09-22
**Domain:** React/Tailwind layout inside an existing virtualized board (taskflow)
**Confidence:** HIGH (all findings read directly from the codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Sticky header:** Sticky bar with the goal visually de-emphasized relative to filters/sprint name. Filters stay as-is visually (user said they're fine) but must be part of the sticky region.

### Claude's Discretion
- **Sprint name display:** pick placement/treatment (heading vs inline) based on existing layout and component patterns.
- **Goal restyle:** inspect current styling and choose a polished, de-emphasized treatment (quiet/subtle or a light card/pill) consistent with existing design tokens.

### Deferred Ideas (OUT OF SCOPE)
None recorded.
</user_constraints>

## Summary

The sprint goal, the quick-filter chip row, and the `UnifiedFilterBar` are rendered **inside** the board's scroll container (`SprintBoardTab.tsx:1743`), above the virtualizer — which is exactly why they scroll away. The page already has a "fixed chrome" region: the root is `flex flex-col h-full`, and the column-header row (`:1613`) sits in it as `shrink-0` and never scrolls.

**Primary recommendation:** Do **not** add `position: sticky`. Hoist the goal/chips/filter-bar JSX out of the scroll container and into the existing `shrink-0` fixed region as siblings of the column-header row. This matches the deliberate architectural note already in the file (`:1606-1610` — "This avoids CSS sticky which breaks with virtualizer transforms"), avoids a z-index collision with the JS-driven sticky swimlane overlay, and requires no new scroll math. Render the sprint **name** from the `activeSprint` query that is already fetched (`:1005`) — no new request.

## Current Structure (verified, file + line)

`taskflow/src/routes/dashboard/SprintBoardTab.tsx` (1878 LOC)

| Line | Element | Classes / notes |
|------|---------|-----------------|
| 1611 | Root | `flex flex-col h-full` (fills `<main>`) |
| 1613 | Column headers (Ready/In Progress/Done + counts) | `shrink-0 bg-background border-b border-border relative h-10 density-compact:h-7 z-20` — **never scrolls** |
| 1635 | Refresh + "Refreshed: …" | `absolute right-0 top-0` inside the header row |
| 1663 | Scroll-area wrapper | `flex-1 relative min-h-0` |
| 1668 | JS sticky swimlane overlay | `absolute top-0 left-0 right-0 z-[9] overflow-hidden pointer-events-none` |
| 1723 | `DndContext` | wraps only the scroll area |
| **1743** | **Scroll container** (`scrollContainerRef`) | `h-full overflow-auto` |
| 1745-1772 | Skeleton / ErrorState / StaleDataBanner | inside scroll container |
| **1775-1777** | `<SprintGoalBanner goal={activeSprint.goal} />` | gated on `!showSkeleton && !isError && data && activeSprint?.goal` |
| **1780-1782** | `<QuickFilterChipRow labels={…} />` | |
| **1785-1787** | `<UnifiedFilterBar filterOptions={…} />` | `data-testid="unified-filter-bar"` |
| 1799 | `VirtualizedSwimlanes` | TanStack virtualizer, absolute rows |

Note the current visual order is **column headers first, then goal/chips/filters**. Hoisting the header block *above* the column headers produces the natural order `[sprint name + goal][chips][filters][column headers][board]` — this is a **visible reorder**; flag it for UAT. (Placing the block *between* the column-header row and the scroll wrapper preserves today's order and is equally valid.)

## Data: sprint name is already available

- Query: `SprintBoardTab.tsx:1005` — `useQuery(['jira-active-sprint', …], fetchActiveSprint)`, `staleTime: 5min`.
- Type `JiraActiveSprint` — `services/jira.ts:1511`: `{ id, name, state, startDate?, endDate?, goal?, originBoardId? }`.
  - Duplicate definition at `services/jira/types.ts:152`. **Project memory (jira.ts dual-file gotcha):** all consumers import the legacy `services/jira.ts`; do not switch imports.
- **No new fetch needed.** `activeSprint.name` is the sprint name; `startDate`/`endDate` are available if a date range or "day X of Y" subline is wanted.
- **Gating pitfall:** the current block only renders when `activeSprint?.goal` is truthy. The sprint name must render whenever `activeSprint` exists, goal or not — restructure the condition, don't reuse it verbatim.

## Recommended Approach

1. **Hoist** the three blocks (goal, `QuickFilterChipRow`, `UnifiedFilterBar`) out of `div.h-full.overflow-auto` into the root `flex flex-col h-full`, wrapped in a single `shrink-0` container. Keep the `!showSkeleton && !isError && data` gating.
2. **Replace `SprintGoalBanner`** with a combined header component (e.g. `SprintBoardHeader` or extend `SprintGoalBanner.tsx`) that renders sprint name + de-emphasized goal on **one line**.
3. Leave `UnifiedFilterBar` and `QuickFilterChipRow` markup untouched (user: filters are fine).

**Why not `sticky top-0` inside the scroll container:**
- The JS sticky swimlane overlay (`:1668`) is `absolute top-0` on the *scroll-area wrapper* with `z-[9]`. A `sticky top-0` filter bar inside the scroll container would be painted underneath/overlapped by that overlay at the same y-position. Hoisting instead shrinks the scroll area so the overlay naturally starts below the filters.
- `<main className="flex-1 overflow-auto">` (`main.tsx:651`) never scrolls on this page because the route root is `h-full` — matches project memory ("main.overflow-auto never scrolls on h-full pages"). So sticky relative to `<main>` would never engage; only the inner container is a valid sticky context.
- The file explicitly documents avoiding CSS sticky here (`:320-325`, `:1606-1610`).

**Side benefit:** hoisting also moves the filter bar out of `DndContext`, which it does not need.

## Styling Patterns to Reuse

| Need | Use | Source |
|------|-----|--------|
| Badge / pill | `<Badge variant tone>` | `components/ui/badge.tsx` — `variant` (default/secondary/outline/ghost) + `tone: ChipTone` from `lib/statusStyles.ts`; `h-5 rounded px-1.5 text-xs` |
| Section-title + state badge precedent | `text-sm font-semibold` title + `<Badge tone="green">Active</Badge>` | `BacklogPage.tsx:1209-1210` |
| Muted/de-emphasized text | `text-xs text-muted-foreground`, `text-foreground/80` | `SprintGoalBanner.tsx:19-21` |
| Quiet surface | `bg-muted/30`, `border-b border-border/40`, `bg-muted/20` | `SprintGoalBanner.tsx:18`, `UnifiedFilterBar.tsx:540` |
| Row padding rhythm | `px-3 py-1.5 density-compact:py-1 density-comfortable:py-2.5` | `UnifiedFilterBar.tsx:315`, `QuickFilterChipRow.tsx:44` |
| Density variants | `density-compact:` / `density-comfortable:` | declared `index.css:10` — `@variant density-compact (&:is([data-density="compact"] *))` |

Current goal markup (`SprintGoalBanner.tsx:18-22`) — the disliked look:
```tsx
<header className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 density-compact:px-3 py-2 density-compact:py-1">
  <Target className="size-3.5 shrink-0 text-muted-foreground" />
  <span className="text-xs font-medium text-muted-foreground">Goal</span>
  <span className="text-xs text-foreground/80 truncate">{goal}</span>
</header>
```
It is a full-width tinted strip with a redundant "Goal" label. A polished alternative consistent with the app: sprint name as `text-sm font-semibold` (optionally + a `Badge tone="green"`/date range), with the goal as a truncated `text-xs text-muted-foreground` continuation on the same line separated by a `·` or a thin divider — no tinted band, no icon+label pair.

## Pitfalls

1. **Virtualizer offset measurement.** `swimlaneListOffsetRef` (`:300-318`) measures the virtualizer wrapper's offset from the scroll container top and feeds the JS sticky-header push-out math (`:414-417`). Hoisting drops that offset to ~0 — self-correcting via `getBoundingClientRect`, and the `ResizeObserver` observes `scrollElement` (whose height changes when the fixed chrome grows). Verify the swimlane sticky header still pins/pushes correctly after the move.
2. **Fixed-chrome height budget.** Column headers are `h-10 density-compact:h-7`. Adding a permanent header eats board height. Keep it **one line at every density** (project memory: "one row = one line at every density") and add `density-compact:` overrides for padding/text size.
3. **`UnifiedFilterBar` horizontal containment** relies on `flex-1 min-w-0 … overflow-x-auto no-scrollbar` (quick task 260531-3ey). Ensure the new fixed wrapper doesn't reintroduce width growth — give it no `min-w` and let it be a plain block in the `flex flex-col` root.
4. **z-index ladder:** column headers `z-20`, swimlane overlay `z-[9]`, backlog section headers `z-[5]`. A hoisted header needs no z-index (it's outside the scroll area), but if it overlaps anything use `z-20`.
5. **Stale tests.** `SprintGoalBanner.test.tsx` is entirely `it.todo(...)` stubs — including `'applies border-l-4 border-primary accent styling'`, which already doesn't match the implementation. No real assertions block a restyle; update or delete the stale todos. `SprintBoardTab.test.tsx` contains no assertions on the goal, chip row, or filter bar.
6. **Never nest sticky inside the virtualizer** — documented at `:320-325` (absolute + transform creates a containing block that confines `position: sticky`).

## Optional (scope creep — flag before doing)

`routes/dashboard/index.tsx:63` has a local (non-exported) `countWorkingDays` plus a "Sprint day X of Y" / weekend-aware clause (`:182-200`). It could be extracted to `lib/` and reused in the sprint header for polish, but that touches the Dashboard page too. Recommend deferring unless the planner wants the extra signal.

## Files to Touch

- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — hoist lines 1774-1787 out of the scroll container; adjust `activeSprint` gating.
- `taskflow/src/routes/dashboard/SprintGoalBanner.tsx` — restyle / absorb into a sprint header component.
- `taskflow/src/routes/dashboard/SprintGoalBanner.test.tsx` — remove/refresh stale `it.todo` stubs.

## Sources

All HIGH confidence — read directly from the working tree (no external/package research required; zero new dependencies).
