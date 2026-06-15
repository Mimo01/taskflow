---
phase: 260615-smu-modernize-dashboard
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/chart-wrapper.tsx
  - taskflow/src/routes/dashboard/StatTile.tsx
  - taskflow/src/routes/dashboard/SprintHealthSection.tsx
  - taskflow/src/routes/dashboard/ActivityStrip.tsx
  - taskflow/src/routes/dashboard/DashboardReleaseCard.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/index.test.tsx
autonomous: true
requirements: [QUICK-260615-smu]
must_haves:
  truths:
    - "Dashboard header shows a bold greeting title + date subtitle, no ambient SVG curves"
    - "All non-chart dashboard sections render in the shared <Card> primitive (rounded-xl + ring, not rounded-lg + border)"
    - "Chart sections keep their ChartWrapper loading/error/empty states and never show a double border/padding"
    - "StatTile and SprintHealthSection keep their role=region + aria-label (a11y unchanged)"
    - "Stat-tile loading skeleton geometry matches the loaded Card so there is no visual jump"
    - "npm run check (biome + tsc) is green and all dashboard tests pass"
  artifacts:
    - path: "taskflow/src/components/chart-wrapper.tsx"
      provides: "Modernized chart container (rounded-xl + ring) with a bare variant for in-Card use"
      contains: "ring-foreground/10"
    - path: "taskflow/src/routes/dashboard/StatTile.tsx"
      provides: "StatTile rendered via <Card size=sm> preserving role=region"
      contains: "Card"
    - path: "taskflow/src/routes/dashboard/index.tsx"
      provides: "Modern header + consolidated page shell/gutters, ambient SVG removed"
      contains: "text-3xl"
  key_links:
    - from: "taskflow/src/routes/dashboard/SprintHealthSection.tsx"
      to: "taskflow/src/components/chart-wrapper.tsx"
      via: "bare ChartWrapper inside <Card> (no nested border)"
      pattern: "bare"
    - from: "taskflow/src/routes/dashboard/StatTile.tsx"
      to: "taskflow/src/components/ui/card.tsx"
      via: "Card import + render"
      pattern: "from '@/components/ui/card'"
---

<objective>
Modernize and visually polish the dashboard (`taskflow/src/routes/dashboard/`) so it matches the rest of the app's visual language and is internally consistent. This is a VISUAL POLISH + LIGHT RESTRUCTURE pass only — NO behavior changes, NO new interactions (stat tiles stay strictly read-only).

Three coordinated changes per the LOCKED CONTEXT.md decisions:
1. Header: replace the ambient orange/blue SVG-curve hero with the MyTasksPage bold-title + subtitle pattern.
2. Cards: fully adopt the shared `<Card>` primitive for all non-chart sections, replacing raw `rounded-lg border` divs.
3. ChartWrapper reconciliation: modernize ChartWrapper's own container to the Card look and add a `bare` variant so chart sections never double-border/double-pad when they live inside a Card.

Purpose: The dashboard is functionally complete but visually dated (hero SVG no other page uses, ad-hoc `rounded-lg border` divs, repeated per-row gutters). Aligning it to the shared primitives and header pattern makes the app feel cohesive.

Output: 6 source files restyled + 1 test file updated. `npm run check` stays green; all dashboard tests pass.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260615-smu-modernize-dashboard/260615-smu-CONTEXT.md
@.planning/quick/260615-smu-modernize-dashboard/260615-smu-RESEARCH.md

# Card primitive contract (the modern target surface):
@taskflow/src/components/ui/card.tsx

# The files being modernized:
@taskflow/src/components/chart-wrapper.tsx
@taskflow/src/routes/dashboard/StatTile.tsx
@taskflow/src/routes/dashboard/SprintHealthSection.tsx
@taskflow/src/routes/dashboard/index.tsx

# Canonical header pattern to mirror (read lines ~714-825):
@taskflow/src/routes/my-tasks/MyTasksPage.tsx
</context>

