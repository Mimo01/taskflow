# Quick 261013-l97: AIO Cycles dashboard redesign - Research

**Researched:** 2026-10-13
**Domain:** React dashboard UI on existing AIO data (no new data fetching, no new packages)
**Confidence:** HIGH for the codebase findings (verified by reading the code), MEDIUM for the content recommendations

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- KEEP the folder tree as the left rail. It's the scope filter: the selected folder (All cycles / Ungrouped / folder subtree) scopes every KPI and chart.
- The right pane becomes a scrollable dashboard: KPI tile row at the top, then a chart grid, then the existing cycle list below.
- Cycle list placement: below the charts on the same page (no tabs). Keep the list's existing behaviour: Open|All filter, virtualization above 100 rows, row click, all-closed notice.
- Watch the scroll containers. Today the list owns its own scroll and virtualizer. With the dashboard above it, either the whole right pane scrolls (and the virtualizer uses the pane as its scroll element) or the list keeps a bounded height. Avoid nested double scrollbars.
- Cross-filter: clicking a chart segment or a KPI tile (e.g. an owner bar, the "Overdue" tile, a status segment) filters the cycle list below. Show an active-filter chip near the list header that clears it. Folder changes reset the filter. Charts stay keyboard reachable.
- Keep the existing data-fetching logic. Don't rewrite it.

### Claude's Discretion
- Which KPIs and charts to show. Starting proposal: KPI tiles for Open cycles, Overdue, Test runs executed / total, and Pass rate; an execution status mix; cycles by owner; a schedule or due-soon view.
- Visual details, within the user's established taste.

### Established preferences (MUST follow)
- Colour means status only. Tooltips have at most 4 rows plus at most 1 note. No legends.
- Cards are identical and fixed-size in every state. Skeletons match the final geometry and use the same Card shell. No layout shift.
- Everything is hoverable. Anything that lists cycles is clickable and keyboard reachable.
- Sub-dividers are lighter than section borders. In the list, one row is one line at every density.
- `<Card>` is `rounded-xl ring-1` with no implicit role: pass `role="region"`, and `role="heading" aria-level` on CardTitle.
- Status colours and keys come from `statusConfig`, using the same mapping as `cycleProgress`.
- Don't reintroduce a "Show closed" Switch. The effort unit (seconds) and the date format are still unverified live.
</user_constraints>

## Summary

The page already loads everything the dashboard needs. `cyclesWithDetailQuery.data.items` holds every cycle in scope, paginated with no 500 cap. `summaryByID` holds each cycle's test-run distribution. `configQuery.data` holds the status config. All KPIs and charts are **pure derivations of data the page already has**. No new endpoints are needed, except optional owner-name lookups that reuse the cached `OwnerCell` query key.

**Two context assumptions are wrong.** `StatTile` and `ChartWrapper` no longer exist. They were deleted in Phase 86 (16dd5f68) and quick-260616-mmw (34937814). `routes/dashboard/widget-removal.guard.test.ts` also **fails the build if `routes/dashboard/StatTile.tsx` (or `.test.tsx`) exists**. The current primitives are `<Card>`, the `EpicStatCard` geometry (`STAT_CARD_CLASS`, `StatCardBody`), `TooltipBody`/`TooltipRow`, `BandBar`, `ChartContainer` and `clickableCard`.

Recharts 3.8 has no keyboard activation for Bar or Pie clicks: Enter only toggles the tooltip. Clickable chart elements must therefore be **HTML/CSS bars built from `<button>`s**. This is the pattern ProgressCell, BandBar and the epic "By person" rows already use.

**Primary recommendation:** Build an `AioCyclesDashboard` component (4 fixed stat tiles plus 3 HTML-bar chart cards) fed by one memoized `aggregateCycleScope()` pure helper in `lib/aio-cycle-list.ts`. Lift the scroll container to the page's right pane, pass it to `AioCycleList` as `scrollElementRef`, and keep the cross-filter in page-level `useState`, reset on folder change.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|---|---|---|
| Scope aggregation (KPIs, buckets) | Client: pure helpers in `lib/aio-cycle-list.ts` | Data is already in memory; testable without React |
| Cross-filter state | Client: page `useState` | Ephemeral; resets on folder change; must not persist |
| Open\|All filter | Client: existing zustand store (persisted) | Unchanged |
| Owner display names | API via the existing `fetchJiraUserByUsername` query key | Shares the cache with `OwnerCell` |