<constraints>
- These files start with `'use no memo';` — PRESERVE this directive verbatim (React Compiler opt-out): `index.tsx`, `StatTile.tsx`, `SprintHealthSection.tsx`, `chart-wrapper.tsx`, AND `ActivityStrip.tsx`.
- `<Card>` uses `rounded-xl` + `ring-1 ring-foreground/10` + `--card-spacing` padding. Do NOT add your own `p-4`/`p-6` or `rounded-lg border` inside a Card — padding comes from `--card-spacing` and the slot `px-` classes. Double padding is a defect.
- NEVER nest a bordered `<ChartWrapper>` inside a `<Card>` (border + ring, p-6 + py = double). Use the new `bare` variant (Task 1) for the donut inside SprintHealthSection.
- A11y is load-bearing and tested: StatTile must keep `role="region"` + `aria-label={label}`; SprintHealthSection must keep `role="region" aria-label="Sprint health"`. `<Card>` spreads `...props`, so pass these straight to `<Card>`.
- NO new interactions: do NOT add `role="button"`, `cursor-pointer`, `hover:bg-*`, click handlers, or deep-link/filter behavior to StatTile or any tile. Tiles are purely informational regions (StatTile.tsx header comment, D-06).
- biome.json is recommended-only with NO class-sort rule, so className order is not lint-enforced; correctness comes from `npm run check`.
- Keep existing grid recipes: stat tiles `grid grid-cols-2 sm:grid-cols-4 gap-4`; paired sections `grid grid-cols-1 lg:grid-cols-2 gap-4`.
</constraints>

<tasks>

<task type="auto">
  <name>Task 1: Modernize ChartWrapper container + add bare variant</name>
  <files>taskflow/src/components/chart-wrapper.tsx</files>
  <action>
Modernize ChartWrapper's outer container to match the Card surface and add an opt-out for in-Card use, so chart sections get the modern look without double-bordering.

1. Add an optional `bare?: boolean` prop to `ChartWrapperProps` (default false). When `bare` is true, ChartWrapper renders WITHOUT its own container chrome (no `bg-card`, no rounding, no ring, no padding) — just the title, optional description, and the chart body `<div style={{ height }}>`. This is for ChartWrappers that sit INSIDE a `<Card>` (the SprintHealthSection donut), preventing the double-border/double-padding hazard called out in RESEARCH.md section 3.

2. When `bare` is false (the default, used by VelocityChart/BurndownChart/WeeklyTrendChart which render ChartWrapper as a standalone section), change the outer div's container classes (currently `bg-card rounded-[var(--radius)] border border-border p-6`) to the Card surface treatment: `bg-card rounded-xl ring-1 ring-foreground/10 p-6`. This gives the three standalone chart sections the identical rounded-xl + ring look as Card without any nesting. All three inherit this for free since they all use ChartWrapper.

3. Use `cn()` (import from `@/lib/utils`) to select between the container classes and the bare (container-less) wrapper. In bare mode keep a `flex flex-col` so title/description/chart still stack; do NOT carry over `p-6`/`bg-card`/ring/rounding.

4. Preserve the existing state precedence (error then loading then empty then success) and the `renderChart()` logic exactly — only the outer container styling and the new `bare` branch change.

5. Preserve the `'use no memo';` directive at the top.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/WeeklyTrendChart.test.tsx && grep -q "ring-foreground/10" src/components/chart-wrapper.tsx && grep -q "bare" src/components/chart-wrapper.tsx</automated>
  </verify>
  <done>ChartWrapper accepts a `bare` prop; non-bare container uses `rounded-xl ring-1 ring-foreground/10 p-6` (no `border border-border`); bare mode drops all container chrome; WeeklyTrendChart test passes; `'use no memo'` preserved.</done>
</task>

<task type="auto">
  <name>Task 2: Adopt Card for StatTile, SprintHealthSection, ActivityStrip, DashboardReleaseCard</name>
  <files>taskflow/src/routes/dashboard/StatTile.tsx, taskflow/src/routes/dashboard/SprintHealthSection.tsx, taskflow/src/routes/dashboard/ActivityStrip.tsx, taskflow/src/routes/dashboard/DashboardReleaseCard.tsx</files>
  <action>
Replace every raw `rounded-lg border border-border bg-card p-*` section container with the shared `<Card>` primitive (import the slots you use from `@/components/ui/card`). Padding/radius/ring come from Card — do NOT keep `p-4`/`p-6`/`rounded-lg`/`border` on the converted containers.

StatTile.tsx (root at line 33-37):
- Replace the root `<div role="region" aria-label={label} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[80px]">` with `<Card size="sm" role="region" aria-label={label} className="min-h-[80px] gap-2">`. Card spreads `...props`, so `role`/`aria-label` forward through (the `getByRole('region', { name: label })` assertion still passes).
- Put the icon+label header div and the value `<p>` inside a `<CardContent className="flex flex-col gap-3">`. Keep the value `<p aria-label={value + ' ' + label}>` exactly. Do NOT add any click handler, cursor-pointer, or hover style (read-only, D-06).

SprintHealthSection.tsx (outer div at line 107-112):
- Replace the outer `<div role="region" aria-label="Sprint health" className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">` with `<Card role="region" aria-label="Sprint health" className="gap-4">`. Keep `role`/`aria-label` on the Card (test SprintHealthSection.test.tsx:276 asserts them).
- The days-remaining block, progress block, and donut currently sit directly in that div. Place them inside the Card via `<CardContent className="flex flex-col gap-4">` (everything stays within the single Card).
- The donut `<ChartWrapper>` (line 150) now lives INSIDE the Card — pass the `bare` prop (added in Task 1) so it does not render its own border/padding/ring. Preserve all its props: `title`, `description`, `height`, `isLoading`, `error`, `isEmpty`, `onRetry`, and its children (ChartContainer + center-label overlay) unchanged.
- Preserve the `'use no memo';` directive and ALL query/metric logic untouched (only the container markup changes).

ActivityStrip.tsx (the `<section>` at line 222-226):
- Replace the `<section aria-label="Recent activity" className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">` with `<Card aria-label="Recent activity">` (Card renders a div; aria-label forwards via props). Convert the `<h2 className="text-base font-semibold text-foreground">Recent activity</h2>` into `<CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>`. Move the loading/error/content body into `<CardContent className="flex flex-col gap-3">`. The test asserts only text presence of "Recent activity" — preserved.

DashboardReleaseCard.tsx (div at line 75):
- Replace `<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">` with `<Card className="min-h-[160px]">`. Convert the "Next Release" icon+label header row into a `<CardHeader>` containing the icon + a `<CardTitle>`-styled label (keep the icon + uppercase label intent). Move skeleton/content into `<CardContent className="flex flex-col gap-3">`. Keep ALL Badge/timing/overdue logic untouched.

For every section: remove the now-redundant inner `p-*`/`rounded-lg`/`border` classes; let Card own spacing. Keep each section's independent loading/error/empty state branches exactly as they are.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/StatTile.test.tsx src/routes/dashboard/SprintHealthSection.test.tsx src/routes/dashboard/DashboardReleaseCard.test.tsx src/routes/dashboard/ActivityStrip.test.tsx</automated>
  </verify>
  <done>All four sections render via `<Card>` (no `rounded-lg border border-border` remains in StatTile/SprintHealthSection/ActivityStrip/DashboardReleaseCard); donut ChartWrapper uses `bare`; role/aria-label preserved on StatTile and SprintHealthSection; all four test files pass.</done>
</task>

<task type="auto">
  <name>Task 3: Replace hero header, consolidate page shell/gutters, update SVG test</name>
  <files>taskflow/src/routes/dashboard/index.tsx, taskflow/src/routes/dashboard/index.test.tsx</files>
  <action>
Replace the ambient-SVG hero with the MyTasksPage header pattern and consolidate the page shell so the per-row gutters are unified.