## Package Legitimacy Audit
This task installs no new packages. It uses the installed `recharts` 3.8.0 (optional) and `@tanstack/react-virtual` 3.13.23 [VERIFIED: node_modules package.json]. Nothing needs a slopcheck.

## 1. Data available per cycle [VERIFIED: services/aio/types.ts, AioProjectOverviewPage.tsx]

- **`AioCycleDetailItem`**: `ID` and `detail: { key, title, ownedByID (Jira username, e.g. JIRAUSER23429), folder, isClosed, startDate, endDate (string|number|null, format unverified), objective? }`. `summary` is always null here.
- **`AioCycleSummaryItem.summary`**: `{ totalTests, testRunDistribution: Record<statusIdString, number>, totalRuns?, estimatedEffort?, actualEffort?, assignees?: unknown }`. These arrive **after** the cycles, from a second query keyed on `allIDs.join(',')`. Summaries load while `cycleSummariesQuery.isLoading` is true.
- **`AioTestRunStatusConfig`**: `{ ID, name, statusType (PASSED|FAILED|BLOCKED|NOT_RUN|IN_PROGRESS), color }`.
- **Existing helpers** (reuse, don't duplicate):
  - `cycleProgress(summary, statusConfig)` returns `{ counts: Record<StatusKey,n>, total, passPct }`. It clamps `total = max(totalTests, distributed)`.
  - `isOverdue(detail, today)` is true for an open cycle whose end date is before today.
  - `toDateKey(raw)` normalises a date to `YYYY-MM-DD` or null.
  - Also `formatEffort`, `progressTooltipRows(counts)` (always ≤4 rows), `sortCycles`, `PROGRESS_SEGMENT_CLASS`. `today` comes from `toLocalDateString(new Date())`.
- **Computable for the scope:**
  - Counts: total, open, closed, overdue, and due in the next N days (open, end date in today to today+N).
  - No-dates count.
  - Aggregate status counts (sum `cycleProgress().counts` over the summaries in scope).
  - Executed = total − notRun. Pass rate = pass ÷ executed (or ÷ total; pick one and label it).
  - Per-owner open, closed and overdue counts.
  - End-date week buckets.
  - Effort sums (unit unverified, so keep effort out of the KPIs).
- **`statusConfig.color`** exists, but the codebase deliberately uses fixed Tailwind status colours. Use `PROGRESS_SEGMENT_CLASS` for bars and the `progressTooltipRows` `var(--color-*)` values for tooltip swatches. Don't use the AIO hex.

## 2. Primitives to reuse [VERIFIED: file reads]

| Primitive | Path | API / notes |
|---|---|---|
| `Card, CardHeader, CardTitle, CardContent` | `components/ui/card.tsx` | `size?: 'default'\|'sm'` (`sm` sets `--card-spacing` to 3). It clips with `overflow-hidden`, so tooltips must portal (base-ui Tooltip already does). |
| Stat tile geometry | `routes/dashboard/issue-detail/EpicStatCard.tsx` | `STAT_CARD_CLASS` (`h-[72px] grid-rows-[1rem_2rem_1rem]`), `STAT_CARD_FOCUS`, `StatCardBody({label, value, sub})` (spans only, so it is valid inside a `<button>`), `STAT_GRID_CLASS` (2 cols, 4 at the `@2xl/epic` container size), `STAT_CONTAINER_CLASS='@container/epic'`. Use `Tile` in `EpicProgressSummary.tsx:155` as the model. |
| Tooltip surface | `components/ui/tooltip-body.tsx` | `TooltipBody({title?, children, note?})`, `TooltipRow({color?, label, value, sub?, marker?, icon?})`. A `color` gives a status swatch. With no colour, use a neutral `icon` or `line` marker. |
| Tooltip | `components/ui/tooltip` | `<Tooltip><TooltipTrigger delay={0} render={<button/>}…><TooltipContent>` (see `AioCycleList.tsx:126`) |
| Segmented status bar | `routes/dashboard/issue-detail/EpicBands.tsx` `BandBar` | Built for Jira categories. For AIO's 5 keys, copy the ProgressCell markup (`PROGRESS_SEGMENT_CLASS`) rather than forcing it into `Bands`. |
| Person-row bar pattern | `EpicProgressSection.tsx:475-505` | A focusable row: `CachedAvatar` (size 20) plus name (`w-40`), a bar on a shared `scale`, and a tooltip. Use this for "By owner". |
| Clickable card | `lib/clickable-card.ts` | `clickableCard(onActivate)` returns `{props, className}`: click, Enter/Space, `tabIndex`, hover ring |
| Skeleton gating | `hooks/useDelayedLoading.ts` | `useDelayedLoading(isPending, 200)` |
| Recharts wrapper (if used) | `components/ui/chart.tsx` `ChartContainer({config, className, initialDimension})` | Conventions: `'use no memo'` at file top (React Compiler is on), an explicit-height wrapper div (WebKit 0×0 guard), `isAnimationActive={false}`, `var(--color-*)` fills |

**Naming pitfall:** don't create `routes/dashboard/StatTile.tsx`, `StatTile.test.tsx`, `SprintHealthSection*`, `VelocityChart.tsx` or `BurndownChart.tsx`, because the guard test asserts these files are absent. Use `Aio*` names, e.g. `AioCyclesDashboard.tsx`.

## 3. Scroll and virtualization (the key structural change) [VERIFIED: AioCycleList.tsx:249-266, 418-455]

Today:
- `AioCycleList` root is `@container flex-1 flex-col overflow-hidden`. Its toolbar (folder label, counts, Open|All) is fixed, and below it sits `<div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">`.
- `useVirtualizer` has `getScrollElement: () => scrollRef.current`, `scrollMargin: rowsOffset`, and `rowsOffset = rowsRef.offsetTop`, re-measured in a `useLayoutEffect` on `[virtualize, isLoading, isPending]`.
- Rows are translated by `virtual.start - scrollMargin`.

Recommended:
1. The page owns the scroll. Make the right pane `<div ref={paneRef} className="@container relative min-w-0 flex-1 overflow-y-auto">`, containing `<AioCyclesDashboard/>` and then `<AioCycleList scrollElementRef={paneRef} …/>`. Change the list root to plain block flow: drop `overflow-hidden`, `flex-1` and its inner scroll div.
2. **Measure `scrollMargin` robustly.** `offsetTop` is relative to the nearest *positioned* ancestor, and any `relative` wrapper between the rows and the pane breaks it. Use `rows.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop`. Re-measure with a `ResizeObserver` on the pane's content wrapper, because the dashboard height changes when the container breakpoint flips 2 to 4 columns, or when the empty or error state differs. The jsdom setup mock of `ResizeObserver` fires synchronously on `observe`, which is fine.
3. Sticky: wrap the list toolbar and the column header in **one** `sticky top-0 z-20 bg-background` block. Today the column header alone is `sticky top-0`, and the toolbar would otherwise scroll away. Container queries (`@[720px]` etc.) still work because the pane carries `@container`.
4. Reset scroll to top on folder change (`paneRef.current.scrollTop = 0`). Otherwise a long previous scroll position lands mid-list in a short folder.
5. Rejected alternative: a bounded-height list (`max-h-[60vh] overflow-auto`). It gives the nested double scrollbar the user explicitly vetoed.

## 4. Cross-filter design

- **Where state lives:** use page-level `const [cycleFilter, setCycleFilter] = useState<CycleFilter|null>(null)`. Reset it inside `selectFolder` (and on projectKey change). Don't put it in the persisted zustand store, which would survive restarts and contradict "folder change resets".
- **Type:** define it in `lib/aio-cycle-list.ts`.
  ```ts
  export type CycleFilter =
    | { kind: 'overdue' } | { kind: 'dueSoon' } | { kind: 'noDates' }
    | { kind: 'owner'; ownerId: string; label: string }
    | { kind: 'status'; status: StatusKey }   // cycles with ≥1 run in that status
    | { kind: 'endWeek'; weekStart: string };
  export function matchesCycleFilter(c, summary, f, today, statusConfig): boolean
  export function cycleFilterLabel(f): string   // chip text
  ```
- **Composition in `AioCycleList`:** add props `filter`, `filterLabel` and `onClearFilter`. Compute `visible = sortCycles(items.filter(openAll).filter(matchesCycleFilter))`. Pass in `today` from the page so the dashboard and list agree.
- **Overdue and due-soon imply open**, so they compose cleanly with Open. For owner and status filters under "Open", the chip should make the scope obvious: "Owner: Jane ×".
- **Empty states:** the existing "All N cycles are closed" notice must only fire when the *Open|All* filter alone empties the list. Add a new "No cycles match {chip}" empty state with a Clear button when the cross-filter empties it. Order: error, then no items, then cross-filter empty, then all-closed.
- **Toggle behaviour:** clicking an active tile or bar again clears the filter. Expose `aria-pressed` on every filter button so tests and screen readers see the state.

## 5. Recommended dashboard content

**KPI scope rule:** count tiles are about open cycles by definition, so they ignore Open|All. The execution metrics (pass rate, status mix) should follow the same set the list shows under Open|All. Otherwise "All cycles" (about 1,300, mostly closed history) drowns the active work. Make that visible by **moving the Open|All segmented control up into a scope bar above the KPIs**, showing `{folderTitle} · N open · M closed · [Open|All]`. It then visibly scopes both the dashboard and the list. The list header keeps the filter chip. Flagged as A1 in the Assumptions Log.

**Row 1: 4 stat tiles** (fixed 72px `STAT_CARD_CLASS` inside `<Card size="sm">`, in a `grid-cols-2 @3xl:grid-cols-4` grid):

| Tile | Value | Sub (row 3) | Tooltip (≤4 rows) | Click |
|---|---|---|---|---|
| Open cycles | `openCount` | `of {total} in scope` | Open, Overdue, Due ≤7d, No end date | none (or sets Open). Not a filter. |
| Overdue | count (red text only when >0; this is a status meaning) | `oldest {n}d late` | top 3 overdue keys + days late | filter `overdue` |
| Due in 7 days | count | `next: {date}` | up to 4 soonest keys + date | filter `dueSoon` |
| Pass rate | `{pass/executed}%` | mini 5-segment status bar + `{executed}/{total} run` | `progressTooltipRows(aggCounts)` (already ≤4) | none (status chart handles status filters) |

This merges "Test runs executed / total" into the Pass rate tile, so the row stays at 4 identical tiles.

**Row 2: chart grid** (`grid gap-4 @4xl:grid-cols-3`; every card has the same fixed body height, e.g. `h-[180px]`):
1. **Execution mix:** one large `h-3` segmented bar (`PROGRESS_SEGMENT_CLASS`), then 5 status rows. Each row is a `<button>` with a coloured swatch, label, count, % and `aria-pressed`. Clicking a row sets the `status` filter.
   - These rows are the clickable segments, not a legend: each shows a value and acts.
   - Optional recharts donut in place of the bar: `PieChart`/`Pie innerRadius`, inside `ChartContainer`, with explicit height and `isAnimationActive={false}`. Keep the rows either way for keyboard access.
2. **By owner:** the top 6 owners by open cycles, using the epic person-row pattern.
   - Each row is a `<button>`: `CachedAvatar` and name (`w-40`), a neutral bar (`bg-foreground/20`) on a shared scale for open cycles, with a red overdue overlay segment (red = overdue status), then the count. A muted "+N others" line follows.
   - Tooltip: Open, Overdue, Closed, Pass %. Click sets the `owner` filter.
   - Names come from `useQueries` over the top-6 IDs with key `['jira', jiraBaseUrl, 'user-by-username', id]`, the same key and `staleTime` as `OwnerCell`, so the list rows reuse the cache.
3. **Schedule:** open cycles by end week, as 10 HTML column buttons. Use 2 past-week buckets merged into "Overdue" (red), this week plus the next 7 weeks (neutral `bg-foreground/25`, with the current week emphasised), and "Later" (muted).
   - Each column is a button with a tooltip (week range, count, up to 2 keys). Click sets `endWeek` (or `overdue` for the overdue column).
   - If no open cycle has an end date, show an empty state inside the same fixed body ("No end dates set"). Date parsing is still unverified live (A3).

**Loading:**
- While cycles are pending, show skeleton tiles and chart bodies, using the same Card shell and the same heights.
- While summaries are loading (`summariesLoading`) but cycles are ready, the count tiles, owner and schedule render. Only the Pass rate tile and the Execution mix card show skeletons, inside their final geometry.
- On error, the list keeps its ErrorState. The dashboard should render nothing or skeleton-free placeholders rather than duplicating the error.

## Don't Hand-Roll

| Problem | Use instead |
|---|---|
| Status mapping and percentages | `cycleProgress`, `progressTooltipRows`, `PROGRESS_SEGMENT_CLASS` |
| Date parsing and overdue | `toDateKey`, `isOverdue`, `formatCycleDates`, `toLocalDateString`; `addDays`-style arithmetic via `Date.UTC` (see the HoursCommitsChart comment) |
| Tooltip layout | `TooltipBody`/`TooltipRow` (a `color` gives a status swatch, otherwise a neutral `icon` marker) |
| Owner lookup | Same query key as `OwnerCell`. Don't add a new users fetch. |
| Card-as-button | `clickableCard()` or a `<button>` with `STAT_CARD_FOCUS` |

## Common Pitfalls

1. **Guard test name collision:** naming a file `StatTile.tsx` in `routes/dashboard` turns `widget-removal.guard.test.ts` red.
2. **Perf with about 1,300 cycles:**
   - Build the status lookup map once. `cycleProgress` rebuilds `byId`/`byName` from statusConfig on *every* call, which is 1,300 × config size. Fine once, wasteful inside per-tile loops. Add a `buildStatusLookup(statusConfig)` helper (or an optional pre-built map parameter) and compute all aggregates in **one pass** inside a single `useMemo([items, summaryByID, statusConfig, today, statusFilter])`.
   - Filtering `visible` needs per-cycle progress too. Memoize a `progressByID` map once and share it between the dashboard and the list's status filter.
3. **Late summaries:** `summaryByID` is `{}` until the summaries query resolves. Treat a missing summary as "loading", not 0%, while `summariesLoading` is true. Note that `cycleSummariesQuery.isLoading` is false when `allIDs` is empty (the query is disabled), so an empty folder must not show eternal skeletons.
4. **The `scrollMargin` offset breaks if any ancestor between the rows and the pane is `position: relative`** (`offsetTop` silently changes reference). Use rect-based measurement (Section 3). Also stop the virtualizer's sticky header from overlapping the first virtual row: keep `translateY(start - scrollMargin)`, and keep the header outside `rowsRef`.
5. **Card `overflow-hidden`** clips focus rings and non-portalled popovers. Use `ring-inset` focus rings on buttons inside cards.
6. **React Compiler:** recharts components need `'use no memo'` at the file top (every existing chart file does this). Plain HTML bar components don't.
7. **Recharts has no keyboard click:** Enter only toggles the tooltip [CITED: recharts accessibility wiki and PR #7906]. Every filter target must be a real `<button>`.
8. **The pre-commit hook** runs `biome check --staged`, then `tsc --noEmit`, then the **full** vitest suite. Combine RED and GREEN into one commit per TDD task. Biome flags `useExhaustiveDependencies`, so a ResizeObserver effect needs correct deps or a justified `biome-ignore`.
9. **"One row = one line":** the owner chart rows and status rows must truncate names (`truncate pr-0.5`), not wrap.

## Code skeleton (wiring only)

```tsx
// AioProjectOverviewPage.tsx (right pane)
const paneRef = useRef<HTMLDivElement>(null);
const [cycleFilter, setCycleFilter] = useState<CycleFilter | null>(null);
const today = toLocalDateString(new Date());
const scope = useMemo(() => aggregateCycleScope(items, summaryByID, statusConfig, today), [...]);
// selectFolder: setCycleFilter(null); paneRef.current?.scrollTo({ top: 0 });
<div ref={paneRef} className="@container relative min-w-0 flex-1 overflow-y-auto">
  <ScopeBar … />                {/* folder title, open/closed counts, Open|All */}
  <AioCyclesDashboard scope={scope} filter={cycleFilter} onFilter={setCycleFilter} loading={…} summariesLoading={…} />
  <AioCycleList scrollElementRef={paneRef} filter={cycleFilter} onClearFilter={() => setCycleFilter(null)} today={today} … />
</div>
```

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest 4 + jsdom + @testing-library/react (`taskflow/vitest.config.ts`, setup `src/test/setup.ts` with the ResizeObserver mock that makes recharts render at 600×400) |
| Quick run | `cd taskflow && npx vitest run src/lib/aio-cycle-list.test.ts src/routes/dashboard/AioProjectOverviewPage.test.tsx src/routes/dashboard/AioCycleList.test.tsx` |
| Full suite | `cd taskflow && npm run test && npx tsc --noEmit && npx biome check ./src` |

**Test map:**
- `lib/aio-cycle-list.test.ts` (extend) needs unit tests for `aggregateCycleScope` (overdue, due-soon boundary at today and today+7, no dates, status sums, owner ranking, week buckets), `matchesCycleFilter` per kind, and `cycleFilterLabel`.
- `AioProjectOverviewPage.test.tsx` (25 tests; reuse its mocks) needs:
  - Tiles render counts for the fixture.
  - Clicking the Overdue tile shows the chip and filters rows; the chip clears it.
  - Clicking the same tile again clears it.
  - A folder change resets the filter.
  - The Pass rate tile shows a skeleton while summaries are pending.
- Existing mocks: the store mock is reactive via `useSyncExternalStore` (extend it only if new store fields are added; page `useState` needs none). `useDelayedLoading` is mocked to identity. `fetchJiraUserByUsername` is mocked, so owner chart names fall back to the `ownedByID` string.
- Fixtures have fewer than 100 cycles, so the list renders unvirtualized in jsdom. That is the existing strategy; virtualized-path changes are verified at UAT.
- `AioCycleList.test.tsx` (4 tests) renders the list directly. A new required `scrollElementRef` prop must have a fallback (an internal ref when omitted) or the tests must pass one.
- Wave 0 gaps: none. The infrastructure exists.

## Security Domain
No new inputs, endpoints or persistence. The only new external reads go through the existing authenticated `fetchJiraUserByUsername` (token never in the queryKey; same key as today). ASVS V5: filter values come from in-memory data, not user text. No other ASVS concerns apply.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Moving Open\|All into a scope bar above the KPIs, so execution metrics follow it, is acceptable. CONTEXT says "keep the list's Open\|All filter", and this keeps the control and its behaviour but changes its position. | Low. Fallback: leave it in the list header and compute execution metrics over **open** cycles only, labelled "open cycles". |
| A2 | Pass rate = pass ÷ executed (excludes Not run). | Medium. The user may expect pass ÷ total (matching the list's `passPct`, which is pass ÷ total). **Consistency argues for pass ÷ total**, to match the per-row %. The planner should pick pass ÷ total unless the user says otherwise. |
| A3 | `endDate` parses with `toDateKey` (ISO or epoch). Still unverified live. | The schedule and overdue views show the "No end dates" empty state. |
| A4 | Top-6 owners plus "+N others" fits the fixed card height. | Cosmetic. |

## Sources
- Codebase (HIGH): `AioProjectOverviewPage.tsx`, `AioCycleList.tsx`, `lib/aio-cycle-list.ts`, `services/aio/{types,cycles}.ts`, `stores/aio-cycles-selection.store.ts`, `components/ui/{card,chart,tooltip-body}.tsx`, `issue-detail/{EpicStatCard,EpicProgressSummary,EpicProgressSection,EpicBands,EpicCfdChart}.tsx`, `HoursCommitsChart.tsx`, `lib/clickable-card.ts`, `widget-removal.guard.test.ts`, `src/test/setup.ts`, `.husky/pre-commit`; git log for the StatTile and ChartWrapper deletions.
- [Recharts and accessibility (wiki)](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility): accessibilityLayer gives arrow-key and tooltip navigation only.
- [recharts PR #7906](https://github.com/recharts/recharts/pull/7906): Enter toggles tooltip interaction and does not fire onClick (MEDIUM).
- [BarChart API](https://recharts.github.io/en-US/api/BarChart/)

**Valid until:** about 2026-11-13, or until the next change to these files.