index.tsx:
1. Delete the `AMBIENT_CURVES` constant (lines 31-41) — it is no longer referenced.
2. Replace the entire hero `<section className="relative px-8 py-20 text-center overflow-hidden">` block (lines 160-187: the `<svg>`, the `text-6xl` `<h1>`, the centered date `<p>`) with the MyTasksPage header pattern (mirror `MyTasksPage.tsx:714-825`):
   - Container: `<div className="flex items-end justify-between gap-4 px-6 pt-5 pb-5 border-b border-border/50 shrink-0">`
   - Left column: `<div className="flex flex-col gap-1 min-w-0">` containing `<h1 className="text-3xl font-semibold text-foreground">{timeGreeting} {firstName ?? 'there'}</h1>` and `<p className="text-xs text-muted-foreground mt-1">{today}</p>`.
   - Right slot is optional (Claude's discretion). Leave it empty or omit — stat tiles stay read-only, no new toolbar interactions required.
   - This preserves the greeting + date TEXT (tests assert `getByText(/Alice/)`, `/Jane/`, `/there/`, and the en-GB date string — all retained).
3. Consolidate the page shell. Change the root `<div className="relative flex flex-col min-h-full bg-background">` to `<div className="flex flex-col h-full overflow-auto bg-background">`. Keep the header `<div>` (from step 2) as the first child. Wrap ALL the section rows (stat tiles, sprint health + weekly trend, activity + release, insights) in a single content container: `<div className="flex flex-col gap-4 px-6 py-4">`.
4. Remove the now-redundant per-row wrappers `<div className="relative px-6 pb-6">` (lines 190, 239, 258, 287). Each row's inner grid (`grid grid-cols-2 sm:grid-cols-4 gap-4` for tiles; `grid grid-cols-1 lg:grid-cols-2 gap-4` for the paired sections) becomes a direct child of the new `gap-4` content container. The `relative` class was only for SVG z-index — drop it everywhere since the SVG is gone.
5. Update the stat-tile loading skeleton (lines 192-202) so its geometry matches the new `<Card size="sm">`: change the skeleton block className from `rounded-lg border border-border bg-card p-4 min-h-[80px] flex flex-col gap-3` to mirror the Card surface — `rounded-xl ring-1 ring-foreground/10 bg-card p-3 min-h-[80px] flex flex-col gap-3` (so skeleton-to-loaded does not visually jump). Keep the inner `<Skeleton>` lines.
6. Preserve the `'use no memo';` directive. Do NOT touch any query, metric, or prop-passing logic — only the header markup and the layout container classes change.

index.test.tsx:
7. Update "Test 6 (decorative SVG present)" (lines 163-168). The ambient SVG is intentionally removed by this visual pass (it was decorative-only, `aria-hidden`, asserted by no behavior). Replace that test so it reflects the new header: assert the header renders the bold title (e.g. `expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-3xl')`) and that no `<section svg>` ambient hero remains (`expect(document.querySelector('section svg')).toBeNull()`). Rename the test to describe the modern header (e.g. "Test 6 (modern header, no ambient SVG)"). Leave all other tests untouched.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/index.test.tsx && grep -q "text-3xl" src/routes/dashboard/index.tsx && ! grep -q "AMBIENT_CURVES" src/routes/dashboard/index.tsx</automated>
  </verify>
  <done>Hero SVG + `AMBIENT_CURVES` removed; header mirrors MyTasksPage (`text-3xl font-semibold` title, `text-xs text-muted-foreground` date, `border-b border-border/50`); per-row `relative px-6 pb-6` gutters consolidated into one `px-6 py-4 gap-4` container; skeleton matches new Card geometry; index.test.tsx Test 6 updated to assert the modern header; index test passes.</done>
</task>

</tasks>

<verification>
Final full-project gate (run after all three tasks):

1. `cd taskflow && npm run check` — biome check + `tsc --noEmit` MUST be GREEN (project baseline, memory project_biome_state). No new type errors, no biome violations.
2. `cd taskflow && npx vitest run src/routes/dashboard/` — ALL dashboard tests pass (StatTile, SprintHealthSection, index, DashboardReleaseCard, ActivityStrip, WeeklyTrendChart).
3. Grep sanity: no `rounded-lg border border-border` remains in StatTile.tsx, SprintHealthSection.tsx, ActivityStrip.tsx, DashboardReleaseCard.tsx, or chart-wrapper.tsx.
4. All `'use no memo';` directives intact (index.tsx, StatTile.tsx, SprintHealthSection.tsx, chart-wrapper.tsx, ActivityStrip.tsx).
</verification>

<success_criteria>
- Dashboard header is the bold-title + date-subtitle MyTasksPage pattern; ambient SVG curves gone.
- Every non-chart section (stat tiles, sprint health, activity, release) renders via `<Card>` (rounded-xl + ring), not raw `rounded-lg border` divs.
- Standalone chart sections (Velocity/Burndown/WeeklyTrend) show the modern `rounded-xl ring` container; the in-Card donut uses `bare` ChartWrapper with no double border/padding.
- A11y unchanged: StatTile keeps `role="region"`/`aria-label`; SprintHealthSection keeps `role="region" aria-label="Sprint health"`.
- Per-row gutters consolidated to a single `px-6 py-4 gap-4` content container; no leftover no-op `relative`.
- Stat-tile skeleton geometry matches the loaded Card (no jump).
- `npm run check` GREEN; all dashboard tests pass; no behavior or interaction changes.
</success_criteria>

<output>
Create `.planning/quick/260615-smu-modernize-dashboard/260615-smu-SUMMARY.md` when done.
</output>
